using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Torque.Auth;
using Torque.Data;
using Torque.Extensions;
using Torque.Settings;
using Torque.Slack;
using Torque.Users;
// The shop: browse (priced for the caller's region), buy, and see / cancel your orders.
// endpoint: /api/shop/<command>

namespace Torque.Shop;

[ApiController]
[Route("api/shop")]
public class ShopController : ControllerBase
{
    private const int MaxNoteLength = 500;
    private const int MaxMarqueeItems = 40;

    private readonly AppDbContext _db;
    private readonly ShopService _shop;
    private readonly HcaClient _hca;
    private readonly HcaOptions _hcaOptions;
    private readonly SlackNotifier _slack;
    private readonly SlackOptions _slackOptions;
    private readonly YswsEligibility _eligibility;

    public ShopController(AppDbContext db, ShopService shop, HcaClient hca, HcaOptions hcaOptions, SlackNotifier slack, SlackOptions slackOptions, YswsEligibility eligibility)
    {
        _db = db;
        _shop = shop;
        _hca = hca;
        _hcaOptions = hcaOptions;
        _slack = slack;
        _slackOptions = slackOptions;
        _eligibility = eligibility;
    }

    // The whole shop for the caller: today's random item, then every level's items, each
    // priced for their region and marked with why it can't be bought (if it can't).
    [Authorize]
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync([userId.Value], ct);
        if (user is null) return NotFound();

        // Country is cached from HCA at sign-in; read it live once if it never was.
        if (user.Country is null) await LookupAddressAsync(user, ct);

        var region = ShopRegions.RegionFor(user.Country);
        var today = ShopService.TodayEastern();
        var dailyId = await _shop.GetOrCreateDailyAsync(today, ct);
        var unlockedTier = await _shop.UnlockedTierAsync(user.Id, ct);
        var owned = await _shop.OwnedCountsAsync(user.Id, ct);
        var ctx = new ShopContext(unlockedTier, region, dailyId, user.Volts);

        var items = await _db.ShopItems.AsNoTracking()
            .Include(i => i.Variants)
            .Where(i => i.IsActive)
            .OrderBy(i => i.Tier).ThenBy(i => i.SortOrder).ThenBy(i => i.Name)
            .ToListAsync(ct);

        var daily = items.FirstOrDefault(i => i.Id == dailyId);

        return Ok(new ShopDto
        {
            UnlockedTier = unlockedTier,
            Region = region,
            Volts = user.Volts,
            Daily = daily is null
                ? null
                : new DailyItemDto
                {
                    Date = today,
                    EndsAt = ShopService.NextRotationUtc(),
                    Item = ToDto(daily, ctx, owned)
                },
            Tiers = Enumerable.Range(1, 4)
                .Select(tier => new ShopTierDto
                {
                    Tier = tier,
                    Unlocked = tier <= unlockedTier,
                    Items = items
                        .Where(i => i.Tier == tier && i.RandomMode != ShopRandomMode.random_only)
                        .Select(i => ToDto(i, ctx, owned))
                        .ToList()
                })
                .ToList()
        });
    }

    // Public: what's in the shop, for the landing page's scrolling tape.
    [HttpGet("marquee")]
    public async Task<IActionResult> Marquee(CancellationToken ct)
    {
        var items = await _db.ShopItems.AsNoTracking()
            .Where(i => i.IsActive)
            .OrderBy(i => i.Tier).ThenBy(i => i.SortOrder).ThenBy(i => i.Name)
            .Take(MaxMarqueeItems)
            .Select(i => new
            {
                i.Name,
                i.ImageUrl,
                i.Tier,
                i.Description,
                i.Price,
                MinDelta = i.Variants.Where(v => v.IsActive).Min(v => (int?)v.PriceDelta)
            })
            .ToListAsync(ct);

        return Ok(items.Select(i => new MarqueeItemDto
        {
            Name = i.Name,
            ImageUrl = i.ImageUrl,
            Tier = i.Tier,
            Description = i.Description,
            Price = Math.Max(0, i.Price + (i.MinDelta ?? 0)),
            HasOptions = i.MinDelta != null
        }));
    }

    // The caller's shipping address, read live from Hack Club Auth, for the checkout's
    // confirm step. address is null when they haven't added one there yet.
    [Authorize]
    [HttpGet("address")]
    public async Task<IActionResult> Address(CancellationToken ct)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync([userId.Value], ct);
        if (user is null) return NotFound();

        var (address, error) = await LookupAddressAsync(user, ct);
        if (error is not null) return error;

        return Ok(new
        {
            address,
            region = address?.Region ?? ShopRegions.RegionFor(user.Country),
            editUrl = _hcaOptions.Authority
        });
    }

    // Buy an item. The address is re-read from HCA and copied onto the order, and the
    // region (so the price) comes from it. Retrying with the same clientRequestId returns
    // the first order instead of buying again.
    [Authorize]
    [PausedBy(SettingKeys.ShopPaused)]
    [EnableRateLimiting(ShopExtension.PurchasePolicy)]
    [HttpPost("purchase")]
    public async Task<IActionResult> Purchase([FromBody] PurchaseDto dto, CancellationToken ct)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        if (dto.ItemId is null) return BadRequest("ItemId is required!");
        if (dto.ClientRequestId is null || dto.ClientRequestId == Guid.Empty) return BadRequest("ClientRequestId is required!");
        var quantity = dto.Quantity ?? 1;
        if (quantity < 1 || quantity > ShopService.MaxQuantity) return BadRequest($"Quantity must be between 1 and {ShopService.MaxQuantity}.");
        if (dto.AddressConfirmed != true) return BadRequest("Confirm your shipping address first.");
        if (dto.Note?.Length > MaxNoteLength) return BadRequest($"Note can be at most {MaxNoteLength} characters.");

        var user = await _db.Users.FindAsync([userId.Value], ct);
        if (user is null) return NotFound();

        var denied = await _eligibility.DenyAsync(user, "order from the shop", ct);
        if (denied is not null) return denied;

        var (address, error) = await LookupAddressAsync(user, ct);
        if (error is not null) return error;
        if (address is null)
        {
            return Fail(400, "no_address", "Add a shipping address on Hack Club Auth before ordering.");
        }

        var result = await _shop.PurchaseAsync(user.Id,
            new PurchaseRequest(dto.ItemId.Value, dto.VariantId, quantity, dto.Note, dto.ClientRequestId.Value), address, ct);
        if (result.Order is not { } order) return Fail(result.Status, result.Code!, result.Error!);

        // A replayed request already sent its DM.
        if (!result.Replayed)
        {
            _slack.Send(user.SlackUserID, SlackMessages.ShopOrderPlaced(order.ItemName, order.Quantity, order.TotalPrice, _slackOptions.ShopUrl));
        }

        var volts = await _db.Users.AsNoTracking().Where(u => u.Id == user.Id).Select(u => u.Volts).FirstAsync(ct);
        return Ok(new { order = await ToOrderDtoAsync(order, ct), volts });
    }

    // The caller's orders, newest first.
    [Authorize]
    [HttpGet("orders")]
    public async Task<IActionResult> Orders(CancellationToken ct)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var orders = await _db.ShopOrders.AsNoTracking()
            .Where(o => o.UserId == userId.Value)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new ShopOrderDto
            {
                Id = o.Id,
                ShopItemId = o.ShopItemId,
                ItemName = o.ItemName,
                VariantName = o.VariantName,
                ImageUrl = _db.ShopItems.Where(i => i.Id == o.ShopItemId).Select(i => i.ImageUrl).FirstOrDefault(),
                Quantity = o.Quantity,
                UnitPrice = o.UnitPrice,
                TotalPrice = o.TotalPrice,
                ViaDaily = o.ViaDaily,
                Status = o.Status,
                TrackingReference = o.TrackingReference,
                UserNote = o.UserNote,
                CreatedAt = o.CreatedAt,
                FulfilledAt = o.FulfilledAt,
                RefundedAt = o.RefundedAt
            })
            .ToListAsync(ct);

        return Ok(orders);
    }

    // Cancel one of your own orders that hasn't shipped yet, for a full refund.
    [Authorize]
    [HttpPost("orders/{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _shop.RefundAsync(id, userId.Value, null, ownerId: userId.Value, ct);
        if (result.Order is not { } order) return Fail(result.Status, result.Code!, result.Error!);

        var volts = await _db.Users.AsNoTracking().Where(u => u.Id == userId.Value).Select(u => u.Volts).FirstAsync(ct);
        return Ok(new { order = await ToOrderDtoAsync(order, ct), volts });
    }

    // Reads the user's address from HCA. Saves any token refresh and the cached country.
    // Error is set when HCA couldn't be asked; Address is null when they have none there.
    private async Task<(ShopAddress? Address, IActionResult? Error)> LookupAddressAsync(User user, CancellationToken ct)
    {
        var info = await _hca.GetUserInfoAsync(user, ct);
        if (info.Claims is { } claims) HcaUserSync.Apply(user, claims);
        await _db.SaveChangesAsync(ct);

        if (info.Claims is not { } read)
        {
            return (null, info.Revoked
                ? Fail(401, "hca_revoked", "Your Hack Club Auth sign-in expired. Log out and back in, then try again.")
                : Fail(502, "hca_unreachable", "Couldn't reach Hack Club Auth to check your address. Please try again in a minute."));
        }

        return (ShopAddress.FromClaims(read), null);
    }

    private ObjectResult Fail(int status, string code, string error) =>
        StatusCode(status, new { error, code });

    private static ShopItemDto ToDto(ShopItem item, ShopContext ctx, Dictionary<Guid, int> owned)
    {
        var count = owned.GetValueOrDefault(item.Id);
        var variants = ShopService.ActiveVariants(item);
        var reason = ShopService.Unavailable(item, ctx, count);

        return new ShopItemDto
        {
            Id = item.Id,
            Name = item.Name,
            Description = item.Description,
            ImageUrl = item.ImageUrl,
            Tier = item.Tier,
            Price = variants.Count > 0
                ? variants.Min(v => ShopService.PriceFor(item, v, ctx.Region))
                : ShopService.PriceFor(item, null, ctx.Region),
            Stock = variants.Count > 0 ? null : item.Stock,
            MaxPerUser = item.MaxPerUser,
            Owned = count,
            RandomMode = item.RandomMode,
            Regions = item.Regions,
            Variants = variants
                .Select(v => new ShopVariantDto
                {
                    Id = v.Id,
                    Name = v.Name,
                    Price = ShopService.PriceFor(item, v, ctx.Region),
                    Stock = v.Stock
                })
                .ToList(),
            UnavailableReason = reason,
            UnavailableMessage = reason is null ? null : ShopService.Message(reason, item)
        };
    }

    private async Task<ShopOrderDto> ToOrderDtoAsync(ShopOrder o, CancellationToken ct) => new()
    {
        Id = o.Id,
        ShopItemId = o.ShopItemId,
        ItemName = o.ItemName,
        VariantName = o.VariantName,
        ImageUrl = o.ShopItemId is null
            ? null
            : await _db.ShopItems.Where(i => i.Id == o.ShopItemId).Select(i => i.ImageUrl).FirstOrDefaultAsync(ct),
        Quantity = o.Quantity,
        UnitPrice = o.UnitPrice,
        TotalPrice = o.TotalPrice,
        ViaDaily = o.ViaDaily,
        Status = o.Status,
        TrackingReference = o.TrackingReference,
        UserNote = o.UserNote,
        CreatedAt = o.CreatedAt,
        FulfilledAt = o.FulfilledAt,
        RefundedAt = o.RefundedAt
    };
}

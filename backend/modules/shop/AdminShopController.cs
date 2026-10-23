using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
using Torque.Slack;
// Admin-only shop management: items (one at a time or in bulk), the daily item, and the
// order fulfilment queue.
// endpoint: /api/admin/shop/<command>

namespace Torque.Shop;

[ApiController]
[Route("api/admin/shop")]
public class AdminShopController : ControllerBase
{
    private const int MaxNameLength = 120;
    private const int MaxDescriptionLength = 2000;
    private const int MaxUrlLength = 2048;
    private const int MaxNotesLength = 2000;
    private const int MaxVariantNameLength = 80;
    private const int MaxVariants = 50;
    private const int MaxPrice = 1_000_000;
    private const int MaxBulkItems = 200;
    private const int MaxOrders = 200;
    private const int MaxTrackingLength = 500;

    private readonly AppDbContext _db;
    private readonly ShopService _shop;
    private readonly SlackNotifier _slack;
    private readonly SlackOptions _slackOptions;

    public AdminShopController(AppDbContext db, ShopService shop, SlackNotifier slack, SlackOptions slackOptions)
    {
        _db = db;
        _shop = shop;
        _slack = slack;
        _slackOptions = slackOptions;
    }

    // Every item, active or not, by level then sort order.
    [Authorize]
    [HttpGet("items")]
    public async Task<IActionResult> ListItems(CancellationToken ct)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        var items = await _db.ShopItems.AsNoTracking()
            .Include(i => i.Variants)
            .OrderBy(i => i.Tier).ThenBy(i => i.SortOrder).ThenBy(i => i.Name)
            .ToListAsync(ct);
        var sold = await SoldCountsAsync(ct);

        return Ok(items.Select(i => AdminShopItemDto.From(i, sold.GetValueOrDefault(i.Id))));
    }

    [Authorize]
    [HttpGet("items/{id:guid}")]
    public async Task<IActionResult> GetItem(Guid id, CancellationToken ct)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        var item = await _db.ShopItems.AsNoTracking().Include(i => i.Variants).FirstOrDefaultAsync(i => i.Id == id, ct);
        if (item is null) return NotFound();

        var sold = await SoldCountsAsync(ct);
        return Ok(AdminShopItemDto.From(item, sold.GetValueOrDefault(item.Id)));
    }

    [Authorize]
    [HttpPost("items")]
    public async Task<IActionResult> CreateItem([FromBody] ShopItemInputDto dto, CancellationToken ct)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        var error = Validate(dto, existing: null);
        if (error is not null) return BadRequest(error);

        var item = new ShopItem();
        Apply(dto, item);
        _db.ShopItems.Add(item);
        await _db.SaveChangesAsync(ct);

        return Ok(AdminShopItemDto.From(item, 0));
    }

    // Adds many items at once. Every row is checked first; if any has a problem, nothing
    // is added and the response lists each bad row as { index, name, error }.
    [Authorize]
    [HttpPost("items/bulk")]
    public async Task<IActionResult> BulkCreate([FromBody] List<ShopItemInputDto>? items, CancellationToken ct)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        if (items is null || items.Count == 0) return BadRequest("Send at least one item.");
        if (items.Count > MaxBulkItems) return BadRequest($"At most {MaxBulkItems} items per bulk add.");

        var rows = items
            .Select((dto, index) => new { index, name = dto?.Name, error = dto is null ? "Row is empty." : Validate(dto, existing: null) })
            .Where(r => r.error is not null)
            .ToList();
        if (rows.Count > 0)
        {
            return BadRequest(new
            {
                error = rows.Count == 1 ? "1 row has a problem. Nothing was added." : $"{rows.Count} rows have problems. Nothing was added.",
                rows
            });
        }

        var created = items.Select(dto =>
        {
            var item = new ShopItem();
            Apply(dto, item);
            return item;
        }).ToList();
        _db.ShopItems.AddRange(created);
        await _db.SaveChangesAsync(ct);

        return Ok(created.Select(i => AdminShopItemDto.From(i, 0)));
    }

    // Replaces an item. Send every field: missing optional ones are cleared. Variants
    // with an id are kept and updated, ones without are added, and unlisted ones deleted
    // (their past orders keep the copied name).
    [Authorize]
    [HttpPut("items/{id:guid}")]
    public async Task<IActionResult> UpdateItem(Guid id, [FromBody] ShopItemInputDto dto, CancellationToken ct)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        var item = await _db.ShopItems.Include(i => i.Variants).FirstOrDefaultAsync(i => i.Id == id, ct);
        if (item is null) return NotFound();

        var error = Validate(dto, item);
        if (error is not null) return BadRequest(error);

        Apply(dto, item);
        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        var sold = await SoldCountsAsync(ct);
        return Ok(AdminShopItemDto.From(item, sold.GetValueOrDefault(item.Id)));
    }

    // Deletes an item nobody has ordered. One with orders is deactivated instead, so the
    // fulfilment queue keeps its link.
    [Authorize]
    [HttpDelete("items/{id:guid}")]
    public async Task<IActionResult> DeleteItem(Guid id, CancellationToken ct)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        var item = await _db.ShopItems.FirstOrDefaultAsync(i => i.Id == id, ct);
        if (item is null) return NotFound();

        if (await _db.ShopOrders.AnyAsync(o => o.ShopItemId == id, ct))
        {
            item.IsActive = false;
            item.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            return Ok(new { deleted = false, deactivated = true });
        }

        _db.ShopItems.Remove(item);
        await _db.SaveChangesAsync(ct);
        return Ok(new { deleted = true, deactivated = false });
    }

    // Today's daily item (rolled now if nobody has opened the shop yet) and recent picks.
    [Authorize]
    [HttpGet("daily")]
    public async Task<IActionResult> Daily([FromQuery] int? days, CancellationToken ct)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        var today = ShopService.TodayEastern();
        await _shop.GetOrCreateDailyAsync(today, ct);
        return Ok(await DailyResponseAsync(today, Math.Clamp(days ?? 14, 1, 90), ct));
    }

    // Sets today's daily item, or rerolls it at random when itemId is left out.
    [Authorize]
    [HttpPut("daily/today")]
    public async Task<IActionResult> SetDaily([FromBody] SetDailyDto dto, CancellationToken ct)
    {
        var (admin, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        if (dto.ItemId is { } itemId && !await _db.ShopItems.AnyAsync(i => i.Id == itemId && i.IsActive, ct))
        {
            return BadRequest("ItemId must reference an active item.");
        }

        var today = ShopService.TodayEastern();
        var chosen = await _shop.SetDailyAsync(today, dto.ItemId, admin!.Id, ct);
        if (chosen is null) return BadRequest("There's no other active, in-stock item that can be the daily item.");

        return Ok(await DailyResponseAsync(today, 14, ct));
    }

    // The fulfilment queue. status: pending (default) | fulfilled | refunded | all.
    // sort: oldest (default) | newest.
    [Authorize]
    [HttpGet("orders")]
    public async Task<IActionResult> ListOrders(
        [FromQuery] string? status, [FromQuery] Guid? itemId, [FromQuery] Guid? userId, [FromQuery] string? sort, CancellationToken ct)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        ShopOrderStatus? filter = null;
        if (string.IsNullOrEmpty(status)) filter = ShopOrderStatus.pending;
        else if (status != "all")
        {
            if (!Enum.TryParse<ShopOrderStatus>(status, out var parsed)) return BadRequest("Status must be pending, fulfilled, refunded or all.");
            filter = parsed;
        }

        var query = _db.ShopOrders.AsNoTracking()
            .Where(o => filter == null || o.Status == filter)
            .Where(o => itemId == null || o.ShopItemId == itemId)
            .Where(o => userId == null || o.UserId == userId);
        query = sort == "newest"
            ? query.OrderByDescending(o => o.CreatedAt)
            : query.OrderBy(o => o.CreatedAt);

        var orders = await query
            .Take(MaxOrders)
            .Select(o => new AdminShopOrderDto
            {
                Id = o.Id,
                UserId = o.UserId,
                Username = _db.Users.Where(u => u.Id == o.UserId).Select(u => u.Username).FirstOrDefault() ?? "",
                ShopItemId = o.ShopItemId,
                VariantId = o.VariantId,
                ItemName = o.ItemName,
                VariantName = o.VariantName,
                ImageUrl = _db.ShopItems.Where(i => i.Id == o.ShopItemId).Select(i => i.ImageUrl).FirstOrDefault(),
                Quantity = o.Quantity,
                UnitPrice = o.UnitPrice,
                TotalPrice = o.TotalPrice,
                Region = o.Region,
                ViaDaily = o.ViaDaily,
                Status = o.Status,
                UserNote = o.UserNote,
                TrackingReference = o.TrackingReference,
                AdminNote = o.AdminNote,
                FulfilledByUserId = o.FulfilledByUserId,
                FulfilledAt = o.FulfilledAt,
                RefundedAt = o.RefundedAt,
                CreatedAt = o.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(orders);
    }

    // One order with the shipping address the buyer confirmed.
    [Authorize]
    [HttpGet("orders/{id:guid}")]
    public async Task<IActionResult> GetOrder(Guid id, CancellationToken ct)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        var order = await _db.ShopOrders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == id, ct);
        if (order is null) return NotFound();

        return Ok(await ToDetailAsync(order, ct));
    }

    // Marks a pending order shipped and DMs the buyer.
    [Authorize]
    [HttpPost("orders/{id:guid}/fulfill")]
    public async Task<IActionResult> Fulfill(Guid id, [FromBody] FulfillOrderDto dto, CancellationToken ct)
    {
        var (admin, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        if (dto.TrackingReference?.Length > MaxTrackingLength) return BadRequest($"TrackingReference can be at most {MaxTrackingLength} characters.");
        if (dto.Note?.Length > MaxNotesLength) return BadRequest($"Note can be at most {MaxNotesLength} characters.");

        var result = await _shop.FulfillAsync(id, admin!.Id, dto.TrackingReference, dto.Note, ct);
        if (result.Order is not { } order) return StatusCode(result.Status, new { error = result.Error, code = result.Code });

        var buyer = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == order.UserId, ct);
        _slack.Send(buyer?.SlackUserID, SlackMessages.ShopOrderFulfilled(order.ItemName, order.Quantity, order.TrackingReference, _slackOptions.ShopUrl));

        return Ok(await ToDetailAsync(order, ct));
    }

    // Refunds an order (pending or already shipped): Volts go back to the buyer, stock
    // goes back if it hadn't shipped, and the buyer gets a DM with the reason.
    [Authorize]
    [HttpPost("orders/{id:guid}/refund")]
    public async Task<IActionResult> Refund(Guid id, [FromBody] RefundOrderDto dto, CancellationToken ct)
    {
        var (admin, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        if (string.IsNullOrWhiteSpace(dto.Reason)) return BadRequest("Reason is required!");
        if (dto.Reason.Length > MaxNotesLength) return BadRequest($"Reason can be at most {MaxNotesLength} characters.");

        var result = await _shop.RefundAsync(id, admin!.Id, dto.Reason, ownerId: null, ct);
        if (result.Order is not { } order) return StatusCode(result.Status, new { error = result.Error, code = result.Code });

        var buyer = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == order.UserId, ct);
        _slack.Send(buyer?.SlackUserID, SlackMessages.ShopOrderRefunded(order.ItemName, order.Quantity, order.TotalPrice, dto.Reason, _slackOptions.ShopUrl));

        return Ok(await ToDetailAsync(order, ct));
    }

    // Problems with an item body, or null when it's fine. `existing` is the item being
    // replaced, whose variant ids are the only ones a PUT may reference.
    private static string? Validate(ShopItemInputDto dto, ShopItem? existing)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return "Name is required!";
        if (dto.Name.Trim().Length > MaxNameLength) return $"Name can be at most {MaxNameLength} characters.";
        if (dto.Description?.Length > MaxDescriptionLength) return $"Description can be at most {MaxDescriptionLength} characters.";
        if (!string.IsNullOrWhiteSpace(dto.ImageUrl) && (dto.ImageUrl.Length > MaxUrlLength || !IsHttpUrl(dto.ImageUrl.Trim())))
        {
            return "ImageUrl must be an http(s) link.";
        }
        if (dto.Tier is null || dto.Tier < 1 || dto.Tier > 4) return "Tier must be between 1 and 4.";
        if (dto.Price is null || dto.Price < 0 || dto.Price > MaxPrice) return $"Price must be between 0 and {MaxPrice}.";

        if (dto.Regions is null || dto.Regions.Length == 0) return "Pick at least one region it ships to.";
        var badRegion = dto.Regions.FirstOrDefault(r => !ShopRegions.IsValid(r));
        if (badRegion is not null) return $"Unknown region \"{badRegion}\". Use {string.Join(", ", ShopRegions.All)}.";

        foreach (var (region, price) in dto.RegionalPrices ?? [])
        {
            if (!dto.Regions.Contains(region)) return $"Regional price for {region}, which the item doesn't ship to.";
            if (price < 0 || price > MaxPrice) return $"Regional price for {region} must be between 0 and {MaxPrice}.";
        }

        if (dto.Stock < 0) return "Stock can't be negative (leave it empty for unlimited).";
        if (dto.MaxPerUser < 1) return "MaxPerUser must be at least 1 (leave it empty for no limit).";
        if (dto.FulfillerNotes?.Length > MaxNotesLength) return $"FulfillerNotes can be at most {MaxNotesLength} characters.";

        var variants = dto.Variants ?? [];
        if (variants.Count > MaxVariants) return $"At most {MaxVariants} options per item.";
        foreach (var v in variants)
        {
            if (string.IsNullOrWhiteSpace(v.Name)) return "Every option needs a name.";
            if (v.Name.Trim().Length > MaxVariantNameLength) return $"Option names can be at most {MaxVariantNameLength} characters.";
            if (v.Stock < 0) return $"Option \"{v.Name.Trim()}\" can't have negative stock.";
            if (v.Id is { } id && existing?.Variants.Any(e => e.Id == id) != true) return $"Option \"{v.Name.Trim()}\" has an id that isn't one of this item's.";

            var delta = v.PriceDelta ?? 0;
            var lowest = Math.Min(dto.Price.Value, (dto.RegionalPrices ?? []).Values.DefaultIfEmpty(dto.Price.Value).Min());
            if (lowest + delta < 0) return $"Option \"{v.Name.Trim()}\" would make the price negative.";
        }
        var duplicate = variants.GroupBy(v => v.Name!.Trim(), StringComparer.OrdinalIgnoreCase).FirstOrDefault(g => g.Count() > 1);
        if (duplicate is not null) return $"Two options are named \"{duplicate.Key}\".";

        return null;
    }

    private void Apply(ShopItemInputDto dto, ShopItem item)
    {
        item.Name = dto.Name!.Trim();
        item.Description = dto.Description?.Trim() ?? "";
        item.ImageUrl = string.IsNullOrWhiteSpace(dto.ImageUrl) ? null : dto.ImageUrl.Trim();
        item.Tier = dto.Tier!.Value;
        item.Price = dto.Price!.Value;
        item.Regions = ShopRegions.All.Where(r => dto.Regions!.Contains(r)).ToArray();
        item.RegionalPrices = new Dictionary<string, int>(dto.RegionalPrices ?? []);
        item.Stock = dto.Stock;
        item.MaxPerUser = dto.MaxPerUser;
        item.RandomMode = dto.RandomMode ?? ShopRandomMode.eligible;
        item.IsActive = dto.IsActive ?? true;
        item.SortOrder = dto.SortOrder ?? 0;
        item.FulfillerNotes = string.IsNullOrWhiteSpace(dto.FulfillerNotes) ? null : dto.FulfillerNotes.Trim();

        var inputs = dto.Variants ?? [];
        var keep = inputs.Where(v => v.Id is not null).Select(v => v.Id!.Value).ToHashSet();
        foreach (var removed in item.Variants.Where(v => !keep.Contains(v.Id)).ToList())
        {
            item.Variants.Remove(removed);
            _db.ShopItemVariants.Remove(removed);
        }

        for (var i = 0; i < inputs.Count; i++)
        {
            var input = inputs[i];
            var variant = input.Id is { } id ? item.Variants.First(v => v.Id == id) : new ShopItemVariant();
            variant.Name = input.Name!.Trim();
            variant.PriceDelta = input.PriceDelta ?? 0;
            variant.Stock = input.Stock;
            variant.IsActive = input.IsActive ?? true;
            variant.SortOrder = input.SortOrder ?? i;
            if (input.Id is null) item.Variants.Add(variant);
        }
    }

    private static bool IsHttpUrl(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    private Task<Dictionary<Guid, int>> SoldCountsAsync(CancellationToken ct) =>
        _db.ShopOrders
            .Where(o => o.Status != ShopOrderStatus.refunded && o.ShopItemId != null)
            .GroupBy(o => o.ShopItemId!.Value)
            .Select(g => new { g.Key, Count = g.Sum(o => o.Quantity) })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

    private async Task<object> DailyResponseAsync(DateOnly today, int days, CancellationToken ct)
    {
        var since = today.AddDays(-(days - 1));
        var picks = await _db.DailyShopPicks.AsNoTracking()
            .Where(d => d.Date >= since)
            .OrderByDescending(d => d.Date)
            .Select(d => new
            {
                date = d.Date,
                itemId = d.ShopItemId,
                itemName = _db.ShopItems.Where(i => i.Id == d.ShopItemId).Select(i => i.Name).FirstOrDefault(),
                setByUserId = d.SetByUserId,
                createdAt = d.CreatedAt
            })
            .ToListAsync(ct);

        return new
        {
            today,
            endsAt = ShopService.NextRotationUtc(),
            current = picks.FirstOrDefault(p => p.date == today),
            picks
        };
    }

    private async Task<AdminShopOrderDto> ToDetailAsync(ShopOrder o, CancellationToken ct)
    {
        var buyer = await _db.Users.AsNoTracking()
            .Where(u => u.Id == o.UserId)
            .Select(u => new { u.Username, u.Email, u.SlackUserID })
            .FirstOrDefaultAsync(ct);
        var item = o.ShopItemId is null
            ? null
            : await _db.ShopItems.AsNoTracking()
                .Where(i => i.Id == o.ShopItemId)
                .Select(i => new { i.ImageUrl, i.FulfillerNotes })
                .FirstOrDefaultAsync(ct);

        return new AdminShopOrderDto
        {
            Id = o.Id,
            UserId = o.UserId,
            Username = buyer?.Username ?? "",
            UserEmail = buyer?.Email,
            UserSlackId = buyer?.SlackUserID,
            ShopItemId = o.ShopItemId,
            VariantId = o.VariantId,
            ItemName = o.ItemName,
            VariantName = o.VariantName,
            ImageUrl = item?.ImageUrl,
            Quantity = o.Quantity,
            UnitPrice = o.UnitPrice,
            TotalPrice = o.TotalPrice,
            Region = o.Region,
            ViaDaily = o.ViaDaily,
            Status = o.Status,
            UserNote = o.UserNote,
            TrackingReference = o.TrackingReference,
            AdminNote = o.AdminNote,
            FulfillerNotes = item?.FulfillerNotes,
            FulfilledByUserId = o.FulfilledByUserId,
            FulfilledAt = o.FulfilledAt,
            RefundedAt = o.RefundedAt,
            CreatedAt = o.CreatedAt,
            Address = new ShopAddress
            {
                Name = o.ShipName,
                Line1 = o.ShipLine1,
                Line2 = o.ShipLine2,
                City = o.ShipCity,
                State = o.ShipState,
                PostalCode = o.ShipPostalCode,
                Country = o.ShipCountry
            }
        };
    }
}

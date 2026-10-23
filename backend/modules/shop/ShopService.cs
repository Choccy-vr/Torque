using Microsoft.EntityFrameworkCore;
using Npgsql;
using Torque.Data;
using Torque.Payouts;

namespace Torque.Shop;

// What the buyer brings to an availability check: the highest level they've unlocked,
// their region, today's daily item and their balance.
public record ShopContext(int UnlockedTier, string Region, Guid? DailyItemId, int Volts);

// Outcome of a purchase / refund / fulfil. Error is null on success; Code is the
// machine-readable reason (see ShopService.Reasons) and Status the HTTP status to send.
// Replayed = a retried purchase that returned the order the first attempt placed.
public record ShopResult(ShopOrder? Order, int Status = 200, string? Error = null, string? Code = null, bool Replayed = false)
{
    public static ShopResult Fail(int status, string code, string error) => new(null, status, error, code);
}

public record PurchaseRequest(Guid ItemId, Guid? VariantId, int Quantity, string? Note, Guid ClientRequestId);

// Shop rules shared by the user and admin controllers. Unlocks: the highest level among
// the user's final-approved ships unlocks that level and every one below it. The daily
// item (rolled lazily per US Eastern day) skips the level lock for everyone.
public class ShopService
{
    public const int MaxQuantity = 10;
    // Picks from the last week are skipped when rolling, while anything else is eligible.
    private const int RecentPickDays = 7;

    public static readonly TimeZoneInfo Eastern = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");

    // Why an item can't be bought right now, in check order.
    public static class Reasons
    {
        public const string Inactive = "inactive";
        public const string RandomOnly = "random_only";
        public const string LockedTier = "locked_tier";
        public const string RegionUnavailable = "region_unavailable";
        public const string OutOfStock = "out_of_stock";
        public const string LimitReached = "limit_reached";
        public const string InsufficientVolts = "insufficient_volts";
    }

    private readonly AppDbContext _db;
    public ShopService(AppDbContext db) => _db = db;

    public static DateOnly TodayEastern(DateTime? utcNow = null) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utcNow ?? DateTime.UtcNow, Eastern));

    // When today's daily item rotates out: the next 12 AM Eastern, in UTC.
    public static DateTime NextRotationUtc(DateTime? utcNow = null)
    {
        var tomorrow = TodayEastern(utcNow).AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(tomorrow, Eastern);
    }

    public async Task<int> UnlockedTierAsync(Guid userId, CancellationToken ct = default)
    {
        var tiers = await _db.Shipments
            .Where(s => s.UserId == userId && s.FinalApprovedAt != null)
            .Select(s => s.OverrideTier > 0 ? s.OverrideTier : s.TierSnapshot)
            .ToListAsync(ct);
        return tiers.Count == 0 ? 0 : Math.Clamp(tiers.Max(), 0, 4);
    }

    // Quantity of each item the user holds across non-refunded orders (for MaxPerUser).
    public Task<Dictionary<Guid, int>> OwnedCountsAsync(Guid userId, CancellationToken ct = default) =>
        _db.ShopOrders
            .Where(o => o.UserId == userId && o.Status != ShopOrderStatus.refunded && o.ShopItemId != null)
            .GroupBy(o => o.ShopItemId!.Value)
            .Select(g => new { g.Key, Count = g.Sum(o => o.Quantity) })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

    // The daily item for `date`, rolling one if nobody has asked yet that day. Two
    // concurrent first requests both insert; ON CONFLICT keeps the first, and both read it
    // back. Null when there's nothing eligible to roll.
    public async Task<Guid?> GetOrCreateDailyAsync(DateOnly date, CancellationToken ct = default)
    {
        var existing = await _db.DailyShopPicks.AsNoTracking()
            .Where(d => d.Date == date)
            .Select(d => (Guid?)d.ShopItemId)
            .FirstOrDefaultAsync(ct);
        if (existing is not null) return existing;

        var rolled = await RollAsync(date, exclude: null, ct);
        if (rolled is null) return null;

        await _db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO daily_shop_picks (date, shop_item_id, created_at) VALUES ({date}, {rolled.Value}, {DateTime.UtcNow}) ON CONFLICT (date) DO NOTHING",
            ct);

        return await _db.DailyShopPicks.AsNoTracking()
            .Where(d => d.Date == date)
            .Select(d => (Guid?)d.ShopItemId)
            .FirstOrDefaultAsync(ct);
    }

    // Sets `date`'s daily item (an admin's pick, or a fresh roll when itemId is null).
    // Returns the item id, or null when nothing is eligible to roll.
    public async Task<Guid?> SetDailyAsync(DateOnly date, Guid? itemId, Guid adminId, CancellationToken ct = default)
    {
        var current = await _db.DailyShopPicks.FirstOrDefaultAsync(d => d.Date == date, ct);
        var chosen = itemId ?? await RollAsync(date, exclude: current?.ShopItemId, ct);
        if (chosen is null) return null;

        if (current is null)
        {
            _db.DailyShopPicks.Add(new DailyShopPick { Date = date, ShopItemId = chosen.Value, SetByUserId = adminId });
        }
        else
        {
            current.ShopItemId = chosen.Value;
            current.SetByUserId = adminId;
            current.CreatedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync(ct);
        return chosen;
    }

    // Uniformly random among active, in-stock items that may be rolled, preferring ones
    // that weren't picked in the last week.
    private async Task<Guid?> RollAsync(DateOnly date, Guid? exclude, CancellationToken ct)
    {
        var candidates = await _db.ShopItems.AsNoTracking()
            .Where(i => i.IsActive && i.RandomMode != ShopRandomMode.never && i.Id != exclude)
            .Where(i => i.Variants.Any(v => v.IsActive)
                ? i.Variants.Any(v => v.IsActive && (v.Stock == null || v.Stock > 0))
                : i.Stock == null || i.Stock > 0)
            .Select(i => i.Id)
            .ToListAsync(ct);
        if (candidates.Count == 0) return null;

        var since = date.AddDays(-RecentPickDays);
        var recent = await _db.DailyShopPicks.AsNoTracking()
            .Where(d => d.Date >= since && d.Date < date)
            .Select(d => d.ShopItemId)
            .ToListAsync(ct);
        var fresh = candidates.Except(recent).ToList();
        var pool = fresh.Count > 0 ? fresh : candidates;

        return pool[Random.Shared.Next(pool.Count)];
    }

    public static int PriceFor(ShopItem item, ShopItemVariant? variant, string region)
    {
        var basePrice = item.RegionalPrices.TryGetValue(region, out var regional) ? regional : item.Price;
        return Math.Max(0, basePrice + (variant?.PriceDelta ?? 0));
    }

    public static List<ShopItemVariant> ActiveVariants(ShopItem item) =>
        item.Variants.Where(v => v.IsActive).OrderBy(v => v.SortOrder).ThenBy(v => v.Name).ToList();

    // Why `item` can't be bought by this buyer, or null when it can. With a variant and
    // quantity it checks that exact purchase; without, whether any option is buyable.
    public static string? Unavailable(ShopItem item, ShopContext ctx, int owned, ShopItemVariant? variant = null, int quantity = 1)
    {
        if (!item.IsActive) return Reasons.Inactive;

        var isDaily = ctx.DailyItemId == item.Id;
        if (!isDaily && item.RandomMode == ShopRandomMode.random_only) return Reasons.RandomOnly;
        if (!isDaily && item.Tier > ctx.UnlockedTier) return Reasons.LockedTier;
        if (!item.Regions.Contains(ctx.Region)) return Reasons.RegionUnavailable;

        var variants = ActiveVariants(item);
        List<ShopItemVariant?> options = variant is not null
            ? [variant]
            : variants.Count > 0 ? variants.Cast<ShopItemVariant?>().ToList() : [null];

        var inStock = options
            .Where(v => (v is null ? item.Stock : v.Stock) is not { } stock || stock >= quantity)
            .ToList();
        if (inStock.Count == 0) return Reasons.OutOfStock;

        if (item.MaxPerUser is { } max && owned + quantity > max) return Reasons.LimitReached;

        if (inStock.Min(v => PriceFor(item, v, ctx.Region)) * quantity > ctx.Volts) return Reasons.InsufficientVolts;

        return null;
    }

    public static string Message(string reason, ShopItem item) => reason switch
    {
        Reasons.Inactive => "This item isn't available anymore.",
        Reasons.RandomOnly => "This item can only be bought on a day it's the random item.",
        Reasons.LockedTier => $"Ship an approved Level {item.Tier} project to unlock this item.",
        Reasons.RegionUnavailable => "This item doesn't ship to your region.",
        Reasons.OutOfStock => "This item is out of stock.",
        Reasons.LimitReached => item.MaxPerUser == 1
            ? "You can only get one of these."
            : $"You can only get {item.MaxPerUser} of these.",
        Reasons.InsufficientVolts => "You don't have enough Volts for this.",
        _ => "This item can't be bought right now."
    };

    // Buys an item. The client never sends a price: everything is recomputed here while
    // the item row is locked, so concurrent purchases of the same item queue up, and the
    // balance / stock debits are conditional updates that can't go below zero.
    public async Task<ShopResult> PurchaseAsync(Guid userId, PurchaseRequest req, ShopAddress address, CancellationToken ct = default)
    {
        // Rolled before the transaction so a rollback can't discard today's pick.
        var today = TodayEastern();
        var dailyItemId = await GetOrCreateDailyAsync(today, ct);
        var unlockedTier = await UnlockedTierAsync(userId, ct);

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var item = await _db.ShopItems
            .FromSql($"SELECT * FROM shop_items WHERE id = {req.ItemId} FOR UPDATE")
            .FirstOrDefaultAsync(ct);
        if (item is null) return ShopResult.Fail(404, Reasons.Inactive, "That item doesn't exist.");
        await _db.Entry(item).Collection(i => i.Variants).LoadAsync(ct);

        // A retry of a request that already went through (checked under the item lock,
        // so a concurrent duplicate waits for the first, then finds its order).
        var duplicate = await _db.ShopOrders.AsNoTracking()
            .FirstOrDefaultAsync(o => o.UserId == userId && o.ClientRequestId == req.ClientRequestId, ct);
        if (duplicate is not null) return new ShopResult(duplicate, Replayed: true);

        if (TodayEastern() != today)
        {
            return ShopResult.Fail(409, "daily_rotated", "The random item just changed. Refresh the shop and try again.");
        }

        var variants = ActiveVariants(item);
        ShopItemVariant? variant = null;
        if (variants.Count > 0)
        {
            variant = variants.FirstOrDefault(v => v.Id == req.VariantId);
            if (variant is null) return ShopResult.Fail(400, "variant_required", "Pick one of this item's options.");
        }
        else if (req.VariantId is not null)
        {
            return ShopResult.Fail(400, "variant_required", "This item has no options to pick.");
        }

        var volts = await _db.Users.Where(u => u.Id == userId).Select(u => u.Volts).FirstAsync(ct);
        var owned = await _db.ShopOrders
            .Where(o => o.UserId == userId && o.ShopItemId == item.Id && o.Status != ShopOrderStatus.refunded)
            .SumAsync(o => o.Quantity, ct);
        var ctx = new ShopContext(unlockedTier, address.Region, dailyItemId, volts);

        var reason = Unavailable(item, ctx, owned, variant, req.Quantity);
        if (reason is not null)
        {
            var status = reason is Reasons.InsufficientVolts or Reasons.OutOfStock or Reasons.LimitReached ? 409 : 403;
            return ShopResult.Fail(status, reason, Message(reason, item));
        }

        var unitPrice = PriceFor(item, variant, address.Region);
        var total = unitPrice * req.Quantity;

        var debited = await _db.Users
            .Where(u => u.Id == userId && u.Volts >= total)
            .ExecuteUpdateAsync(u => u.SetProperty(x => x.Volts, x => x.Volts - total), ct);
        if (debited == 0) return ShopResult.Fail(409, Reasons.InsufficientVolts, Message(Reasons.InsufficientVolts, item));

        var stocked = variant is not null
            ? variant.Stock is null || await _db.ShopItemVariants
                .Where(v => v.Id == variant.Id && v.Stock >= req.Quantity)
                .ExecuteUpdateAsync(v => v.SetProperty(x => x.Stock, x => x.Stock - req.Quantity), ct) > 0
            : item.Stock is null || await _db.ShopItems
                .Where(i => i.Id == item.Id && i.Stock >= req.Quantity)
                .ExecuteUpdateAsync(i => i.SetProperty(x => x.Stock, x => x.Stock - req.Quantity), ct) > 0;
        if (!stocked) return ShopResult.Fail(409, Reasons.OutOfStock, Message(Reasons.OutOfStock, item));

        var order = new ShopOrder
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ShopItemId = item.Id,
            VariantId = variant?.Id,
            ItemName = item.Name,
            VariantName = variant?.Name,
            Quantity = req.Quantity,
            UnitPrice = unitPrice,
            TotalPrice = total,
            Region = address.Region,
            ViaDaily = dailyItemId == item.Id,
            ShipName = address.Name,
            ShipLine1 = address.Line1,
            ShipLine2 = address.Line2,
            ShipCity = address.City,
            ShipState = address.State,
            ShipPostalCode = address.PostalCode,
            ShipCountry = address.Country,
            UserNote = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim(),
            ClientRequestId = req.ClientRequestId,
        };
        _db.ShopOrders.Add(order);
        _db.LedgerEntries.Add(new LedgerEntry
        {
            UserId = userId,
            Amount = -total,
            Kind = LedgerEntryKind.shop_purchase,
            Reason = $"Shop: {Label(order)}",
            OrderId = order.Id,
            CreatedByUserId = userId,
        });

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            await tx.RollbackAsync(ct);
            _db.ChangeTracker.Clear();
            var first = await _db.ShopOrders.AsNoTracking()
                .FirstOrDefaultAsync(o => o.UserId == userId && o.ClientRequestId == req.ClientRequestId, ct);
            return first is not null
                ? new ShopResult(first, Replayed: true)
                : ShopResult.Fail(409, "conflict", "That order couldn't be placed. Please try again.");
        }
        await tx.CommitAsync(ct);

        return new ShopResult(order);
    }

    // Refunds an order: Volts back to the buyer, and stock back if it never shipped. The
    // status flip is a conditional update, so an order is refunded at most once.
    // ownerId limits it to the buyer's own pending orders (self-cancel).
    public async Task<ShopResult> RefundAsync(Guid orderId, Guid actorId, string? reason, Guid? ownerId, CancellationToken ct = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var order = await _db.ShopOrders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null || (ownerId is not null && order.UserId != ownerId)) return ShopResult.Fail(404, "not_found", "Order not found.");

        var refundable = ownerId is null
            ? order.Status is ShopOrderStatus.pending or ShopOrderStatus.fulfilled
            : order.Status is ShopOrderStatus.pending;
        if (!refundable)
        {
            return ShopResult.Fail(409, "not_refundable", ownerId is null
                ? "This order was already refunded."
                : "Only orders that haven't shipped yet can be cancelled.");
        }

        var now = DateTime.UtcNow;
        var note = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        var claimed = await _db.ShopOrders
            .Where(o => o.Id == orderId && o.Status == order.Status)
            .ExecuteUpdateAsync(o => o
                .SetProperty(x => x.Status, ShopOrderStatus.refunded)
                .SetProperty(x => x.RefundedAt, now)
                .SetProperty(x => x.AdminNote, x => note ?? x.AdminNote), ct);
        if (claimed == 0) return ShopResult.Fail(409, "not_refundable", "This order just changed. Refresh and try again.");

        await _db.Users
            .Where(u => u.Id == order.UserId)
            .ExecuteUpdateAsync(u => u.SetProperty(x => x.Volts, x => x.Volts + order.TotalPrice), ct);

        // A shipped item isn't coming back, so only a pending order restocks.
        if (order.Status == ShopOrderStatus.pending)
        {
            if (order.VariantId is { } variantId)
            {
                await _db.ShopItemVariants
                    .Where(v => v.Id == variantId && v.Stock != null)
                    .ExecuteUpdateAsync(v => v.SetProperty(x => x.Stock, x => x.Stock + order.Quantity), ct);
            }
            else if (order.ShopItemId is { } itemId)
            {
                await _db.ShopItems
                    .Where(i => i.Id == itemId && i.Stock != null)
                    .ExecuteUpdateAsync(i => i.SetProperty(x => x.Stock, x => x.Stock + order.Quantity), ct);
            }
        }

        _db.LedgerEntries.Add(new LedgerEntry
        {
            UserId = order.UserId,
            Amount = order.TotalPrice,
            Kind = LedgerEntryKind.shop_refund,
            Reason = ownerId is null
                ? $"Shop refund: {Label(order)}" + (note is null ? "" : $" ({note})")
                : $"Shop order cancelled: {Label(order)}",
            OrderId = order.Id,
            CreatedByUserId = actorId,
        });
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new ShopResult(await _db.ShopOrders.AsNoTracking().FirstAsync(o => o.Id == orderId, ct));
    }

    // Marks a pending order shipped.
    public async Task<ShopResult> FulfillAsync(Guid orderId, Guid adminId, string? trackingReference, string? note, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var tracking = string.IsNullOrWhiteSpace(trackingReference) ? null : trackingReference.Trim();
        var adminNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();

        var claimed = await _db.ShopOrders
            .Where(o => o.Id == orderId && o.Status == ShopOrderStatus.pending)
            .ExecuteUpdateAsync(o => o
                .SetProperty(x => x.Status, ShopOrderStatus.fulfilled)
                .SetProperty(x => x.FulfilledAt, now)
                .SetProperty(x => x.FulfilledByUserId, adminId)
                .SetProperty(x => x.TrackingReference, tracking)
                .SetProperty(x => x.AdminNote, x => adminNote ?? x.AdminNote), ct);

        var order = await _db.ShopOrders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return ShopResult.Fail(404, "not_found", "Order not found.");
        if (claimed == 0) return ShopResult.Fail(409, "not_pending", $"This order is already {order.Status}.");

        return new ShopResult(order);
    }

    private static string Label(ShopOrder order) =>
        (order.Quantity > 1 ? $"{order.Quantity}× " : "")
        + order.ItemName
        + (order.VariantName is null ? "" : $" ({order.VariantName})");
}

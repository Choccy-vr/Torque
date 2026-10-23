using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Shop;
// Dev-only shop hooks for the test harness
// endpoint: /testing/shop/purchase, /testing/shop/daily

namespace Torque.Testing;

// Purchases need the buyer's address from HCA; this runs the same ShopService purchase
// with a fake address in `country` instead, as the signed-in user (or `userId`, so the
// harness can race several buys against one item without signing in as everyone).
public record ShopPurchaseTestRequest(
    Guid ItemId, Guid? VariantId = null, int Quantity = 1, Guid? ClientRequestId = null, string? Country = "US", Guid? UserId = null);

// Pins `date`'s (default today's, US Eastern) daily item, or rerolls it when ItemId is null.
public record ShopDailyTestRequest(Guid? ItemId = null, DateOnly? Date = null);

public static class ShopTesting
{
    public static void MapShopTesting(this WebApplication app)
    {
        app.MapPost("/testing/shop/purchase", async (
            ShopPurchaseTestRequest body, ClaimsPrincipal principal, ShopService shop, AppDbContext db, CancellationToken ct) =>
        {
            var userId = body.UserId ?? (Guid.TryParse(principal.FindFirst("sub")?.Value, out var id) ? id : (Guid?)null);
            if (userId is null) return Results.Unauthorized();
            if (!await db.Users.AnyAsync(u => u.Id == userId, ct)) return Results.NotFound("No such user.");

            var address = new ShopAddress
            {
                Name = "Test Buyer",
                Line1 = "15 Falls Rd",
                City = "Shelburne",
                State = "VT",
                PostalCode = "05482",
                Country = body.Country ?? "US"
            };
            var result = await shop.PurchaseAsync(userId.Value,
                new PurchaseRequest(body.ItemId, body.VariantId, body.Quantity, "test purchase", body.ClientRequestId ?? Guid.NewGuid()),
                address, ct);

            var volts = await db.Users.Where(u => u.Id == userId).Select(u => u.Volts).FirstAsync(ct);
            return result.Order is { } order
                ? Results.Ok(new { orderId = order.Id, order.TotalPrice, order.Region, order.ViaDaily, replayed = result.Replayed, volts })
                : Results.Json(new { error = result.Error, code = result.Code, volts }, statusCode: result.Status);
        });

        app.MapPost("/testing/shop/daily", async (
            ShopDailyTestRequest body, ClaimsPrincipal principal, ShopService shop, CancellationToken ct) =>
        {
            Guid.TryParse(principal.FindFirst("sub")?.Value, out var adminId);
            var date = body.Date ?? ShopService.TodayEastern();
            var chosen = await shop.SetDailyAsync(date, body.ItemId, adminId, ct);
            return chosen is null
                ? Results.BadRequest("Nothing eligible to roll.")
                : Results.Ok(new { date, itemId = chosen });
        });
    }
}

using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Torque.Shop;

public static class ShopExtension
{
    public const string PurchasePolicy = "shop-purchase";

    public static IServiceCollection AddShop(this IServiceCollection services)
    {
        services.AddScoped<ShopService>();

        services.AddRateLimiter(rateLimiterOptions =>
        {
            rateLimiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Each purchase reads the buyer's address from HCA, so keep bursts small.
            rateLimiterOptions.AddPolicy(PurchasePolicy, httpContext => RateLimitPartition.GetFixedWindowLimiter(
                httpContext.User.FindFirst("sub")?.Value ?? httpContext.Connection.RemoteIpAddress?.ToString() ?? "anon",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });

        return services;
    }
}

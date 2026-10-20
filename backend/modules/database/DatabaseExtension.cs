using Microsoft.EntityFrameworkCore;
using Npgsql;
using Torque.Data;

namespace Torque.Database;

public static class DatabaseExtension
{
    public static IServiceCollection AddAppDatabase(this IServiceCollection services, IConfiguration config)
    {
        string connectionString = (config["DB_CONNECTION_STRING"] is { Length: > 0 } cs ? cs : null)
            ?? FromUrl(config["DATABASE_URL"])
            ?? throw new InvalidOperationException("Missing DB_CONNECTION_STRING (or DATABASE_URL)");
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(connectionString)
                   .UseSnakeCaseNamingConvention());
        return services;
    }

    // Hosting platforms hand out postgres://user:pass@host:port/db?sslmode=require URLs,
    // which Npgsql doesn't parse, so turn one into a key=value connection string
    private static string? FromUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;

        var uri = new Uri(url);
        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
        };

        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var kv = pair.Split('=', 2);
            if (kv.Length == 2 && kv[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase)
                && Enum.TryParse<SslMode>(Uri.UnescapeDataString(kv[1]).Replace("-", ""), true, out var mode))
            {
                builder.SslMode = mode;
            }
        }

        return builder.ConnectionString;
    }
}

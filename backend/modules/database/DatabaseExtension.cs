using Microsoft.EntityFrameworkCore;
using Torque.Data;

namespace Torque.Database;

public static class DatabaseExtension
{
    public static IServiceCollection AddAppDatabase(this IServiceCollection services, IConfiguration config)
    {
        string connectionString = config["DB_CONNECTION_STRING"] ?? throw new InvalidOperationException("Missing DB_CONNECTION_STRING");
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(connectionString)
                   .UseSnakeCaseNamingConvention());
        return services;
    }
}
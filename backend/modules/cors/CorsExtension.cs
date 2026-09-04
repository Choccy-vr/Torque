namespace Torque.Extensions;

public static class CorsExtensions
{
    public const string FrontendPolicy = "Frontend";

    public static IServiceCollection AddFrontendCors(this IServiceCollection services, IConfiguration config)
    {
        string frontendUrl = config["FRONTEND_URL"]
            ?? throw new InvalidOperationException("Missing FRONTEND_URL");

        services.AddCors(options =>
        {
            options.AddPolicy(FrontendPolicy, policy =>
            {
                policy.WithOrigins(frontendUrl)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });

        return services;
    }
}
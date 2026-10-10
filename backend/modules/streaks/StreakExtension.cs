namespace Torque.Streaks;

public static class StreakExtension
{
    public static IServiceCollection AddStreaks(this IServiceCollection services)
    {
        services.AddScoped<StreakService>();
        // Singleton + hosted so the dev-only test harness can trigger a pass on demand.
        services.AddSingleton<StreakWorker>();
        services.AddHostedService(sp => sp.GetRequiredService<StreakWorker>());

        return services;
    }
}

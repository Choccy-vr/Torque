namespace Torque.Settings;

public static class SettingsExtension
{
    public static IServiceCollection AddSettings(this IServiceCollection services)
    {
        services.AddScoped<SettingsService>();
        return services;
    }
}

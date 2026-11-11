namespace Torque.Status;

public static class StatusExtension
{
    // Call after every integration is added: the checks read their options.
    public static IServiceCollection AddModuleStatus(this IServiceCollection services)
    {
        // Each check sets its own timeout; this is only a backstop.
        services.AddHttpClient<ModuleStatusService>(http => http.Timeout = TimeSpan.FromSeconds(15));
        return services;
    }
}

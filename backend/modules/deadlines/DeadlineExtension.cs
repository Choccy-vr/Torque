namespace Torque.Deadlines;

public static class DeadlineExtension
{
    public static IServiceCollection AddDeadlines(this IServiceCollection services)
    {
        services.AddScoped<ShipWindowService>();

        return services;
    }
}

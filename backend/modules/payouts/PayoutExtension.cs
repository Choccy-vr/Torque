namespace Torque.Payouts;

public static class PayoutExtension
{
    public static IServiceCollection AddPayouts(this IServiceCollection services)
    {
        services.AddScoped<PayoutService>();

        return services;
    }
}

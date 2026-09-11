namespace Torque.Lapse;

public static class LapseExtension
{
    public static IServiceCollection AddLapse(this IServiceCollection services, IConfiguration config)
    {
        var options = new LapseOptions
        {
            BaseUrl = (config["LAPSE_BASE_URL"] ?? "https://lapse.hackclub.com").TrimEnd('/'),
            ProgramKey = config["LAPSE_PROGRAM_KEY"]
        };

        if (string.IsNullOrEmpty(options.ProgramKey))
        {
            Console.WriteLine("[Lapse] LAPSE_PROGRAM_KEY not set — Lapse integration disabled");
        }

        services.AddSingleton(options);
        services.AddMemoryCache();
        services.AddHttpClient<LapseService>();

        return services;
    }
}

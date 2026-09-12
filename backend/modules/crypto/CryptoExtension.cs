namespace Torque.Crypto;

public static class CryptoExtension
{
    public static IServiceCollection AddTokenEncryption(this IServiceCollection services, IConfiguration config)
    {
        var key = config["TOKEN_ENCRYPTION_KEY"]
            ?? throw new InvalidOperationException("Missing TOKEN_ENCRYPTION_KEY");

        services.AddSingleton(new TokenEncryptor(key));
        return services;
    }
}

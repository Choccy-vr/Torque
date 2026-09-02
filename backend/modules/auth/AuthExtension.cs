using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace Torque.Auth;

public static class AuthExtension
{
    public static IServiceCollection AddSupabaseAuth(this IServiceCollection services, IConfiguration config)
    {
        string jwtSecret = config["SUPABASE_JWT_SECRET"]
            ?? throw new InvalidOperationException("Missing SUPABASE_JWT_SECRET");
        string supabaseUrl = config["SUPABASE_URL"]
            ?? throw new InvalidOperationException("Missing SUPABASE_URL");

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
        {
            // Keep JWT claim names as-is. Without this, `sub` is rewritten to
            // ClaimTypes.NameIdentifier and ControllerExtension.GetUserId() finds nothing.
            options.MapInboundClaims = false;

            // Supabase signs user tokens with a rotating asymmetric key (ES256) and publishes
            // it as JWKS, so the keys have to be discovered rather than configured. The legacy
            // symmetric secret below still validates older HS256 tokens; both are tried.
            options.MetadataAddress = $"{supabaseUrl}/auth/v1/.well-known/openid-configuration";
            options.RequireHttpsMetadata = supabaseUrl.StartsWith("https", StringComparison.OrdinalIgnoreCase);

            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = $"{supabaseUrl}/auth/v1",
                ValidateAudience = true,
                ValidAudience = "authenticated",
                ValidateLifetime = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
                ValidateIssuerSigningKey = true

            };
        });

        return services;
    }
}
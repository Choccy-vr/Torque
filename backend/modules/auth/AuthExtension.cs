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
        services.AddAuthentication();

        return services;
    }
}
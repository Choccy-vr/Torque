using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;


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
            options.MapInboundClaims = false;

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
            options.Events = new JwtBearerEvents
            {
                OnTokenValidated = context =>
                {
                    var token = (JwtSecurityToken)context.SecurityToken;
                    var identity = (ClaimsIdentity)context.Principal!.Identity!;

                    var metadataClaim = token.Payload.TryGetValue("user_metadata", out var raw)
                        ? raw?.ToString()
                        : null;

                    if (!string.IsNullOrEmpty(metadataClaim))
                    {
                        using var doc = JsonDocument.Parse(metadataClaim);
                        foreach (var prop in doc.RootElement.EnumerateObject())
                        {
                            if (prop.Value.ValueKind == JsonValueKind.String)
                                identity.AddClaim(new Claim($"user_metadata:{prop.Name}", prop.Value.GetString()!));
                        }
                    }

                    return Task.CompletedTask;
                }
            };
        });

        return services;
    }
}
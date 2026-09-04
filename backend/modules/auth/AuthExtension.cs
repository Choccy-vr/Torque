using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
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
                    var token = (JsonWebToken)context.SecurityToken;
                    var identity = (ClaimsIdentity)context.Principal!.Identity!;

                    if (token.TryGetPayloadValue("user_metadata", out JsonElement metadata)
                        && metadata.ValueKind == JsonValueKind.Object)
                    {
                        AddClaimsFromJson(identity, "user_metadata", metadata);
                    }

                    return Task.CompletedTask;
                }
            };
        });

        return services;
    }

    private static void AddClaimsFromJson(ClaimsIdentity identity, string prefix, JsonElement element)
    {
        foreach (var prop in element.EnumerateObject())
        {
            var claimType = $"{prefix}:{prop.Name}";
            switch (prop.Value.ValueKind)
            {
                case JsonValueKind.Object:
                    AddClaimsFromJson(identity, claimType, prop.Value);
                    break;
                case JsonValueKind.String:
                    identity.AddClaim(new Claim(claimType, prop.Value.GetString()!));
                    break;
                case JsonValueKind.True:
                case JsonValueKind.False:
                    identity.AddClaim(new Claim(claimType, prop.Value.GetBoolean() ? "true" : "false"));
                    break;
                case JsonValueKind.Number:
                    identity.AddClaim(new Claim(claimType, prop.Value.GetRawText()));
                    break;
            }
        }
    }
}
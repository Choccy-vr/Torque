using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Torque.Data;
using Torque.Slack;
using Torque.Users;

namespace Torque.Auth;

// Sign-in is Hack Club Auth over OIDC, run by the backend itself: /auth/login sends the
// browser to HCA, HCA returns to /auth/callback, and the backend upserts the users row
// and sets an HttpOnly session cookie. The cookie only carries `sub` = users.Id; the
// rest of the profile lives in Postgres and is re-synced from HCA every ResyncInterval.
public static class AuthExtension
{
    public const string HcaScheme = "hca";
    public const string CookieName = "torque_session";

    // Cookie auth means a cross-site form could ride the session, so every unsafe request
    // carrying the cookie must also send this header. Browsers only let a page set custom
    // headers cross-origin after a CORS preflight, which only FRONTEND_URL passes.
    public const string CsrfHeader = "X-Torque-Request";

    private static readonly TimeSpan ResyncInterval = TimeSpan.FromMinutes(15);
    private const string SyncedAtKey = "hca_synced_at";

    public static IServiceCollection AddHackClubAuth(this IServiceCollection services, IConfiguration config)
    {
        var options = new HcaOptions
        {
            Authority = (config["HCA_URL"] is { Length: > 0 } url ? url : "https://auth.hackclub.com").TrimEnd('/'),
            ClientId = config["HCA_CLIENT_ID"] is { Length: > 0 } id ? id : throw new InvalidOperationException("Missing HCA_CLIENT_ID"),
            ClientSecret = config["HCA_CLIENT_SECRET"] is { Length: > 0 } secret ? secret : throw new InvalidOperationException("Missing HCA_CLIENT_SECRET"),
            FrontendUrl = (config["FRONTEND_URL"] ?? throw new InvalidOperationException("Missing FRONTEND_URL")).TrimEnd('/'),
        };
        if (config["HCA_SCOPES"] is { Length: > 0 } scopes)
        {
            options.Scopes = scopes.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        }

        services.AddSingleton(options);
        services.AddHttpClient<HcaClient>();
        services.AddScoped<YswsEligibility>();

        // Keys that sign the session cookie, kept in Postgres so a restart or a second
        // instance doesn't sign everyone out.
        services.AddDataProtection()
            .SetApplicationName("torque")
            .PersistKeysToDbContext<AppDbContext>();

        services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(cookie =>
            {
                cookie.Cookie.Name = CookieName;
                cookie.Cookie.HttpOnly = true;
                cookie.Cookie.SameSite = SameSiteMode.Lax;
                cookie.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                cookie.ExpireTimeSpan = TimeSpan.FromDays(7);
                cookie.SlidingExpiration = true;

                // This is an API: answer with status codes, never redirect to a login page.
                cookie.Events.OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                cookie.Events.OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
                cookie.Events.OnValidatePrincipal = ResyncFromHcaAsync;
            })
            .AddOpenIdConnect(HcaScheme, oidc =>
            {
                oidc.Authority = options.Authority;
                oidc.ClientId = options.ClientId;
                oidc.ClientSecret = options.ClientSecret;
                oidc.ResponseType = OpenIdConnectResponseType.Code;
                // Query rather than the default form_post: a cross-site POST back from HCA
                // wouldn't carry the SameSite=Lax correlation cookies.
                oidc.ResponseMode = OpenIdConnectResponseMode.Query;
                oidc.UsePkce = true;
                oidc.CallbackPath = "/auth/callback";
                oidc.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                oidc.RequireHttpsMetadata = options.Authority.StartsWith("https", StringComparison.OrdinalIgnoreCase);

                oidc.Scope.Clear();
                foreach (var scope in options.Scopes) oidc.Scope.Add(scope);

                // Tokens are stored (encrypted) on the users row instead of in the cookie,
                // and the principal is replaced wholesale below, so no claim mapping.
                oidc.SaveTokens = false;
                oidc.GetClaimsFromUserInfoEndpoint = false;
                oidc.MapInboundClaims = false;
                oidc.ClaimActions.Clear();

                oidc.CorrelationCookie.SameSite = SameSiteMode.Lax;
                oidc.CorrelationCookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                oidc.NonceCookie.SameSite = SameSiteMode.Lax;
                oidc.NonceCookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;

                oidc.Events.OnTokenValidated = SignInFromHcaAsync;
                // Denied consent, a stale login link, HCA down: back to the landing page
                // instead of an exception page.
                oidc.Events.OnRemoteFailure = context =>
                {
                    context.HttpContext.RequestServices.GetRequiredService<ILogger<HcaOptions>>()
                        .LogWarning(context.Failure, "HCA sign-in failed");
                    context.Response.Redirect($"{options.FrontendUrl}/?login=failed");
                    context.HandleResponse();
                    return Task.CompletedTask;
                };
            });

        return services;
    }

    // Behind a TLS-terminating proxy the app sees plain http; trust X-Forwarded-Proto so
    // the OIDC redirect_uri and the cookie's Secure flag use https. Only the scheme is
    // forwarded, so a spoofed header can't change the client IP the rate limiters use.
    public static WebApplication UseForwardedProto(this WebApplication app)
    {
        var forwarded = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedProto };
        forwarded.KnownIPNetworks.Clear();
        forwarded.KnownProxies.Clear();
        app.UseForwardedHeaders(forwarded);
        return app;
    }

    public static WebApplication UseCsrfHeaderCheck(this WebApplication app)
    {
        app.Use(async (context, next) =>
        {
            var method = context.Request.Method;
            var safe = HttpMethods.IsGet(method) || HttpMethods.IsHead(method)
                || HttpMethods.IsOptions(method) || HttpMethods.IsTrace(method);

            if (!safe && context.Request.Cookies.ContainsKey(CookieName)
                && !context.Request.Headers.ContainsKey(CsrfHeader))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { error = $"Missing {CsrfHeader} header." });
                return;
            }

            await next();
        });
        return app;
    }

    // Runs on the /auth/callback request once HCA's id_token checks out. Existing users
    // are found by their HCA `sub` (users created under Supabase keep their old ids).
    private static async Task SignInFromHcaAsync(TokenValidatedContext context)
    {
        var services = context.HttpContext.RequestServices;
        var db = services.GetRequiredService<AppDbContext>();
        var hca = services.GetRequiredService<HcaClient>();

        var hcaSub = context.Principal?.FindFirst("sub")?.Value;
        var tokens = context.TokenEndpointResponse;
        if (string.IsNullOrEmpty(hcaSub) || tokens is null)
        {
            context.Fail("HCA returned no subject or tokens");
            return;
        }

        var claims = await hca.GetUserInfoAsync(tokens.AccessToken, context.HttpContext.RequestAborted);
        if (claims is null || HcaUserSync.Str(claims.Value, "sub") != hcaSub)
        {
            context.Fail("Couldn't read the HCA userinfo for this sign-in");
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.HcUserID == hcaSub);
        var isNew = user is null;
        if (user is null)
        {
            var name = HcaUserSync.Str(claims.Value, "name") ?? "";
            user = new User
            {
                Id = Guid.NewGuid(),
                HcUserID = hcaSub,
                Email = "",
                Name = name,
                Username = name,
                Bio = "",
                SlackUserID = "",
                HackatimeID = "",
            };
            db.Users.Add(user);
        }

        HcaUserSync.Apply(user, claims.Value);
        if (isNew) await ApplySlackProfileAsync(user, services);
        HcaClient.StoreTokens(user, tokens.AccessToken, tokens.RefreshToken, tokens.ExpiresIn);
        await db.SaveChangesAsync(context.HttpContext.RequestAborted);

        context.Principal = SessionPrincipal(user.Id);
        context.Properties!.SetString(SyncedAtKey, DateTimeOffset.UtcNow.ToString("O"));
    }

    // New accounts start with their Slack display name and profile picture, which the
    // onboarding form then prefills. Only on creation, so a user's own picks stick; any
    // Slack failure just leaves the HCA name and no picture.
    private static async Task ApplySlackProfileAsync(User user, IServiceProvider services)
    {
        if (string.IsNullOrEmpty(user.SlackUserID) || !services.GetRequiredService<SlackOptions>().Configured) return;

        var profile = await services.GetRequiredService<SlackClient>().GetProfileAsync(user.SlackUserID);
        if (profile is null) return;

        if (ToUsername(profile.DisplayName) is { } username) user.Username = username;
        if (profile.ImageUrl is { } imageUrl) user.ProfilePictureUrl = imageUrl;
    }

    // Squeezes a Slack display name into what onboarding accepts (3–30 of letters, numbers,
    // _ or -): spaces become _, anything else is dropped. Null if too little is left.
    private static string? ToUsername(string? displayName)
    {
        if (displayName is null) return null;
        var cleaned = new string(displayName.Trim()
            .Select(c => char.IsWhiteSpace(c) ? '_' : c)
            .Where(c => char.IsAsciiLetterOrDigit(c) || c is '_' or '-')
            .Take(30)
            .ToArray());
        return cleaned.Length >= 3 ? cleaned : null;
    }

    // Keeps verification status, Slack id etc. current without waiting for the next
    // sign-in, and ends the session if the users row is gone or HCA revoked Torque.
    private static async Task ResyncFromHcaAsync(CookieValidatePrincipalContext context)
    {
        if (!Guid.TryParse(context.Principal?.FindFirst("sub")?.Value, out var userId))
        {
            await RejectAsync(context);
            return;
        }

        var lastSync = DateTimeOffset.TryParse(context.Properties.GetString(SyncedAtKey), out var at) ? at : DateTimeOffset.MinValue;
        if (DateTimeOffset.UtcNow - lastSync < ResyncInterval) return;

        var services = context.HttpContext.RequestServices;
        var db = services.GetRequiredService<AppDbContext>();
        var user = await db.Users.FindAsync([userId], context.HttpContext.RequestAborted);
        if (user is null)
        {
            await RejectAsync(context);
            return;
        }

        var info = await services.GetRequiredService<HcaClient>().GetUserInfoAsync(user, context.HttpContext.RequestAborted);
        if (info.Revoked)
        {
            await RejectAsync(context);
            return;
        }
        if (info.Claims is { } claims) HcaUserSync.Apply(user, claims);
        // Saves refreshed tokens too. If HCA was just unreachable, try again next interval.
        await db.SaveChangesAsync(context.HttpContext.RequestAborted);

        context.Properties.SetString(SyncedAtKey, DateTimeOffset.UtcNow.ToString("O"));
        context.ShouldRenew = true;
    }

    private static async Task RejectAsync(CookieValidatePrincipalContext context)
    {
        context.RejectPrincipal();
        await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    }

    private static ClaimsPrincipal SessionPrincipal(Guid userId) =>
        new(new ClaimsIdentity(
            [new Claim("sub", userId.ToString())],
            CookieAuthenticationDefaults.AuthenticationScheme,
            nameType: "sub",
            roleType: "role"));
}

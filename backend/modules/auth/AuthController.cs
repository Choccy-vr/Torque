using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Torque.Data;
using Torque.Extensions;
using Torque.Users;
// Sign-in session endpoints. /auth/callback itself is handled by the OIDC middleware.
// endpoint: /auth/login, /auth/logout, /auth/me

namespace Torque.Auth;

[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly HcaOptions _options;

    public AuthController(AppDbContext db, HcaOptions options)
    {
        _db = db;
        _options = options;
    }

    // Browser navigation, not fetch: redirects to HCA, which comes back to /auth/callback
    // and from there to returnTo (a path on the frontend, or a URL on the frontend's or
    // this API's own origin — the latter is how the /testing harness signs in).
    [HttpGet("login")]
    public IActionResult Login([FromQuery] string? returnTo)
    {
        return Challenge(new AuthenticationProperties { RedirectUri = ResolveReturnTo(returnTo) }, AuthExtension.HcaScheme);
    }

    [HttpPost("logout")]
    [AllowBanned]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    // Who's signed in; 401 when nobody is. Banned users still get an answer so the
    // frontend can tell "banned" apart from "signed out".
    [Authorize]
    [AllowBanned]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var userId = this.GetUserId();
        var user = userId is null ? null : await _db.Users.FindAsync(userId);
        if (user is null) return Unauthorized();

        return Ok(new { id = user.Id, name = user.Name, email = user.Email });
    }

    private string ResolveReturnTo(string? returnTo)
    {
        var fallback = $"{_options.FrontendUrl}/home";
        if (string.IsNullOrEmpty(returnTo)) return fallback;

        // A local path, but not //host or /\host, which browsers treat as another origin.
        if (returnTo.StartsWith('/') && !returnTo.StartsWith("//") && !returnTo.StartsWith("/\\"))
        {
            return _options.FrontendUrl + returnTo;
        }

        if (Uri.TryCreate(returnTo, UriKind.Absolute, out var uri))
        {
            var origin = uri.GetLeftPart(UriPartial.Authority);
            var allowed = new[] { _options.FrontendUrl, $"{Request.Scheme}://{Request.Host}" };
            if (allowed.Any(a => string.Equals(a, origin, StringComparison.OrdinalIgnoreCase))) return uri.ToString();
        }

        return fallback;
    }
}

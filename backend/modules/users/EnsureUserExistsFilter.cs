// Users/EnsureUserExistsFilter.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Torque.Data;

namespace Torque.Users;

public class EnsureUserExistsFilter : IAsyncActionFilter
{
    private readonly AppDbContext _db;
    public EnsureUserExistsFilter(AppDbContext db) => _db = db;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var principal = context.HttpContext.User;

        if (principal.Identity?.IsAuthenticated == true)
        {
            var subClaim = principal.FindFirst("sub")?.Value;
            if (Guid.TryParse(subClaim, out var userId))
            {
                // The row is created/synced at sign-in (Torque.Auth.AuthExtension); a session
                // whose row has since been deleted is treated as signed out.
                var user = await _db.Users.FindAsync(userId);
                if (user is null)
                {
                    context.Result = new UnauthorizedResult();
                    return;
                }

                // Bans (from the Hackatime connect-time trust check or the ownership check
                // run before shipping) are stored as a "banned" entry in Role — no separate
                // audit/session store to revoke, so this filter is what actually blocks a
                // banned user from every [Authorize]'d endpoint, except ones explicitly
                // marked [AllowBanned] (e.g. "am I banned?").
                var allowsBanned = context.ActionDescriptor is ControllerActionDescriptor descriptor
                    && descriptor.MethodInfo.GetCustomAttributes(typeof(AllowBannedAttribute), true).Length > 0;

                if (!allowsBanned && user.Role?.Contains("banned") == true)
                {
                    context.Result = new ObjectResult(new { error = "This account has been banned." })
                    {
                        StatusCode = StatusCodes.Status403Forbidden
                    };
                    return;
                }
            }
        }

        await next();
    }
}
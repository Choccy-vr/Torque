// Users/EnsureUserExistsFilter.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
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
                var email = principal.FindFirst("email")?.Value ?? "";
                var RealName = principal.FindFirst("user_metadata:name")?.Value ?? "";
                var HcUserID = principal.FindFirst("user_metadata:sub")?.Value ?? "";
                var SlackUserID = principal.FindFirst("user_metadata:custom_claims:slack_id")?.Value ?? "";
                bool VerificationStatus = string.Equals(
                    principal.FindFirst("user_metadata:custom_claims:verification_status")?.Value,
                    "verified", StringComparison.OrdinalIgnoreCase);
                bool YswsEligible = bool.TryParse(
                    principal.FindFirst("user_metadata:custom_claims:ysws_eligible")?.Value,
                    out var yswsEligible) && yswsEligible;

                var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);

                if (user is null)
                {
                    user = new User
                    {
                        Id = userId,
                        Email = email,
                        Name = RealName,
                        HcUserID = HcUserID,
                        Username = RealName,
                        Bio = "",
                        SlackUserID = SlackUserID,
                        HackatimeID = "",
                        VerificationStatus = VerificationStatus,
                        YswsEligible = YswsEligible
                    };
                    _db.Users.Add(user);
                    await _db.SaveChangesAsync();
                }
                else
                {
                    var changed = false;
                    if (user.Email != email) { user.Email = email; changed = true; }
                    if (user.Name != RealName) { user.Name = RealName; changed = true; }
                    if (user.HcUserID != HcUserID) { user.HcUserID = HcUserID; changed = true; }
                    if (user.SlackUserID != SlackUserID) { user.SlackUserID = SlackUserID; changed = true; }
                    if (user.VerificationStatus != VerificationStatus) { user.VerificationStatus = VerificationStatus; changed = true; }
                    if (user.YswsEligible != YswsEligible) { user.YswsEligible = YswsEligible; changed = true; }

                    if (changed)
                        await _db.SaveChangesAsync();
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
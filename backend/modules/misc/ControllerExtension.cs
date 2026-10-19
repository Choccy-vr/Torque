using Microsoft.AspNetCore.Mvc;
using Torque.Data;
using Torque.Users;

namespace Torque.Extensions;

public static class ControllerExtensions
{
    public static Guid? GetUserId(this ControllerBase controller)
    {
        var claim = controller.User.FindFirst("sub")?.Value;
        return Guid.TryParse(claim, out var userId) ? userId : null;
    }

    // The signed-in user when they have `role` (e.g. "admin"); otherwise Denied is what to
    // return (401 signed out, 404 no user row, 403 missing the role).
    public static async Task<(User? User, IActionResult? Denied)> RequireRoleAsync(this ControllerBase controller, AppDbContext db, string role)
    {
        var userId = controller.GetUserId();
        if (userId is null) return (null, controller.Unauthorized());

        var user = await db.Users.FindAsync(userId);
        if (user is null) return (null, controller.NotFound());

        if (user.Role is null || !user.Role.Contains(role)) return (null, controller.Forbid());

        return (user, null);
    }
}

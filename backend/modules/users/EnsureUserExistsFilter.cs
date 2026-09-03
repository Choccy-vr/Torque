// Users/EnsureUserExistsFilter.cs
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

                var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);

                if (user is null)
                {
                    _db.Users.Add(new User
                    {
                        Id = userId,
                        Email = email,
                        Name = RealName,
                        HcUserID = HcUserID
                    });
                    await _db.SaveChangesAsync();
                }
                else
                {
                    var changed = false;
                    if (user.Email != email) { user.Email = email; changed = true; }
                    if (user.Name != RealName) { user.Name = RealName; changed = true; }
                    if (user.HcUserID != HcUserID) { user.HcUserID = HcUserID; changed = true; }

                    if (changed)
                        await _db.SaveChangesAsync();
                }
            }
        }

        await next();
    }
}
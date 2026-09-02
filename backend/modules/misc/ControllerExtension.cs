using Microsoft.AspNetCore.Mvc;

namespace Torque.Extensions;

public static class ControllerExtensions
{
    public static Guid? GetUserId(this ControllerBase controller)
    {
        var claim = controller.User.FindFirst("sub")?.Value;
        return Guid.TryParse(claim, out var userId) ? userId : null;
    }
}
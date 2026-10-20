using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Torque.Settings;

// Blocks an action while a global setting is on, answering 503 { error, paused }
// (see SettingsService.PausedResult). Runs after EnsureUserExistsFilter, so a banned
// user still gets the ban's 403 first. e.g. [PausedBy(SettingKeys.ShipsPaused)]
[AttributeUsage(AttributeTargets.Method)]
public class PausedByAttribute : TypeFilterAttribute
{
    public PausedByAttribute(string key) : base(typeof(PausedByFilter))
    {
        if (SettingKeys.Find(key) is null) throw new ArgumentException($"Unknown setting {key}", nameof(key));
        Arguments = [key];
    }
}

public class PausedByFilter : IAsyncActionFilter
{
    private readonly SettingsService _settings;
    private readonly string _key;

    public PausedByFilter(SettingsService settings, string key)
    {
        _settings = settings;
        _key = key;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var paused = await _settings.PausedResultAsync(_key, context.HttpContext.RequestAborted);
        if (paused is not null)
        {
            context.Result = paused;
            return;
        }

        await next();
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
// Admin-only view of what the Slack bot has sent
// endpoint: /api/admin/slack/<command>

namespace Torque.Slack;

[ApiController]
[Route("api/admin/slack")]
public class AdminSlackController : ControllerBase
{
    private const int MaxResults = 100;

    private readonly AppDbContext _db;

    public AdminSlackController(AppDbContext db)
    {
        _db = db;
    }

    // Every DM / channel invite the bot attempted (slack_logs), newest first. q matches the
    // recipient's username or Slack ID, or the message text; an exact user id matches that
    // user. Filters: action (dm | channel_invite), success, userId.
    [Authorize]
    [HttpGet("logs")]
    public async Task<IActionResult> Logs([FromQuery] string? q, [FromQuery] SlackAction? action, [FromQuery] bool? success, [FromQuery] Guid? userId)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        var logs = _db.SlackLogs.AsQueryable();
        if (action is not null) logs = logs.Where(l => l.Action == action);
        if (success is not null) logs = logs.Where(l => l.Success == success);
        if (userId is not null) logs = logs.Where(l => l.UserId == userId);

        var query = q?.Trim();
        if (!string.IsNullOrEmpty(query))
        {
            if (Guid.TryParse(query, out var id))
            {
                logs = logs.Where(l => l.UserId == id || l.Id == id);
            }
            else
            {
                var pattern = $"%{query}%";
                logs = logs.Where(l =>
                    EF.Functions.ILike(l.SlackUserId, pattern) ||
                    EF.Functions.ILike(l.Detail, pattern) ||
                    _db.Users.Any(u => u.Id == l.UserId && EF.Functions.ILike(u.Username, pattern)));
            }
        }

        var results = await logs
            .OrderByDescending(l => l.CreatedAt)
            .Take(MaxResults)
            .Select(l => new SlackLogDto
            {
                Id = l.Id,
                SlackUserId = l.SlackUserId,
                UserId = l.UserId,
                Username = _db.Users.Where(u => u.Id == l.UserId).Select(u => u.Username).FirstOrDefault(),
                ProfilePictureUrl = _db.Users.Where(u => u.Id == l.UserId).Select(u => u.ProfilePictureUrl).FirstOrDefault(),
                Action = l.Action,
                Detail = l.Detail,
                Success = l.Success,
                Error = l.Error,
                CreatedAt = l.CreatedAt
            })
            .ToListAsync();

        return Ok(results);
    }
}

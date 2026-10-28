using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;

// Admin-only headline counts for the top of the admin pages
// endpoint: /api/admin/stats

namespace Torque.Misc;

[ApiController]
[Route("api/admin/stats")]
public class AdminStatsController : ControllerBase
{
    private readonly AppDbContext _db;
    public AdminStatsController(AppDbContext db) => _db = db;

    // Totals across everything: every user (banned too), every project (archived too)
    // and every ship whatever its status.
    [Authorize]
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        // One DbContext can't run queries in parallel, so these go one at a time.
        var users = await _db.Users.CountAsync();
        var projects = await _db.Projects.CountAsync();
        var ships = await _db.Shipments.CountAsync();
        return Ok(new { users, projects, ships });
    }
}

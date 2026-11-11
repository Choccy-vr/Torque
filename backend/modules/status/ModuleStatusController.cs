using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Torque.Data;
using Torque.Extensions;

// Admin-only live check of every integration (database, HCA, Hackatime, Airtable, Slack,
// Lapse, uploads) for the admin "System status" dialog
// endpoint: /api/admin/modules

namespace Torque.Status;

[ApiController]
[Route("api/admin/modules")]
public class ModuleStatusController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ModuleStatusService _status;

    public ModuleStatusController(AppDbContext db, ModuleStatusService status)
    {
        _db = db;
        _status = status;
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        return Ok(await _status.CheckAllAsync(ct));
    }
}

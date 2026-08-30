using Microsoft.AspNetCore.Mvc;
using Torque.Data;

// A endpoint for sharing the health of the backend
// endpoint: /health

namespace Torque.Misc;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _db;
    public HealthController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var canConnect = await _db.Database.CanConnectAsync();
        return canConnect
            ? Ok(new { status = "ok", db = "connected" })
            : StatusCode(503, new { status = "degraded" });
    }
}
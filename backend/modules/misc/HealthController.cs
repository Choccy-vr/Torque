using Microsoft.AspNetCore.Mvc;
using Torque.Data;
namespace Torque.Modules.Misc;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _db;
    public HealthController(AppDbContext db) => _db = db; // DI hands us the registered DbContext

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var canConnect = await _db.Database.CanConnectAsync();
        return canConnect
            ? Ok(new { status = "ok", db = "connected" })
            : StatusCode(503, new { status = "degraded" });
    }
}
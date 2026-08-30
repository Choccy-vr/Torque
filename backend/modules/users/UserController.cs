using Microsoft.AspNetCore.Mvc;
using Torque.Data;

// A controller for user data
// endpoint: /api/user/<command>

namespace Torque.Users;

[ApiController]
[Route("api/user")]
public class UserController : ControllerBase
{
    private readonly AppDbContext _db;
    public UserController(AppDbContext db) => _db = db;

    // Public profile for any user, no PII
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        return Ok(new PublicProfileDto
        {
            Id = user.Id,
            Username = user.Username,
            Bio = user.Bio,
            CreatedAt = user.CreatedAt
        });
    }

    // Own profile for the authenticated user
    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        // TODO: no auth is implemented yet. 
        return StatusCode(501, new { status = "not_implemented", reason = "auth not wired up yet" });
    }
}

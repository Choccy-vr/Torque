using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Torque.Data;
using Torque.Extensions;
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
    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        return Ok(new OwnProfileDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Bio = user.Bio,
            CreatedAt = user.CreatedAt

        });
    }
}

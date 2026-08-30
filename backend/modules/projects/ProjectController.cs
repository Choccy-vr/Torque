using Microsoft.AspNetCore.Mvc;
using Torque.Data;

// A controller for project data
// endpoint: /api/project/<command>

namespace Torque.Projects;

[ApiController]
[Route("api/project")]
public class ProjectController : ControllerBase
{
    private readonly AppDbContext _db;
    public ProjectController(AppDbContext db) => _db = db;

    // project by ID
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();

        return Ok(new PublicProjectDto
        {
            Id = project.Id,
            OwnerUserId = project.OwnerUserId,
            Title = project.Title,
            Description = project.Description,
            CreatedAt = project.CreatedAt
        });
    }
}

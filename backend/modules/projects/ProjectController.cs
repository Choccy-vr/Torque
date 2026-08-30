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

    //Create Project
    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] CreateProjectDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
        {
            return BadRequest("Title is required!");
        }

        Project project = new Project
        {
            Title = dto.Title,
            Description = dto.Description,
            // TODO implement auth and get user id
            OwnerUserId = Guid.Empty
        };

        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = project.Id }, new PublicProjectDto
        {
            Id = project.Id,
            OwnerUserId = project.OwnerUserId,
            Title = project.Title,
            Description = project.Description,
            CreatedAt = project.CreatedAt
        });

    }

}

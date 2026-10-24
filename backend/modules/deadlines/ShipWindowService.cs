using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Projects;

namespace Torque.Deadlines;

// Whether a project can send a design or build ship right now. Before the kind's deadline
// it always can. After it, only a late fix: the project's latest ship, of the same kind
// and sent before the deadline, came back "changes needed" (or rejected), and it's
// within LateFixWindow of that review. That's one try, since the late ship itself was
// sent after the deadline.
public class ShipWindowService
{
    private readonly AppDbContext _db;
    public ShipWindowService(AppDbContext db) => _db = db;

    public async Task<ShipWindowDto> ForProjectAsync(Project project, CancellationToken ct = default) => new()
    {
        Design = await ForAsync(project, build: false, ct),
        Build = await ForAsync(project, build: true, ct)
    };

    public async Task<ShipKindWindowDto> ForAsync(Project project, bool build, CancellationToken ct = default)
    {
        var closesAt = ProgramDates.ShipsCloseAt(build);
        var now = DateTime.UtcNow;
        if (now < closesAt) return new ShipKindWindowDto { Open = true, ClosesAt = closesAt };

        var lateUntil = await LateFixUntilAsync(project, build, closesAt, ct);
        return lateUntil > now
            ? new ShipKindWindowDto { Open = true, ClosesAt = closesAt, LateFixUntil = lateUntil }
            : new ShipKindWindowDto { Open = false, ClosesAt = closesAt };
    }

    // The 403 body for a ship sent when ForAsync says it's closed.
    public static object ClosedError(bool build) => new
    {
        error = build
            ? $"Shipping closed on {ProgramDates.BuildShipsLastDay:MMMM d}. Thanks for building with Torque!"
            : $"Design ships closed on {ProgramDates.DesignShipsLastDay:MMMM d}. You can still ship your build until {ProgramDates.BuildShipsLastDay:MMMM d}.",
        code = "ships_closed"
    };

    private async Task<DateTime?> LateFixUntilAsync(Project project, bool build, DateTime closesAt, CancellationToken ct)
    {
        // Changes_Needed means the latest ship was sent back (changes needed or rejected).
        if (project.Status != ProjectStatus.Changes_Needed) return null;

        var latest = await _db.Shipments
            .Where(s => s.ProjectId == project.Id)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new { s.IsBuildComplete, s.CreatedAt, s.ReviewedAt })
            .FirstOrDefaultAsync(ct);
        if (latest is null || latest.IsBuildComplete != build || latest.CreatedAt >= closesAt) return null;

        return latest.ReviewedAt + ProgramDates.LateFixWindow;
    }
}

public record ShipWindowDto
{
    public ShipKindWindowDto Design { get; init; } = null!;
    public ShipKindWindowDto Build { get; init; } = null!;
}

public record ShipKindWindowDto
{
    public bool Open { get; init; }
    // When this kind of ship closes (or closed), UTC.
    public DateTime ClosesAt { get; init; }
    // Set while the kind is open only as a late fix: the one resubmission must be sent by then.
    public DateTime? LateFixUntil { get; init; }
}

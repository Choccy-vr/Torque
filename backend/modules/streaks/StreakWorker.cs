using Microsoft.EntityFrameworkCore;
using Torque.Data;

namespace Torque.Streaks;

// Settles streaks after each owner's local midnight passes: a project whose last counted
// day is before yesterday missed a day, so it spends a freeze or resets. Journals settle
// their own project too (StreakService.RecordJournalAsync); this catches projects nobody
// journals on.
public class StreakWorker : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(15);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<StreakWorker> _logger;

    public StreakWorker(IServiceScopeFactory scopes, ILogger<StreakWorker> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    // Only one pass at a time, whether from the timer or RunOnceAsync.
    private readonly SemaphoreSlim _gate = new(1, 1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(PollInterval);
        do
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Streak settle tick failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    // Runs one pass immediately instead of waiting for the next tick. Used by the
    // Development-only test harness (modules/testing) — there's no public endpoint.
    public async Task RunOnceAsync(CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            await SettleAsync(ct);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task SettleAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var streaks = scope.ServiceProvider.GetRequiredService<StreakService>();

        var active = await db.Projects
            .Where(p => p.StreakCount > 0)
            .ToListAsync(ct);
        if (active.Count == 0) return;

        var ownerIds = active.Select(p => p.OwnerUserId).Distinct().ToList();
        var owners = await db.Users
            .Where(u => ownerIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, ct);

        var now = DateTime.UtcNow;
        foreach (var group in active.GroupBy(p => p.OwnerUserId))
        {
            if (ct.IsCancellationRequested) return;
            if (!owners.TryGetValue(group.Key, out var owner)) continue;

            var today = StreakService.LocalDate(owner, now);
            // Longest streaks get first claim on the owner's freezes.
            foreach (var project in group.OrderByDescending(p => p.StreakCount))
            {
                if (project.LastStreakDate < today.AddDays(-1))
                {
                    await streaks.ReconcileAsync(project, owner, today, ct);
                }
            }
        }

        await db.SaveChangesAsync(ct);
    }
}

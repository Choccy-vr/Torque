using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Projects;
using Torque.Shipments;

namespace Torque.Airtable;

// Pushes every first-pass-approved shipment (project now Fraud_Pending) to Airtable
// exactly once. The review endpoint never calls Airtable itself, so an Airtable outage
// can't fail a review — unpushed shipments (AirtableRecordId == null) are simply
// picked up again on a later tick.
public class AirtablePushWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly AirtableOptions _options;
    private readonly ILogger<AirtablePushWorker> _logger;

    // In-memory backoff so one row Airtable keeps rejecting doesn't get retried every
    // tick forever. Resets on restart, which is fine.
    private readonly Dictionary<Guid, (int Failures, DateTime NextAttempt)> _backoff = [];
    private static readonly TimeSpan MaxBackoff = TimeSpan.FromHours(1);

    public AirtablePushWorker(IServiceScopeFactory scopes, AirtableOptions options, ILogger<AirtablePushWorker> logger)
    {
        _scopes = scopes;
        _options = options;
        _logger = logger;
    }

    // Only one pass at a time, whether from the timer or RunOnceAsync.
    private readonly SemaphoreSlim _gate = new(1, 1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_options.PollInterval);
        do
        {
            try
            {
                await RunOnceAsync(ignoreBackoff: false, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Airtable push tick failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    // Runs one pass immediately instead of waiting for the next tick. Used by the
    // Development-only test harness (modules/testing) — there's no public endpoint.
    public async Task RunOnceAsync(bool ignoreBackoff, CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            await PushPendingAsync(ignoreBackoff, ct);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task PushPendingAsync(bool ignoreBackoff, CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var builder = scope.ServiceProvider.GetRequiredService<AirtableSubmissionBuilder>();
        var airtable = scope.ServiceProvider.GetRequiredService<AirtableClient>();

        var pending = await db.Shipments
            .Where(s => s.Status == ShipmentStatus.approved && s.AirtableRecordId == null)
            .Where(s => db.Projects.Any(p => p.Id == s.ProjectId && p.Status == ProjectStatus.Fraud_Pending))
            .OrderBy(s => s.CreatedAt)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        foreach (var shipment in pending)
        {
            if (ct.IsCancellationRequested) return;
            if (!ignoreBackoff && _backoff.TryGetValue(shipment.Id, out var b) && b.NextAttempt > now) continue;

            var project = await db.Projects.FindAsync([shipment.ProjectId], ct);
            var user = await db.Users.FindAsync([shipment.UserId], ct);
            if (project is null || user is null)
            {
                _logger.LogWarning("Skipping Airtable push for shipment {ShipmentId}: {Missing} {MissingId} not found",
                    shipment.Id, user is null ? "user" : "project", user is null ? shipment.UserId : shipment.ProjectId);
                continue;
            }
            var review = shipment.ReviewId is { } reviewId
                ? await db.ShipmentReviews.FindAsync([reviewId], ct)
                : null;

            var fields = await builder.BuildAsync(shipment, project, user, review);
            var recordId = fields is null ? null : await airtable.CreateRecordAsync(fields);

            if (recordId is null)
            {
                var failures = (_backoff.TryGetValue(shipment.Id, out var prev) ? prev.Failures : 0) + 1;
                var delay = TimeSpan.FromMinutes(Math.Min(Math.Pow(2, failures - 1), MaxBackoff.TotalMinutes));
                _backoff[shipment.Id] = (failures, now + delay);
                _logger.LogWarning("Airtable push failed for shipment {ShipmentId} (attempt {Attempt}); retrying in {Delay}",
                    shipment.Id, failures, delay);
                continue;
            }

            shipment.AirtableRecordId = recordId;
            shipment.AirtablePushedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            _backoff.Remove(shipment.Id);
            _logger.LogInformation("Pushed shipment {ShipmentId} to Airtable as {RecordId}", shipment.Id, recordId);
        }
    }
}

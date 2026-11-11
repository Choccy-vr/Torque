using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
using Torque.Hackatime;
using Torque.Streaks;
using Torque.Projects;
using Torque.Shipments;
using Torque.Slack;
using Torque.Users;
// A controller for reviewing projects (the first pass; final approval is in Airtable)
// endpoint: /api/admin/review/

namespace Torque.Reviews;

[ApiController]
[Route("api/admin/review")]
public class ReviewController : ControllerBase
{
    // How long a claim holds before another reviewer can take the ship without forcing.
    // Expiry is lazy: a stale claim is simply treated as no claim.
    public static readonly TimeSpan ClaimTtl = TimeSpan.FromHours(1);

    private readonly AppDbContext _db;
    private readonly SlackNotifier _slack;
    private readonly SlackOptions _slackOptions;
    private readonly HackatimeService _hackatime;

    public ReviewController(AppDbContext db, SlackNotifier slack, SlackOptions slackOptions, HackatimeService hackatime)
    {
        _db = db;
        _slack = slack;
        _slackOptions = slackOptions;
        _hackatime = hackatime;
    }

    private static bool IsFreshClaim(Guid claimedBy, DateTime claimedAt) =>
        claimedBy != Guid.Empty && claimedAt > DateTime.UtcNow - ClaimTtl;

    // Get shipments that need reviewing, oldest to newest, with who has claimed them
    [Authorize]
    [HttpGet("get/pending")]
    public async Task<IActionResult> GetPendingShips()
    {
        var (reviewer, denied) = await this.RequireRoleAsync(_db, "reviewer");
        if (denied is not null) return denied;

        var rows = await (
            from s in _db.Shipments
            where s.Status == ShipmentStatus.unreviewed
            join p in _db.Projects on s.ProjectId equals p.Id
            join u in _db.Users on s.UserId equals u.Id into owners
            from u in owners.DefaultIfEmpty()
            join c in _db.Users on p.ClaimedByReviewer equals c.Id into claimers
            from c in claimers.DefaultIfEmpty()
            orderby s.CreatedAt
            select new
            {
                s.Id,
                s.ProjectId,
                p.Title,
                s.UserId,
                Username = u == null ? null : u.Username,
                s.IsBuildComplete,
                s.HourSnapshot,
                s.RequestedFunding,
                s.TierSnapshot,
                s.CreatedAt,
                p.ClaimedByReviewer,
                p.ClaimedAt,
                ClaimedByUsername = c == null ? null : c.Username
            })
            .ToListAsync();

        var queue = rows.Select(r =>
        {
            var fresh = IsFreshClaim(r.ClaimedByReviewer, r.ClaimedAt);
            return new ReviewQueueItemDto
            {
                Id = r.Id,
                ProjectId = r.ProjectId,
                ProjectTitle = r.Title,
                UserId = r.UserId,
                Username = r.Username ?? "",
                IsBuildComplete = r.IsBuildComplete,
                HourSnapshot = r.HourSnapshot,
                RequestedFunding = r.RequestedFunding,
                TierSnapshot = r.TierSnapshot,
                CreatedAt = r.CreatedAt,
                ClaimedBy = fresh ? r.ClaimedByReviewer : null,
                ClaimedByUsername = fresh ? r.ClaimedByUsername : null,
                ClaimedAt = fresh ? r.ClaimedAt : null,
                ClaimExpiresAt = fresh ? r.ClaimedAt + ClaimTtl : null,
                ClaimedByMe = fresh && r.ClaimedByReviewer == reviewer!.Id
            };
        });

        return Ok(queue);
    }

    // Get a single shipment by id, with everything the review page shows
    [Authorize]
    [HttpGet("get/{id:guid}")]
    public async Task<IActionResult> GetShip(Guid id)
    {
        var (reviewer, denied) = await this.RequireRoleAsync(_db, "reviewer");
        if (denied is not null) return denied;

        // ProjectSnapshot is a navigation, so it's null unless included.
        var s = await _db.Shipments.AsNoTracking()
            .Include(x => x.ProjectSnapshot)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (s is null) return NotFound();

        var project = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == s.ProjectId);
        if (project is null) return NotFound();

        var owner = await _db.Users.AsNoTracking()
            .Where(u => u.Id == project.OwnerUserId)
            .Select(u => new ReviewOwnerDto
            {
                Id = u.Id,
                Username = u.Username,
                SlackUserID = u.SlackUserID,
                ProfilePictureUrl = u.ProfilePictureUrl,
                CreatedAt = u.CreatedAt
            })
            .FirstOrDefaultAsync() ?? new ReviewOwnerDto { Id = project.OwnerUserId };

        var fresh = IsFreshClaim(project.ClaimedByReviewer, project.ClaimedAt);
        var claimedByUsername = fresh
            ? await _db.Users.Where(u => u.Id == project.ClaimedByReviewer).Select(u => u.Username).FirstOrDefaultAsync()
            : null;

        var previousReviews = await _db.ShipmentReviews
            .Where(r => r.ProjectId == project.Id)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new AdminShipmentReviewDto
            {
                Id = r.Id,
                ProjectId = r.ProjectId,
                ShipmentId = r.ShipmentId,
                ReviewerId = r.ReviewerId,
                ReviewerUsername = _db.Users.Where(u => u.Id == r.ReviewerId).Select(u => u.Username).FirstOrDefault(),
                Status = r.Status,
                HideReviewerName = r.HideReviewerName,
                ReturnedBy = r.ReturnedBy,
                Feedback = r.Feedback,
                InternalNote = r.InternalNote,
                OverrideJustification = r.OverrideJustification,
                ScreenshotUrl = r.ScreenshotUrl,
                TechnicalFeatures = r.TechnicalFeatures,
                DeflationJustification = r.DeflationJustification,
                AdditionalJustification = r.AdditionalJustification,
                Exceptional = r.Exceptional,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync();

        var previousShips = await _db.Shipments
            .Where(x => x.ProjectId == project.Id && x.Id != s.Id)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ReviewPreviousShipDto
            {
                Id = x.Id,
                IsBuildComplete = x.IsBuildComplete,
                Status = x.Status,
                HourSnapshot = x.HourSnapshot,
                ApprovedHours = x.ApprovedHours,
                FinalApprovedAt = x.FinalApprovedAt,
                CreatedAt = x.CreatedAt
            })
            .ToListAsync();

        var otherProjects = await _db.Projects
            .Where(p => p.OwnerUserId == project.OwnerUserId && p.Id != project.Id)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new ReviewOtherProjectDto
            {
                Id = p.Id,
                Title = p.Title,
                Status = p.Status,
                Tier = p.Tier,
                TotalHoursApproved = p.TotalHoursApproved,
                IsArchived = p.IsArchived,
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();

        return Ok(new ReviewShipmentDetailDto
        {
            Id = s.Id,
            UserId = s.UserId,
            ProjectId = s.ProjectId,
            ReviewerNote = s.ReviewerNote,
            Feedback = s.Feedback,
            Status = s.Status,
            HourSnapshot = s.HourSnapshot,
            OverrideHours = s.OverrideHours,
            ProjectSnapshot = s.ProjectSnapshot,
            TierSnapshot = s.TierSnapshot,
            OverrideTier = s.OverrideTier,
            ReviewId = s.ReviewId,
            ReviewedAt = s.ReviewedAt,
            VoltsGranted = s.VoltsGranted,
            ApprovedHours = s.ApprovedHours,
            PaidHours = s.PaidHours,
            VoltsPerHour = s.VoltsPerHour,
            FinalApprovedAt = s.FinalApprovedAt,
            IsBuildComplete = s.IsBuildComplete,
            RequestedFunding = s.RequestedFunding,
            HowDidYouHear = s.HowDidYouHear,
            WhatAreWeDoingWell = s.WhatAreWeDoingWell,
            HowCanWeImprove = s.HowCanWeImprove,
            CreatedAt = s.CreatedAt,

            ProjectTitle = project.Title,
            ProjectStatus = project.Status,
            ClaimedBy = fresh ? project.ClaimedByReviewer : null,
            ClaimedByUsername = claimedByUsername,
            ClaimedAt = fresh ? project.ClaimedAt : null,
            ClaimExpiresAt = fresh ? project.ClaimedAt + ClaimTtl : null,
            ClaimedByMe = fresh && project.ClaimedByReviewer == reviewer!.Id,
            Owner = owner,
            IsStaffPick = project.IsStaffPick,
            Exceptional = project.Exceptional,
            TotalHoursApproved = project.TotalHoursApproved,
            PreviousReviews = previousReviews,
            PreviousShips = previousShips,
            OtherProjects = otherProjects
        });
    }

    // Claim a ship so other reviewers know it's being looked at. Re-claiming your own
    // claim refreshes it; ?force=true takes over someone else's fresh claim.
    [Authorize]
    [HttpPost("claim/{id:guid}")]
    public async Task<IActionResult> Claim(Guid id, [FromQuery] bool force = false)
    {
        var (reviewer, denied) = await this.RequireRoleAsync(_db, "reviewer");
        if (denied is not null) return denied;
        var me = reviewer!.Id;

        var shipment = await _db.Shipments.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (shipment is null) return NotFound();
        if (shipment.Status != ShipmentStatus.unreviewed) return Conflict(new { error = "This shipment has already been reviewed." });

        var now = DateTime.UtcNow;
        var staleBefore = now - ClaimTtl;

        // One conditional update, so two reviewers claiming at once can't both win.
        var claimed = await _db.Projects
            .Where(p => p.Id == shipment.ProjectId
                && (p.Status == ProjectStatus.Unreviewed || p.Status == ProjectStatus.Claimed)
                && (force
                    || p.ClaimedByReviewer == Guid.Empty
                    || p.ClaimedByReviewer == me
                    || p.ClaimedAt <= staleBefore))
            .ExecuteUpdateAsync(p => p
                .SetProperty(x => x.ClaimedByReviewer, me)
                .SetProperty(x => x.ClaimedAt, now)
                .SetProperty(x => x.Status, ProjectStatus.Claimed));

        if (claimed == 0)
        {
            var project = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == shipment.ProjectId);
            if (project is null) return NotFound();
            if (project.Status is not (ProjectStatus.Unreviewed or ProjectStatus.Claimed))
            {
                return Conflict(new { error = "This project isn't waiting for review." });
            }
            var holder = await _db.Users.Where(u => u.Id == project.ClaimedByReviewer).Select(u => u.Username).FirstOrDefaultAsync();
            return Conflict(new { error = $"Already claimed by {holder ?? "another reviewer"}.", claimedBy = holder });
        }

        return Ok(new
        {
            claimedBy = me,
            claimedByUsername = reviewer.Username,
            claimedAt = now,
            claimExpiresAt = now + ClaimTtl,
            claimedByMe = true
        });
    }

    // Release a claim. Only its holder can (admins can release anyone's). Releasing a
    // ship nobody has claimed is a no-op.
    [Authorize]
    [HttpPost("unclaim/{id:guid}")]
    public async Task<IActionResult> Unclaim(Guid id)
    {
        var (reviewer, denied) = await this.RequireRoleAsync(_db, "reviewer");
        if (denied is not null) return denied;

        var shipment = await _db.Shipments.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (shipment is null) return NotFound();

        var project = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == shipment.ProjectId);
        if (project is null) return NotFound();
        if (project.ClaimedByReviewer == Guid.Empty) return NoContent();

        var isAdmin = reviewer!.Role?.Contains("admin") == true;
        if (project.ClaimedByReviewer != reviewer.Id && !isAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Only the reviewer who claimed this can release it." });
        }

        var holder = project.ClaimedByReviewer;
        await _db.Projects
            .Where(p => p.Id == project.Id && p.ClaimedByReviewer == holder)
            .ExecuteUpdateAsync(p => p
                .SetProperty(x => x.ClaimedByReviewer, Guid.Empty)
                .SetProperty(x => x.ClaimedAt, default(DateTime))
                .SetProperty(x => x.Status, x => x.Status == ProjectStatus.Claimed ? ProjectStatus.Unreviewed : x.Status));

        return NoContent();
    }

    // Flip a project's staff pick / exceptional markers, from the review page
    [Authorize]
    [HttpPatch("project/{projectId:guid}/markers")]
    public async Task<IActionResult> SetMarkers(Guid projectId, [FromBody] ReviewMarkersDto dto)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "reviewer");
        if (denied is not null) return denied;

        if (dto.IsStaffPick is null && dto.Exceptional is null)
        {
            return BadRequest("Send isStaffPick and/or exceptional.");
        }

        var project = await _db.Projects.FindAsync(projectId);
        if (project is null) return NotFound();

        if (dto.IsStaffPick is not null) project.IsStaffPick = dto.IsStaffPick.Value;
        if (dto.Exceptional is not null) project.Exceptional = dto.Exceptional.Value;
        await _db.SaveChangesAsync();

        return Ok(new { isStaffPick = project.IsStaffPick, exceptional = project.Exceptional });
    }

    // Live Hackatime numbers for the ship's project: the builder's trust level and the
    // counted hours on each linked Hackatime project. A slow outside call, so the review
    // page only asks when the reviewer wants it.
    [Authorize]
    [HttpGet("hackatime/{id:guid}")]
    public async Task<IActionResult> GetHackatime(Guid id)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "reviewer");
        if (denied is not null) return denied;

        var shipment = await _db.Shipments.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (shipment is null) return NotFound();

        var project = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == shipment.ProjectId);
        if (project is null) return NotFound();

        var owner = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == project.OwnerUserId);
        var names = project.HackatimeProjectNames ?? [];

        if (owner is null || string.IsNullOrEmpty(owner.HackatimeToken))
        {
            return Ok(new { connected = false, reachable = false, trustLevel = (string?)null, totalHours = 0.0, perProject = Array.Empty<object>() });
        }

        var (trustReachable, trustLevel) = await _hackatime.GetTrustLevelAsync(owner);
        var seconds = await _hackatime.GetSecondsPerProjectAsync(owner.Id, names);

        static double Hours(double s) => Math.Round(s / 3600 * 10) / 10;
        var perProject = names
            .Select(n => new { name = n, hours = Hours(seconds?.GetValueOrDefault(n) ?? 0) })
            .ToList();

        return Ok(new
        {
            connected = true,
            reachable = trustReachable && seconds is not null,
            trustLevel,
            totalHours = seconds is null ? 0 : Hours(seconds.Values.Sum()),
            perProject
        });
    }

    // Review a shipment (approve / reject / request changes)
    [Authorize]
    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] ReviewShipmentDto dto)
    {
        var (reviewer, denied) = await this.RequireRoleAsync(_db, "reviewer");
        if (denied is not null) return denied;
        var userId = reviewer!.Id;

        // "returned" only makes sense once there's a second-pass audit that can invalidate
        // a prior approval; there's no such flow yet, so it isn't a valid decision here.
        if (dto.Status == ShipmentReviewStatus.returned)
        {
            return BadRequest("Status 'returned' is not supported yet.");
        }

        var screenshotUrl = string.IsNullOrWhiteSpace(dto.ScreenshotUrl) ? null : dto.ScreenshotUrl.Trim();
        if (screenshotUrl is not null
            && !(Uri.TryCreate(screenshotUrl, UriKind.Absolute, out var screenshotUri)
                 && (screenshotUri.Scheme == Uri.UriSchemeHttp || screenshotUri.Scheme == Uri.UriSchemeHttps)))
        {
            return BadRequest("ScreenshotUrl must be an http(s) URL.");
        }

        // Approval pushes to Airtable, which needs these to justify the grant.
        if (dto.Status == ShipmentReviewStatus.approved
            && (screenshotUrl is null || string.IsNullOrWhiteSpace(dto.TechnicalFeatures)))
        {
            return BadRequest("ScreenshotUrl and TechnicalFeatures are required when approving.");
        }

        if (dto.OverrideHours is < 0) return BadRequest("OverrideHours can't be negative.");
        if (dto.OverrideHours is not null && string.IsNullOrWhiteSpace(dto.OverrideJustification))
        {
            return BadRequest("OverrideJustification is required when setting OverrideHours.");
        }
        if (dto.OverrideTier is not null and not (>= 1 and <= 4)) return BadRequest("OverrideTier must be 1–4.");

        var shipment = await _db.Shipments.FindAsync(dto.ShipmentId);
        if (shipment is null) return BadRequest("ShipmentId does not reference an existing shipment.");

        if (shipment.Status != ShipmentStatus.unreviewed)
        {
            return BadRequest("This shipment has already been reviewed.");
        }

        var project = await _db.Projects.FindAsync(shipment.ProjectId);
        if (project is null) return NotFound();

        // Someone else is mid-review on this one.
        if (IsFreshClaim(project.ClaimedByReviewer, project.ClaimedAt) && project.ClaimedByReviewer != userId)
        {
            return Conflict("Another reviewer has claimed this shipment.");
        }

        // The level sets the Volts rate, so an approval needs a valid one.
        var level = dto.OverrideTier ?? project.Tier;
        if (dto.Status == ShipmentReviewStatus.approved && level is < 1 or > 4)
        {
            return BadRequest("The project has no valid level (1–4); set OverrideTier to approve.");
        }

        var newStatus = dto.Status switch
        {
            ShipmentReviewStatus.approved => ShipmentStatus.approved,
            ShipmentReviewStatus.rejected => ShipmentStatus.rejected,
            ShipmentReviewStatus.perm_rejected => ShipmentStatus.perm_rejected,
            ShipmentReviewStatus.changes_needed => ShipmentStatus.needs_changes,
            _ => shipment.Status
        };

        await using var tx = await _db.Database.BeginTransactionAsync();

        // Claims the shipment: a second reviewer submitting at the same moment blocks on
        // this row, then matches nothing once the first commits.
        var claimed = await _db.Shipments
            .Where(s => s.Id == shipment.Id && s.Status == ShipmentStatus.unreviewed)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, newStatus));
        if (claimed == 0) return Conflict("This shipment was reviewed at the same time by someone else.");

        // Nothing is credited or paid here: hours, Volts and grants all wait for the ship's
        // final approval from Airtable (AirtableWebhookController). The overrides are kept
        // for it.
        if (dto.Status == ShipmentReviewStatus.approved)
        {
            if (dto.OverrideTier is not null)
            {
                shipment.OverrideTier = dto.OverrideTier.Value;
                project.Tier = dto.OverrideTier.Value;
            }
            if (dto.OverrideHours is not null) shipment.OverrideHours = dto.OverrideHours.Value;
        }

        var review = new ShipmentReview
        {
            Id = Guid.NewGuid(),
            ProjectId = shipment.ProjectId,
            ShipmentId = shipment.Id,
            ReviewerId = userId,
            Status = dto.Status,
            HideReviewerName = dto.HideReviewerName,
            ReturnedBy = dto.ReturnedBy,
            Feedback = dto.Feedback,
            InternalNote = dto.InternalNote,
            OverrideJustification = dto.OverrideJustification,
            ScreenshotUrl = screenshotUrl,
            TechnicalFeatures = dto.TechnicalFeatures,
            DeflationJustification = dto.DeflationJustification,
            AdditionalJustification = dto.AdditionalJustification,
            Exceptional = dto.Exceptional
        };
        _db.ShipmentReviews.Add(review);

        shipment.Status = newStatus;
        shipment.Feedback = dto.Feedback;
        shipment.ReviewId = review.Id;
        shipment.ReviewedAt = DateTime.UtcNow;

        // The review is done, so the claim goes with it.
        project.ClaimedByReviewer = Guid.Empty;
        project.ClaimedAt = default;

        // A rejected or changes_needed shipment leaves the project eligible to be
        // reshipped (Create() only allows shipping from Unshipped/Changes_Needed).
        // perm_rejected is a genuine terminal state — Create() doesn't allow shipping
        // from Perm_Rejected, so there's no path back for the user.
        // Approval here is only the first pass: the project goes to fraud review
        // (second pass) and AirtablePushWorker pushes the shipment to Airtable. Approving
        // that record is the final approval (see AirtableWebhookController). Anything else
        // ends the review, so the paused streak resumes.
        if (dto.Status == ShipmentReviewStatus.approved)
        {
            project.Status = ProjectStatus.Fraud_Pending;
            if (dto.Exceptional) project.Exceptional = true;
        }
        else
        {
            project.Status = dto.Status == ShipmentReviewStatus.perm_rejected
                ? ProjectStatus.Perm_Rejected
                : ProjectStatus.Changes_Needed;

            var owner = await _db.Users.FindAsync(project.OwnerUserId);
            if (owner is not null) StreakService.ResumeAfterReview(project, owner);
        }

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        // Approval here is only the first pass; its DM waits for final approval.
        if (dto.Status != ShipmentReviewStatus.approved)
        {
            var owner = await _db.Users.FindAsync(project.OwnerUserId);
            var projectUrl = _slackOptions.ProjectUrl(project.Id);
            var reviewerName = dto.HideReviewerName ? null : reviewer.Username;
            _slack.Send(owner?.SlackUserID, dto.Status == ShipmentReviewStatus.perm_rejected
                ? SlackMessages.Rejected(project.Title, projectUrl, dto.Feedback, reviewerName)
                : SlackMessages.ChangesNeeded(project.Title, projectUrl, dto.Feedback, reviewerName));
        }

        return Ok(new AdminShipmentReviewDto
        {
            Id = review.Id,
            ProjectId = review.ProjectId,
            ShipmentId = review.ShipmentId,
            ReviewerId = review.ReviewerId,
            Status = review.Status,
            HideReviewerName = review.HideReviewerName,
            ReturnedBy = review.ReturnedBy,
            Feedback = review.Feedback,
            InternalNote = review.InternalNote,
            OverrideJustification = review.OverrideJustification,
            ScreenshotUrl = review.ScreenshotUrl,
            TechnicalFeatures = review.TechnicalFeatures,
            DeflationJustification = review.DeflationJustification,
            AdditionalJustification = review.AdditionalJustification,
            Exceptional = review.Exceptional,
            CreatedAt = review.CreatedAt
        });
    }
}

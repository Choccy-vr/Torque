using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Auth;
using Torque.Data;
using Torque.Extensions;
using Torque.Hackatime;
using Torque.Payouts;
using Torque.Projects;
using Torque.Settings;
using Torque.Slack;
using Torque.Users;
// A controller for Shipments
// endpoint: /ships

namespace Torque.Shipments;

[ApiController]
[Route("api/ships")]
public class ShipmentController : ControllerBase
{
    // Journaled hours a ship needs that no approved ship has credited yet
    private const float MinShipHours = 1;
    // Each of the three feedback answers
    private const int MaxAnswerLength = 400;

    private readonly AppDbContext _db;
    private readonly PayoutService _payouts;
    private readonly SlackNotifier _slack;
    private readonly SlackOptions _slackOptions;
    private readonly SettingsService _settings;
    private readonly YswsEligibility _eligibility;
    private readonly HackatimeService _hackatime;

    public ShipmentController(AppDbContext db, PayoutService payouts, SlackNotifier slack, SlackOptions slackOptions, SettingsService settings, YswsEligibility eligibility, HackatimeService hackatime)
    {
        _db = db;
        _payouts = payouts;
        _slack = slack;
        _slackOptions = slackOptions;
        _settings = settings;
        _eligibility = eligibility;
        _hackatime = hackatime;
    }

    // Get shipments all per user
    [Authorize]
    [HttpGet("get/me")]
    public async Task<IActionResult> GetMeShips()
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var shipments = await _db.Shipments
            .Where(s => s.UserId == userId.Value)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new OwnShipmentDto
            {
                Id = s.Id,
                UserId = s.UserId,
                ProjectId = s.ProjectId,
                Status = s.Status,
                Feedback = s.Feedback,
                HourSnapshot = s.HourSnapshot,
                OverrideHours = s.OverrideHours,
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
                CreatedAt = s.CreatedAt
            })
            .ToListAsync();

        return Ok(shipments);
    }

    // Get a single shipment by id (public view)
    [Authorize]
    [HttpGet("get/{id:guid}")]
    public async Task<IActionResult> GetShip(Guid id)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var shipment = await _db.Shipments
            .Where(s => s.Id == id)
            .Select(s => new PublicShipmentDto
            {
                Id = s.Id,
                UserId = s.UserId,
                ProjectId = s.ProjectId,
                Status = s.Status,
                HourSnapshot = s.HourSnapshot,
                OverrideHours = s.OverrideHours,
                OverrideTier = s.OverrideTier,
                VoltsGranted = s.VoltsGranted,
                CreatedAt = s.CreatedAt
            })
            .FirstOrDefaultAsync();

        if (shipment is null) return NotFound();

        return Ok(shipment);
    }

    // Create a shipment (submit a project for review)
    [Authorize]
    [PausedBy(SettingKeys.ShipsPaused)]
    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] CreateShipmentDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        if (!Guid.TryParse(dto.ProjectId, out var projectId) || projectId == Guid.Empty)
        {
            return BadRequest("ProjectId is required!");
        }

        if (dto.IsBuildComplete is null) return BadRequest("IsBuildComplete is required!");
        if (dto.RequestedFunding is null or < 0) return BadRequest("RequestedFunding is required and can't be negative!");
        if (string.IsNullOrWhiteSpace(dto.HowDidYouHear)
            || string.IsNullOrWhiteSpace(dto.WhatAreWeDoingWell)
            || string.IsNullOrWhiteSpace(dto.HowCanWeImprove))
        {
            return BadRequest("HowDidYouHear, WhatAreWeDoingWell and HowCanWeImprove are required!");
        }
        if (new[] { dto.HowDidYouHear, dto.WhatAreWeDoingWell, dto.HowCanWeImprove }.Any(a => a.Trim().Length > MaxAnswerLength))
        {
            return BadRequest($"Each answer must be {MaxAnswerLength} characters or fewer.");
        }

        // Checked before taking the project lock: it may call HCA.
        var shipper = await _db.Users.FindAsync(userId.Value);
        if (shipper is null) return Unauthorized();
        var denied = await _eligibility.DenyAsync(shipper, "ship");
        if (denied is not null) return denied;
        // Hackatime trust is checked at connect, and again here in case Hackatime has
        // flagged the account since. If Hackatime can't be asked, the ship goes through
        // (fraud review still sees it).
        if (await _hackatime.BanIfRedAsync(shipper) == true)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "This account has been banned.", code = "banned" });
        }

        // Locks the project row until commit, so two ships sent at once can't both pass
        // the status check and snapshot the same hours: the second waits, then sees Unreviewed.
        await using var tx = await _db.Database.BeginTransactionAsync();
        var project = await _db.Projects
            .FromSql($"SELECT * FROM projects WHERE id = {projectId} FOR UPDATE")
            .FirstOrDefaultAsync();
        if (project is null) return BadRequest("ProjectId does not reference an existing project.");

        if (project.OwnerUserId != userId.Value) return Forbid();
        if (project.IsArchived) return BadRequest("This project is archived. Unarchive it to ship it.");

        // Design vs build is always the shipper's call (IsBuildComplete). Out of review, a
        // project can ship again as often as it likes, as long as it has new journaled time
        // to ship: at least an hour no final-approved ship has credited yet.
        if (project.Status is not (ProjectStatus.Unshipped or ProjectStatus.Changes_Needed or ProjectStatus.Approved))
        {
            return BadRequest("This project cannot be shipped from its current status.");
        }
        // Resubmitting after a review asked for changes can be paused on its own, so
        // reviewers can clear the queue while first ships keep coming in.
        if (project.Status == ProjectStatus.Changes_Needed)
        {
            var paused = await _settings.PausedResultAsync(SettingKeys.ResubmissionsPaused);
            if (paused is not null) return paused;
        }
        // The build ship waits until an admin has sent the design ship's grant.
        if (dto.IsBuildComplete.Value && project.GrantStatus == ProjectGrantStatus.Pending)
        {
            return Conflict("Your grant hasn't been sent yet. You can ship your build once it has.");
        }
        var unpaidHours = await _payouts.UnpaidJournalHoursAsync(project.Id);
        if (unpaidHours < MinShipHours)
        {
            return BadRequest("You need at least 1 hour of journaled time since your last approved ship to ship.");
        }
        // Grants are $5 per design hour being shipped. Bigger ones are a special case,
        // arranged with an organizer by hand.
        var maxFunding = PayoutService.MaxGrantFor(unpaidHours);
        if (!dto.IsBuildComplete.Value && dto.RequestedFunding.Value > maxFunding)
        {
            return BadRequest($"You can ask for up to ${maxFunding} for this ship ($5 per hour you're shipping). For special cases, DM @Ginobeano on Slack about extra funding.");
        }

        Shipment shipment = new Shipment
        {
            UserId = userId.Value,
            ProjectId = project.Id,
            Status = ShipmentStatus.unreviewed,
            HourSnapshot = unpaidHours,
            TierSnapshot = project.Tier,
            ProjectSnapshot = project,
            IsBuildComplete = dto.IsBuildComplete.Value,
            RequestedFunding = dto.RequestedFunding.Value,
            HowDidYouHear = dto.HowDidYouHear.Trim(),
            WhatAreWeDoingWell = dto.WhatAreWeDoingWell.Trim(),
            HowCanWeImprove = dto.HowCanWeImprove.Trim()
        };

        _db.Shipments.Add(shipment);
        project.Status = ProjectStatus.Unreviewed;
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        _slack.Send(shipper.SlackUserID, SlackMessages.Shipped(project.Title, _slackOptions.ProjectUrl(project.Id)));

        return Ok(new OwnShipmentDto
        {
            Id = shipment.Id,
            UserId = shipment.UserId,
            ProjectId = shipment.ProjectId,
            Status = shipment.Status,
            HourSnapshot = shipment.HourSnapshot,
            OverrideHours = shipment.OverrideHours,
            OverrideTier = shipment.OverrideTier,
            ReviewId = shipment.ReviewId,
            ReviewedAt = shipment.ReviewedAt,
            VoltsGranted = shipment.VoltsGranted,
            ApprovedHours = shipment.ApprovedHours,
            PaidHours = shipment.PaidHours,
            VoltsPerHour = shipment.VoltsPerHour,
            FinalApprovedAt = shipment.FinalApprovedAt,
            IsBuildComplete = shipment.IsBuildComplete,
            RequestedFunding = shipment.RequestedFunding,
            CreatedAt = shipment.CreatedAt
        });
    }
}
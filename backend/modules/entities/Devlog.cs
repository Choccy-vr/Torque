namespace Torque.Devlogs;

public class Devlog
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid ProjectId { get; set; }

    public string Title { get; set; } = null!;
    public string Text { get; set; } = null!;

    public string[] ImageUrls { get; set; } = null!;

    public bool Approved { get; set; } = false;
    public float? ApprovedHours { get; set; }
    public Guid ApprovedByReviewerId { get; set; }

    // Hackatime time this journal covers: the project's Hackatime total minus the previous
    // journal's snapshot, capped at 10h.
    public double TrackedSeconds { get; set; }
    // How far into the project's Hackatime total this journal covers (previous snapshot +
    // TrackedSeconds). Time over the cap carries over to the next journal.
    public double HackatimeSecondsSnapshot { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

}
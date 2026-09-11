namespace Torque.Lapse;
// Whitelisted view of a Lapse timelapse — the reviewer never sees the program key or the raw Lapse response.
public record TimelapseDto
{
    public string Id { get; init; } = null!;
    public string Name { get; init; } = "";
    public string PlaybackUrl { get; init; } = null!;
    public string? ThumbnailUrl { get; init; }
    public double? Duration { get; init; }
    public long? CreatedAt { get; init; }
    public string? HackatimeProject { get; init; }
    public string? Visibility { get; init; }
}

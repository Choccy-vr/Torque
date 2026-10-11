namespace Torque.Projects;
// Inbound body for the owner's pause/resume streak freezes toggle
public record SetStreakFreezesPausedDto
{
    public bool Paused { get; init; }
}

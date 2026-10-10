namespace Torque.Grants;
// Body for ticking/unticking a grant as fulfilled
public record UpdateGrantDto
{
    public bool? Fulfilled { get; init; }
    // Optional; replaces the existing note when sent.
    public string? Note { get; init; }
}

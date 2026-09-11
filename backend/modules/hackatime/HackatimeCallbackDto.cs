namespace Torque.Hackatime;
// What the frontend sends after the Hackatime OAuth redirect lands back on it.
// `state` is the provider-echoed `state` query param; `storedState` is the raw
// state the frontend itself got back from POST /api/hackatime/start.
public record HackatimeCallbackDto
{
    public string Code { get; init; } = null!;
    public string State { get; init; } = null!;
    public string StoredState { get; init; } = null!;
}

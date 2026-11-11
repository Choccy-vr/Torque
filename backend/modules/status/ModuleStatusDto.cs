using System.Text.Json.Serialization;

namespace Torque.Status;

// One integration's state for the admin "System status" dialog.
public record ModuleStatusDto
{
    public string Key { get; init; } = null!;
    public string Name { get; init; } = null!;
    // What it does for Torque, in a sentence.
    public string Description { get; init; } = null!;
    // Required modules stop the backend from booting when they're not configured, so
    // they're never `disabled`.
    public bool Required { get; init; }
    public ModuleHealth Status { get; init; }
    // Why it has that status, in a sentence (never a secret).
    public string Detail { get; init; } = null!;
    // How long the live check took; null when there was nothing to check.
    public long? LatencyMs { get; init; }
    // Env vars to set to switch it (or the part of it that's off) on.
    public string[] Missing { get; init; } = [];
    public List<ModuleFactDto> Facts { get; init; } = [];
}

public record ModuleFactDto(string Label, string Value);

// Always a string in JSON (the frontend keys off the names), whoever serializes it.
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ModuleHealth
{
    // Configured, and the live check passed
    healthy,
    // Running, but part of it is switched off or not quite right
    degraded,
    // Configured, but the live check failed
    down,
    // Not configured, so switched off on purpose
    disabled
}

public record ModuleStatusReportDto(DateTime CheckedAt, List<ModuleStatusDto> Modules);

namespace Torque.Hackatime;

public class HackatimeOptions
{
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
    public string RedirectUri { get; set; } = null!;
    public string BaseUrl { get; set; } = null!;
    public string StateSecret { get; set; } = null!;
}

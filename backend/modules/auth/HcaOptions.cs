namespace Torque.Auth;

// Hack Club Auth (auth.hackclub.com) OIDC app credentials. Register the app at
// https://auth.hackclub.com/developer/apps with <backend origin>/auth/callback as its
// redirect URI.
public class HcaOptions
{
    public string Authority { get; set; } = "https://auth.hackclub.com";
    public string ClientId { get; set; } = null!;
    public string ClientSecret { get; set; } = null!;

    // address + birthdate feed the Airtable push and need an HQ-official app.
    public string[] Scopes { get; set; } =
        ["openid", "profile", "email", "name", "slack_id", "verification_status", "address", "birthdate"];

    // Where the frontend lives: the default post-login landing spot, and the origin
    // returnTo URLs are checked against.
    public string FrontendUrl { get; set; } = null!;

    public string TokenEndpoint => $"{Authority}/oauth/token";
    public string UserInfoEndpoint => $"{Authority}/oauth/userinfo";
}

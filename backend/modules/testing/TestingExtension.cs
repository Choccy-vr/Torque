using Microsoft.Extensions.FileProviders;
// Serves the local API test harness, Development only
// endpoint: /testing

namespace Torque.Testing;

public static class TestingExtension
{
    public static WebApplication UseTestingHarness(this WebApplication app)
    {
        var root = Path.Combine(app.Environment.ContentRootPath, "testing");
        if (!Directory.Exists(root)) return app;

        var files = new PhysicalFileProvider(root);

        // UseDefaultFiles must run before UseStaticFiles so /testing/ resolves to index.html
        app.UseDefaultFiles(new DefaultFilesOptions
        {
            FileProvider = files,
            RequestPath = "/testing"
        });
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = files,
            RequestPath = "/testing"
        });

        // The harness reads everything it needs from .env through here, nothing is baked into the page
        app.MapGet("/testing/config", (IConfiguration config) => Results.Ok(new
        {
            supabaseUrl = config["SUPABASE_URL"],
            supabaseAnonKey = config["SUPABASE_ANON_KEY"],
            oidcProvider = config["TESTING_OIDC_PROVIDER"]
        }));

        // Landing page for HACKATIME_REDIRECT_URI when it's pointed at the harness
        // (see backend/.env). The harness opens the Hackatime authorize page in a
        // popup; this page just relays ?code=/?state=/?error= back to the opener via
        // postMessage so the harness can finish the flow, then closes itself.
        app.MapGet("/auth/hackatime/callback", () => Results.Content("""
            <!doctype html>
            <title>Hackatime callback</title>
            <body style="font:14px system-ui;background:#070707;color:#e8e8ea;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
            <div id="msg">Completing Hackatime sign-in&hellip;</div>
            <script>
              const params = new URLSearchParams(location.search);
              const payload = {
                source: 'hackatime-callback',
                code: params.get('code'),
                state: params.get('state'),
                error: params.get('error'),
              };
              if (window.opener) {
                window.opener.postMessage(payload, window.location.origin);
                document.getElementById('msg').textContent = payload.error
                  ? `Hackatime error: ${payload.error}`
                  : 'Done — you can close this tab.';
                setTimeout(() => window.close(), payload.error ? 4000 : 800);
              } else {
                document.getElementById('msg').textContent = 'No opener window found — open this via the test harness.';
              }
            </script>
            </body>
            """, "text/html"));

        return app;
    }
}

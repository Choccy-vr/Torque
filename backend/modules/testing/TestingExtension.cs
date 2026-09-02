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

        return app;
    }
}

using System.Text.Json;
using Microsoft.Net.Http.Headers;

// Serves the built frontend out of wwwroot in the Docker image, so the site and the API
// share one origin. Does nothing when wwwroot is missing (local `dotnet run`, where the
// frontend runs on Vite instead).
// endpoint: /config.js, and every non-/api path falls back to index.html

namespace Torque.Frontend;

public static class FrontendExtension
{
    public static WebApplication UseFrontend(this WebApplication app)
    {
        var root = app.Environment.WebRootPath;
        if (root is null || !File.Exists(Path.Combine(root, "index.html"))) return app;

        // Runtime frontend config, so one image works anywhere without rebuilding the
        // VITE_* vars in. Only public values: the anon key is meant to ship to browsers.
        app.MapGet("/config.js", (IConfiguration config, HttpContext context) =>
        {
            var json = JsonSerializer.Serialize(new
            {
                supabaseUrl = config["SUPABASE_URL"],
                supabaseAnonKey = config["SUPABASE_ANON_KEY"],
                oidcProvider = config["OIDC_PROVIDER"],
                apiUrl = "",
            });
            context.Response.Headers.CacheControl = "no-cache";
            return Results.Text($"window.__TORQUE_CONFIG__ = {json};", "text/javascript");
        });

        app.UseDefaultFiles();
        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = ctx =>
            {
                // Vite fingerprints everything under /assets, so it can be cached forever.
                // Everything else (index.html, favicons) is revalidated so deploys show up.
                ctx.Context.Response.Headers[HeaderNames.CacheControl] =
                    ctx.Context.Request.Path.StartsWithSegments("/assets")
                        ? "public, max-age=31536000, immutable"
                        : "no-cache";
            }
        });

        // Unknown API routes stay 404s instead of getting the SPA's index.html
        app.MapFallback("/api/{**rest}", () => Results.NotFound());
        app.MapFallbackToFile("index.html", new StaticFileOptions
        {
            OnPrepareResponse = ctx => ctx.Context.Response.Headers[HeaderNames.CacheControl] = "no-cache"
        });

        return app;
    }
}

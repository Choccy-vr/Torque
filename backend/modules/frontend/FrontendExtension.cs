using System.Text.Json;
using Microsoft.Net.Http.Headers;
using Torque.Auth;

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
        // VITE_* vars in. Only public values belong here.
        app.MapGet("/config.js", (HttpContext context) =>
        {
            var json = JsonSerializer.Serialize(new
            {
                apiUrl = "",
            });
            context.Response.Headers.CacheControl = "no-cache";
            return Results.Text($"window.__TORQUE_CONFIG__ = {json};", "text/javascript");
        });

        // index.html with the link-preview tags' {{TORQUE_ORIGIN}} filled in, since
        // crawlers need absolute URLs and the image is built without knowing its domain.
        var origin = app.Services.GetRequiredService<HcaOptions>().FrontendUrl;
        var indexHtml = File.ReadAllText(Path.Combine(root, "index.html")).Replace("{{TORQUE_ORIGIN}}", origin);
        IResult ServeIndex(HttpContext context)
        {
            context.Response.Headers.CacheControl = "no-cache";
            return Results.Content(indexHtml, "text/html; charset=utf-8");
        }

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
        app.MapGet("/", ServeIndex);
        app.MapFallback(ServeIndex);

        return app;
    }
}

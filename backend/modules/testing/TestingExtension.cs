using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Torque.Airtable;
using Torque.Data;
using Torque.Projects;
// Serves the local API test harness, Development only
// endpoint: /testing, /testing/airtable/push/{shipmentId}

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

        // Runs an Airtable push pass right now (instead of waiting for the worker's next
        // tick) and reports whether the given shipment made it. Used by the harness's
        // ship → review → Airtable bundle; Airtable has no real endpoints.
        app.MapPost("/testing/airtable/push/{shipmentId:guid}", async (
            Guid shipmentId, IServiceProvider services, AppDbContext db, CancellationToken ct) =>
        {
            var worker = services.GetService<AirtablePushWorker>();
            if (worker is null)
            {
                return Results.Problem("Airtable push is disabled — set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in backend/.env.", statusCode: 503);
            }

            await worker.RunOnceAsync(ignoreBackoff: true, ct);

            var result = await db.Shipments.AsNoTracking()
                .Where(s => s.Id == shipmentId)
                .Select(s => new
                {
                    shipmentId = s.Id,
                    shipmentStatus = s.Status,
                    projectStatus = db.Projects.Where(p => p.Id == s.ProjectId).Select(p => (ProjectStatus?)p.Status).FirstOrDefault(),
                    airtableRecordId = s.AirtableRecordId,
                    airtablePushedAt = s.AirtablePushedAt
                })
                .FirstOrDefaultAsync(ct);

            if (result is null) return Results.NotFound(new { error = "No such shipment." });
            return Results.Ok(new
            {
                pushed = result.airtableRecordId is not null,
                hint = result.airtableRecordId is null ? "Not pushed — check the server log for [Airtable]/AirtablePushWorker warnings." : null,
                result.shipmentId,
                result.shipmentStatus,
                result.projectStatus,
                result.airtableRecordId,
                result.airtablePushedAt
            });
        }).RequireAuthorization();

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

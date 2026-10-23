namespace Torque.Extensions;

// The safe subset of what helmet sets in the template. No full Content-Security-Policy
// (the docs and inline scripts would need one written for them) and no
// Cross-Origin-Opener-Policy (it would cut the Hackatime connect popup off from the page
// that opened it).
public static class SecurityHeadersExtension
{
    public static WebApplication UseSecurityHeaders(this WebApplication app)
    {
        app.Use(async (context, next) =>
        {
            var headers = context.Response.Headers;
            headers.XContentTypeOptions = "nosniff";
            // Nobody may frame the site, so a page can't overlay a "click here" onto the shop.
            headers.XFrameOptions = "DENY";
            headers.ContentSecurityPolicy = "frame-ancestors 'none'";
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            // Only over https (UseForwardedProto runs first, so a TLS proxy counts).
            if (context.Request.IsHttps) headers.StrictTransportSecurity = "max-age=31536000";

            await next();
        });
        return app;
    }
}

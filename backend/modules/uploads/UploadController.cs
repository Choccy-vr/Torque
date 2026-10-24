using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Torque.Data;
using Torque.Extensions;
// Image uploads to the S3/R2 bucket; the returned URL goes into the usual image fields
// endpoint: /api/upload/<command>

namespace Torque.Uploads;

[ApiController]
[Route("api/upload")]
public class UploadController : ControllerBase
{
    // A little headroom over the 10 MB file cap for the multipart envelope
    private const long MaxRequestBytes = UploadService.MaxImageBytes + 512 * 1024;

    // Builders upload covers and journal photos; shop and announcement images are admin-only
    private static readonly HashSet<string> Purposes = ["cover", "journal", "shop", "announcement"];
    private static readonly HashSet<string> AdminPurposes = ["shop", "announcement"];

    private readonly AppDbContext _db;
    private readonly UploadService _uploads;
    private readonly ILogger<UploadController> _logger;

    public UploadController(AppDbContext db, UploadService uploads, ILogger<UploadController> logger)
    {
        _db = db;
        _uploads = uploads;
        _logger = logger;
    }

    // Upload one image (multipart form: file, purpose) and get back its public URL
    [Authorize]
    [HttpPost("image")]
    [EnableRateLimiting(UploadExtension.UploadPolicy)]
    [RequestSizeLimit(MaxRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxRequestBytes)]
    public async Task<IActionResult> Image([FromForm] IFormFile? file, [FromForm] string? purpose, CancellationToken ct)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        purpose = purpose?.Trim().ToLowerInvariant();
        if (purpose is null || !Purposes.Contains(purpose))
        {
            return BadRequest("Purpose must be one of: cover, journal, shop, announcement.");
        }
        if (AdminPurposes.Contains(purpose))
        {
            var (_, denied) = await this.RequireRoleAsync(_db, "admin");
            if (denied is not null) return denied;
        }

        if (!_uploads.Configured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, "Image uploads aren't set up on this server yet.");
        }

        if (file is null || file.Length == 0) return BadRequest("No file was attached.");
        if (file.Length > UploadService.MaxImageBytes)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, "That image is over 10 MB.");
        }

        string? url;
        try
        {
            url = await _uploads.SaveImageAsync(userId.Value, purpose, file, ct);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            _logger.LogError(e, "Image upload to S3 failed");
            return StatusCode(StatusCodes.Status502BadGateway, "Couldn't store the image. Try again in a moment.");
        }

        if (url is null) return BadRequest("That file isn't a PNG, JPEG, GIF or WebP image.");

        return Ok(new UploadDto(url));
    }
}

public record UploadDto(string Url);

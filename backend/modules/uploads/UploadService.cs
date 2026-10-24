using Amazon.S3;
using Amazon.S3.Model;
using Torque.Data;

namespace Torque.Uploads;

public class UploadService
{
    public const long MaxImageBytes = 10 * 1024 * 1024;

    private readonly AppDbContext _db;
    private readonly UploadOptions _options;
    private readonly IServiceProvider _services;

    public UploadService(AppDbContext db, UploadOptions options, IServiceProvider services)
    {
        _db = db;
        _options = options;
        _services = services;
    }

    public bool Configured => _options.Configured;

    // Stores the image in the bucket and returns its public URL, or null when the bytes
    // aren't a PNG/JPEG/GIF/WebP. Callers check the size and purpose first.
    public async Task<string?> SaveImageAsync(Guid userId, string purpose, IFormFile file, CancellationToken ct)
    {
        using var buffer = new MemoryStream((int)file.Length);
        await file.CopyToAsync(buffer, ct);

        var type = ImageSniffer.Detect(buffer.GetBuffer().AsSpan(0, (int)buffer.Length));
        if (type is null) return null;
        var size = buffer.Length;

        var now = DateTime.UtcNow;
        var key = $"images/{purpose}/{now:yyyy}/{now:MM}/{Guid.NewGuid():N}.{type.Value.Ext}";

        buffer.Position = 0;
        var s3 = _services.GetRequiredService<IAmazonS3>();
        await s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _options.BucketName,
            Key = key,
            InputStream = buffer,
            // The SDK closes the stream after sending by default; the using above owns it
            AutoCloseStream = false,
            ContentType = type.Value.Mime,
            Headers = { CacheControl = "public, max-age=31536000, immutable" },
            // R2 doesn't support streaming payload signing or the SDK's default checksums
            DisablePayloadSigning = true,
            DisableDefaultChecksumValidation = true
        }, ct);

        var url = $"{_options.PublicUrl}/{key}";

        _db.Uploads.Add(new Upload
        {
            UserId = userId,
            Purpose = purpose,
            Key = key,
            Url = url,
            ContentType = type.Value.Mime,
            SizeBytes = size
        });
        await _db.SaveChangesAsync(ct);

        return url;
    }
}

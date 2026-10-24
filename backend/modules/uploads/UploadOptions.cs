namespace Torque.Uploads;

public class UploadOptions
{
    public string? Endpoint { get; set; }
    public string? AccessKeyId { get; set; }
    public string? SecretAccessKey { get; set; }
    public string? BucketName { get; set; }
    // Public base URL of the bucket (custom domain or r2.dev), no trailing slash
    public string? PublicUrl { get; set; }

    public bool Configured =>
        !string.IsNullOrEmpty(Endpoint) &&
        !string.IsNullOrEmpty(AccessKeyId) &&
        !string.IsNullOrEmpty(SecretAccessKey) &&
        !string.IsNullOrEmpty(BucketName) &&
        !string.IsNullOrEmpty(PublicUrl);
}

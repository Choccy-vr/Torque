namespace Torque.Uploads;
// Entity model for Uploads (one row per image stored in the S3/R2 bucket)
// db table: uploads
public class Upload
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }

    // What the image was uploaded for: cover, journal, shop, announcement
    public string Purpose { get; set; } = null!;
    // Object key in the bucket, e.g. images/cover/2026/10/<guid>.webp
    public string Key { get; set; } = null!;
    // Public URL that ends up stored on the project/journal/shop item/announcement
    public string Url { get; set; } = null!;
    public string ContentType { get; set; } = null!;
    public long SizeBytes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

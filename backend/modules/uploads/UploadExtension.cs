using System.Threading.RateLimiting;
using Amazon.Runtime;
using Amazon.S3;
using Microsoft.AspNetCore.RateLimiting;

namespace Torque.Uploads;

public static class UploadExtension
{
    public const string UploadPolicy = "upload";

    public static IServiceCollection AddUploads(this IServiceCollection services, IConfiguration config)
    {
        var options = new UploadOptions
        {
            Endpoint = config["S3_ENDPOINT"],
            AccessKeyId = config["S3_ACCESS_KEY_ID"],
            SecretAccessKey = config["S3_SECRET_ACCESS_KEY"],
            BucketName = config["S3_BUCKET_NAME"],
            PublicUrl = config["S3_PUBLIC_URL"]?.TrimEnd('/')
        };
        services.AddSingleton(options);

        if (options.Configured)
        {
            services.AddSingleton<IAmazonS3>(_ => new AmazonS3Client(
                new BasicAWSCredentials(options.AccessKeyId, options.SecretAccessKey),
                new AmazonS3Config
                {
                    ServiceURL = options.Endpoint,
                    ForcePathStyle = true,
                    AuthenticationRegion = "auto",
                    // R2 rejects the streaming checksums newer SDKs send by default
                    RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
                    ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED
                }));
        }
        else
        {
            Console.WriteLine("[Uploads] S3_* not set — image uploads disabled");
        }

        services.AddScoped<UploadService>();

        services.AddRateLimiter(rateLimiterOptions =>
        {
            rateLimiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            rateLimiterOptions.AddPolicy(UploadPolicy, httpContext => RateLimitPartition.GetFixedWindowLimiter(
                httpContext.User.FindFirst("sub")?.Value ?? httpContext.Connection.RemoteIpAddress?.ToString() ?? "anon",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });

        return services;
    }
}

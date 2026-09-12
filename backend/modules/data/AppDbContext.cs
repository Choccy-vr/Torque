using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Torque.Crypto;
using Torque.Devlogs;
using Torque.Projects;
using Torque.Reviews;
using Torque.Shipments;
using Torque.Users;

namespace Torque.Data;

public class AppDbContext : DbContext
{
    private readonly TokenEncryptor _tokenEncryptor;

    public AppDbContext(DbContextOptions<AppDbContext> options, TokenEncryptor tokenEncryptor) : base(options)
    {
        _tokenEncryptor = tokenEncryptor;
    }

    public DbSet<Project> Projects => Set<Project>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Devlog> Devlogs => Set<Devlog>();
    public DbSet<Shipment> Shipments => Set<Shipment>();
    public DbSet<ShipmentReview> ShipmentReviews => Set<ShipmentReview>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Project>()
            .Property(p => p.Id)
            .HasDefaultValueSql("gen_random_uuid()");
        builder.Entity<Devlog>()
            .Property(p => p.Id)
            .HasDefaultValueSql("gen_random_uuid()");
        builder.Entity<Shipment>()
            .Property(p => p.Id)
            .HasDefaultValueSql("gen_random_uuid()");
        builder.Entity<ShipmentReview>()
            .Property(p => p.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        // Encrypted at rest — see TokenEncryptor. Never expose this on a DTO.
        var tokenConverter = new ValueConverter<string?, string?>(
            plaintext => plaintext == null ? null : _tokenEncryptor.Encrypt(plaintext),
            ciphertext => ciphertext == null ? null : _tokenEncryptor.Decrypt(ciphertext));
        builder.Entity<User>()
            .Property(u => u.HackatimeToken)
            .HasConversion(tokenConverter);
    }

}
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Torque.Announcements;
using Torque.Crypto;
using Torque.Devlogs;
using Torque.Grants;
using Torque.Payouts;
using Torque.Projects;
using Torque.Reviews;
using Torque.Settings;
using Torque.Shipments;
using Torque.Streaks;
using Torque.Users;

namespace Torque.Data;

public class AppDbContext : DbContext, IDataProtectionKeyContext
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
    public DbSet<Announcement> Announcements => Set<Announcement>();
    public DbSet<ProjectStreakDay> ProjectStreakDays => Set<ProjectStreakDay>();
    public DbSet<LedgerEntry> LedgerEntries => Set<LedgerEntry>();
    public DbSet<Grant> Grants => Set<Grant>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();
    // Session-cookie signing keys (see Torque.Auth.AuthExtension).
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

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
        builder.Entity<Announcement>()
            .Property(p => p.Id)
            .HasDefaultValueSql("gen_random_uuid()");
        builder.Entity<Announcement>()
            .HasIndex(a => a.CreatedAt);
        builder.Entity<ProjectStreakDay>()
            .Property(p => p.Id)
            .HasDefaultValueSql("gen_random_uuid()");
        builder.Entity<ProjectStreakDay>()
            .HasIndex(d => new { d.ProjectId, d.Date })
            .IsUnique();
        builder.Entity<LedgerEntry>()
            .Property(p => p.Id)
            .HasDefaultValueSql("gen_random_uuid()");
        builder.Entity<LedgerEntry>()
            .HasIndex(e => new { e.UserId, e.CreatedAt });
        builder.Entity<LedgerEntry>()
            .HasIndex(e => e.ShipmentId)
            .IsUnique()
            .HasFilter("shipment_id IS NOT NULL");
        builder.Entity<Grant>()
            .Property(p => p.Id)
            .HasDefaultValueSql("gen_random_uuid()");
        builder.Entity<Grant>()
            .HasIndex(g => g.ShipmentId)
            .IsUnique();
        builder.Entity<Grant>()
            .HasIndex(g => g.Fulfilled);
        builder.Entity<AppSetting>()
            .HasKey(s => s.Key);
        // Sign-in finds users by their HCA `sub`. Rows that never got one are left out.
        builder.Entity<User>()
            .HasIndex(u => u.HcUserID)
            .IsUnique()
            .HasFilter("hc_user_id <> ''");

        // Encrypted at rest — see TokenEncryptor. Never expose this on a DTO.
        var tokenConverter = new ValueConverter<string?, string?>(
            plaintext => plaintext == null ? null : _tokenEncryptor.Encrypt(plaintext),
            ciphertext => ciphertext == null ? null : _tokenEncryptor.Decrypt(ciphertext));
        builder.Entity<User>()
            .Property(u => u.HackatimeToken)
            .HasConversion(tokenConverter);
        builder.Entity<User>()
            .Property(u => u.HcaAccessToken)
            .HasConversion(tokenConverter);
        builder.Entity<User>()
            .Property(u => u.HcaRefreshToken)
            .HasConversion(tokenConverter);
    }

    // Ledger entries are append-only — correct a mistake with a new offsetting entry.
    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        GuardLedger();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        GuardLedger();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void GuardLedger()
    {
        if (ChangeTracker.Entries<LedgerEntry>().Any(e => e.State is EntityState.Modified or EntityState.Deleted))
        {
            throw new InvalidOperationException("Ledger entries can't be changed or deleted; add an offsetting entry instead.");
        }
    }
}

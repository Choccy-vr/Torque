using Microsoft.EntityFrameworkCore;
using Torque.Devlogs;
using Torque.Projects;
using Torque.Shipments;
using Torque.Users;

namespace Torque.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

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
    }

}
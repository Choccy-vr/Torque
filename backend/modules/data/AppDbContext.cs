using Microsoft.EntityFrameworkCore;

using Torque.Projects;
using Torque.Users;

namespace Torque.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Project> Projects => Set<Project>();
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Project>()
            .Property(p => p.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Entity<User>()
            .Property(p => p.Id)
            .HasDefaultValueSql("gen_random_uuid()");
    }

}
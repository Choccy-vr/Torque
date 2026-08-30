using Microsoft.EntityFrameworkCore;
using Torque.Entities;

namespace Torque.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Project> Projects => Set<Project>();

}
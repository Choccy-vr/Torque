using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace torque_backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class BackfillProjectTotalHoursRaw : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // total_hours_raw was never updated when journals were created; recompute it
            // from the journals' credited time. Journal creation keeps it current from here.
            migrationBuilder.Sql(@"
                UPDATE projects p
                SET total_hours_raw = COALESCE(
                    (SELECT SUM(d.tracked_seconds) FROM devlogs d WHERE d.project_id = p.id), 0) / 3600.0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data-only backfill; nothing to undo.
        }
    }
}

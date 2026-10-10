using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace torque_backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddStreaks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "streak_freezes",
                table: "users",
                type: "integer",
                nullable: false,
                // Everyone starts with 3 free streak freezes, existing users included.
                defaultValue: 3);

            migrationBuilder.AddColumn<string>(
                name: "time_zone",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "last_streak_date",
                table: "projects",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "streak_count",
                table: "projects",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<double>(
                name: "hackatime_seconds_snapshot",
                table: "devlogs",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "tracked_seconds",
                table: "devlogs",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.CreateTable(
                name: "project_streak_days",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    tracked_seconds = table.Column<double>(type: "double precision", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_project_streak_days", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_project_streak_days_project_id_date",
                table: "project_streak_days",
                columns: new[] { "project_id", "date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "project_streak_days");

            migrationBuilder.DropColumn(
                name: "streak_freezes",
                table: "users");

            migrationBuilder.DropColumn(
                name: "time_zone",
                table: "users");

            migrationBuilder.DropColumn(
                name: "last_streak_date",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "streak_count",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "hackatime_seconds_snapshot",
                table: "devlogs");

            migrationBuilder.DropColumn(
                name: "tracked_seconds",
                table: "devlogs");
        }
    }
}

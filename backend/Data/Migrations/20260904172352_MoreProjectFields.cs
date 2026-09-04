using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace torque_backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class MoreProjectFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "id",
                table: "users",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldDefaultValueSql: "gen_random_uuid()");

            migrationBuilder.AddColumn<string>(
                name: "ai_use",
                table: "projects",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "claimed_at",
                table: "projects",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<Guid>(
                name: "claimed_by_reviewer",
                table: "projects",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "demo_url",
                table: "projects",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string[]>(
                name: "hackatime_project_names",
                table: "projects",
                type: "text[]",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "readme_url",
                table: "projects",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "repo_url",
                table: "projects",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "status",
                table: "projects",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "tier",
                table: "projects",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<float>(
                name: "total_hours_approved",
                table: "projects",
                type: "real",
                nullable: false,
                defaultValue: 0f);

            migrationBuilder.AddColumn<float>(
                name: "total_hours_raw",
                table: "projects",
                type: "real",
                nullable: false,
                defaultValue: 0f);

            migrationBuilder.AddColumn<float>(
                name: "tracked_build_hours",
                table: "projects",
                type: "real",
                nullable: false,
                defaultValue: 0f);

            migrationBuilder.AddColumn<float>(
                name: "tracked_design_hours",
                table: "projects",
                type: "real",
                nullable: false,
                defaultValue: 0f);

            migrationBuilder.AddColumn<int>(
                name: "volts_granted",
                table: "projects",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ai_use",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "claimed_at",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "claimed_by_reviewer",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "demo_url",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "hackatime_project_names",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "readme_url",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "repo_url",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "status",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "tier",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "total_hours_approved",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "total_hours_raw",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "tracked_build_hours",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "tracked_design_hours",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "volts_granted",
                table: "projects");

            migrationBuilder.AlterColumn<Guid>(
                name: "id",
                table: "users",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()",
                oldClrType: typeof(Guid),
                oldType: "uuid");
        }
    }
}

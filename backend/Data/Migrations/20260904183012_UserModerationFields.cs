using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace torque_backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class UserModerationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "devlogs",
                table: "users");

            migrationBuilder.DropColumn(
                name: "total_devlogs",
                table: "users");

            migrationBuilder.DropColumn(
                name: "total_projects",
                table: "users");

            migrationBuilder.DropColumn(
                name: "total_time_shipped",
                table: "users");

            migrationBuilder.AddColumn<string>(
                name: "country",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "hackatime_token",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "internal_note",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "watchlisted",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "country",
                table: "users");

            migrationBuilder.DropColumn(
                name: "hackatime_token",
                table: "users");

            migrationBuilder.DropColumn(
                name: "internal_note",
                table: "users");

            migrationBuilder.DropColumn(
                name: "watchlisted",
                table: "users");

            migrationBuilder.AddColumn<Guid[]>(
                name: "devlogs",
                table: "users",
                type: "uuid[]",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "total_devlogs",
                table: "users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "total_projects",
                table: "users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<float>(
                name: "total_time_shipped",
                table: "users",
                type: "real",
                nullable: false,
                defaultValue: 0f);
        }
    }
}

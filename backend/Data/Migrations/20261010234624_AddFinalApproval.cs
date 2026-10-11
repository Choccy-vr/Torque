using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace torque_backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFinalApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "final_approved_at",
                table: "shipments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "grant_status",
                table: "projects",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Ships approved before this migration were credited and paid at first-pass
            // review, so they count as final-approved (an Airtable approval then pays nothing).
            migrationBuilder.Sql("UPDATE shipments SET final_approved_at = reviewed_at WHERE status = 1;");
            // Their projects are done too: Fraud_Pending (3) -> Approved (5), and the removed
            // Build_Grant_Pending (7) / Build_Grant_Fulfilled (8) -> Approved + grant_status
            // Pending (1) / Fulfilled (2).
            migrationBuilder.Sql("""
                UPDATE projects SET status = 5
                WHERE status = 3 AND EXISTS (SELECT 1 FROM shipments s WHERE s.project_id = projects.id AND s.status = 1);
                UPDATE projects SET status = 5, grant_status = 1 WHERE status = 7;
                UPDATE projects SET status = 5, grant_status = 2 WHERE status = 8;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE projects SET status = 7 WHERE status = 5 AND grant_status = 1;
                UPDATE projects SET status = 8 WHERE status = 5 AND grant_status = 2;
                """);

            migrationBuilder.DropColumn(
                name: "final_approved_at",
                table: "shipments");

            migrationBuilder.DropColumn(
                name: "grant_status",
                table: "projects");
        }
    }
}

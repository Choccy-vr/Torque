using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace torque_backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class ProjectShipReviews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "shipment_reviews",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    shipment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reviewer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    hide_reviewer_name = table.Column<bool>(type: "boolean", nullable: false),
                    returned_by = table.Column<Guid>(type: "uuid", nullable: false),
                    feedback = table.Column<string>(type: "text", nullable: true),
                    internal_note = table.Column<string>(type: "text", nullable: true),
                    override_justification = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shipment_reviews", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "shipments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reviewer_note = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    hour_snapshot = table.Column<float>(type: "real", nullable: false),
                    override_hours = table.Column<float>(type: "real", nullable: false),
                    tier_snapshot = table.Column<int>(type: "integer", nullable: false),
                    override_tier = table.Column<int>(type: "integer", nullable: false),
                    review_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reviewed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    volts_granted = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shipments", x => x.id);
                    table.ForeignKey(
                        name: "fk_shipments_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_shipments_project_id",
                table: "shipments",
                column: "project_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "shipment_reviews");

            migrationBuilder.DropTable(
                name: "shipments");
        }
    }
}

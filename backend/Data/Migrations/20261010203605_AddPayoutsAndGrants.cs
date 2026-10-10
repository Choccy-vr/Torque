using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace torque_backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPayoutsAndGrants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<float>(
                name: "approved_hours",
                table: "shipments",
                type: "real",
                nullable: false,
                defaultValue: 0f);

            migrationBuilder.AddColumn<float>(
                name: "paid_hours",
                table: "shipments",
                type: "real",
                nullable: false,
                defaultValue: 0f);

            migrationBuilder.AddColumn<decimal>(
                name: "volts_per_hour",
                table: "shipments",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "grants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    shipment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<int>(type: "integer", nullable: false),
                    fulfilled = table.Column<bool>(type: "boolean", nullable: false),
                    fulfilled_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    fulfilled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    note = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_grants", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ledger_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<int>(type: "integer", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    reason = table.Column<string>(type: "text", nullable: false),
                    shipment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ledger_entries", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_grants_fulfilled",
                table: "grants",
                column: "fulfilled");

            migrationBuilder.CreateIndex(
                name: "ix_grants_shipment_id",
                table: "grants",
                column: "shipment_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_ledger_entries_shipment_id",
                table: "ledger_entries",
                column: "shipment_id",
                unique: true,
                filter: "shipment_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_ledger_entries_user_id_created_at",
                table: "ledger_entries",
                columns: new[] { "user_id", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "grants");

            migrationBuilder.DropTable(
                name: "ledger_entries");

            migrationBuilder.DropColumn(
                name: "approved_hours",
                table: "shipments");

            migrationBuilder.DropColumn(
                name: "paid_hours",
                table: "shipments");

            migrationBuilder.DropColumn(
                name: "volts_per_hour",
                table: "shipments");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace torque_backend.modules.data.Migrations
{
    /// <inheritdoc />
    public partial class AddGrantFundingRate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "grant_dollars_per_hour",
                table: "projects",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "dollars_per_hour",
                table: "grants",
                type: "numeric",
                nullable: false,
                // Every grant before boosts existed was capped at the default $5/hr.
                defaultValue: 5m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "grant_dollars_per_hour",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "dollars_per_hour",
                table: "grants");
        }
    }
}

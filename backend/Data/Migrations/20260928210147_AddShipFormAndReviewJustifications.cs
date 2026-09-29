using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace torque_backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddShipFormAndReviewJustifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "how_can_we_improve",
                table: "shipments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "how_did_you_hear",
                table: "shipments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_build_complete",
                table: "shipments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "requested_funding",
                table: "shipments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "what_are_we_doing_well",
                table: "shipments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "additional_justification",
                table: "shipment_reviews",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "deflation_justification",
                table: "shipment_reviews",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "screenshot_url",
                table: "shipment_reviews",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "technical_features",
                table: "shipment_reviews",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "how_can_we_improve",
                table: "shipments");

            migrationBuilder.DropColumn(
                name: "how_did_you_hear",
                table: "shipments");

            migrationBuilder.DropColumn(
                name: "is_build_complete",
                table: "shipments");

            migrationBuilder.DropColumn(
                name: "requested_funding",
                table: "shipments");

            migrationBuilder.DropColumn(
                name: "what_are_we_doing_well",
                table: "shipments");

            migrationBuilder.DropColumn(
                name: "additional_justification",
                table: "shipment_reviews");

            migrationBuilder.DropColumn(
                name: "deflation_justification",
                table: "shipment_reviews");

            migrationBuilder.DropColumn(
                name: "screenshot_url",
                table: "shipment_reviews");

            migrationBuilder.DropColumn(
                name: "technical_features",
                table: "shipment_reviews");
        }
    }
}

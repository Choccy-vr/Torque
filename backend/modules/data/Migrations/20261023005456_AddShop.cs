using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace torque_backend.modules.data.Migrations
{
    /// <inheritdoc />
    public partial class AddShop : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "order_id",
                table: "ledger_entries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "shop_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    name = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    image_url = table.Column<string>(type: "text", nullable: true),
                    tier = table.Column<int>(type: "integer", nullable: false),
                    price = table.Column<int>(type: "integer", nullable: false),
                    regions = table.Column<string[]>(type: "text[]", nullable: false),
                    regional_prices = table.Column<string>(type: "jsonb", nullable: false),
                    stock = table.Column<int>(type: "integer", nullable: true),
                    max_per_user = table.Column<int>(type: "integer", nullable: true),
                    random_mode = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    fulfiller_notes = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shop_items", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "daily_shop_picks",
                columns: table => new
                {
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    shop_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    set_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_daily_shop_picks", x => x.date);
                    table.ForeignKey(
                        name: "fk_daily_shop_picks_shop_items_shop_item_id",
                        column: x => x.shop_item_id,
                        principalTable: "shop_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "shop_item_variants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    shop_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    price_delta = table.Column<int>(type: "integer", nullable: false),
                    stock = table.Column<int>(type: "integer", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shop_item_variants", x => x.id);
                    table.ForeignKey(
                        name: "fk_shop_item_variants_shop_items_shop_item_id",
                        column: x => x.shop_item_id,
                        principalTable: "shop_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "shop_orders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    shop_item_id = table.Column<Guid>(type: "uuid", nullable: true),
                    variant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    item_name = table.Column<string>(type: "text", nullable: false),
                    variant_name = table.Column<string>(type: "text", nullable: true),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    unit_price = table.Column<int>(type: "integer", nullable: false),
                    total_price = table.Column<int>(type: "integer", nullable: false),
                    region = table.Column<string>(type: "text", nullable: false),
                    via_daily = table.Column<bool>(type: "boolean", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    ship_name = table.Column<string>(type: "text", nullable: false),
                    ship_line1 = table.Column<string>(type: "text", nullable: false),
                    ship_line2 = table.Column<string>(type: "text", nullable: true),
                    ship_city = table.Column<string>(type: "text", nullable: false),
                    ship_state = table.Column<string>(type: "text", nullable: true),
                    ship_postal_code = table.Column<string>(type: "text", nullable: true),
                    ship_country = table.Column<string>(type: "text", nullable: false),
                    user_note = table.Column<string>(type: "text", nullable: true),
                    client_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tracking_reference = table.Column<string>(type: "text", nullable: true),
                    admin_note = table.Column<string>(type: "text", nullable: true),
                    fulfilled_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    fulfilled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    refunded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shop_orders", x => x.id);
                    table.ForeignKey(
                        name: "fk_shop_orders_shop_item_variants_variant_id",
                        column: x => x.variant_id,
                        principalTable: "shop_item_variants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_shop_orders_shop_items_shop_item_id",
                        column: x => x.shop_item_id,
                        principalTable: "shop_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "ix_ledger_entries_order_id_kind",
                table: "ledger_entries",
                columns: new[] { "order_id", "kind" },
                unique: true,
                filter: "order_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_daily_shop_picks_shop_item_id",
                table: "daily_shop_picks",
                column: "shop_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_shop_item_variants_shop_item_id",
                table: "shop_item_variants",
                column: "shop_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_shop_orders_shop_item_id",
                table: "shop_orders",
                column: "shop_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_shop_orders_status_created_at",
                table: "shop_orders",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_shop_orders_user_id_client_request_id",
                table: "shop_orders",
                columns: new[] { "user_id", "client_request_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_shop_orders_variant_id",
                table: "shop_orders",
                column: "variant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "daily_shop_picks");

            migrationBuilder.DropTable(
                name: "shop_orders");

            migrationBuilder.DropTable(
                name: "shop_item_variants");

            migrationBuilder.DropTable(
                name: "shop_items");

            migrationBuilder.DropIndex(
                name: "ix_ledger_entries_order_id_kind",
                table: "ledger_entries");

            migrationBuilder.DropColumn(
                name: "order_id",
                table: "ledger_entries");
        }
    }
}

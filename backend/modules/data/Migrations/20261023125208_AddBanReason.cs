using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace torque_backend.modules.data.Migrations
{
    /// <inheritdoc />
    public partial class AddBanReason : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ban_reason",
                table: "users",
                type: "text",
                nullable: true);

            // Bans made before this column: the Hackatime trust check left its marker in
            // the internal note; every other ban came from an admin.
            migrationBuilder.Sql("""
                UPDATE users SET ban_reason = CASE
                    WHEN internal_note LIKE '%hackatime_banned_at_%' THEN 'hackatime'
                    ELSE 'admin' END
                WHERE 'banned' = ANY(role);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ban_reason",
                table: "users");
        }
    }
}

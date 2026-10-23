using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace torque_backend.modules.data.Migrations
{
    /// <inheritdoc />
    public partial class AddLookupIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_shipments_user_id_created_at",
                table: "shipments",
                columns: new[] { "user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_projects_owner_user_id",
                table: "projects",
                column: "owner_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_devlogs_owner_user_id_created_at",
                table: "devlogs",
                columns: new[] { "owner_user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_devlogs_project_id_created_at",
                table: "devlogs",
                columns: new[] { "project_id", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_shipments_user_id_created_at",
                table: "shipments");

            migrationBuilder.DropIndex(
                name: "ix_projects_owner_user_id",
                table: "projects");

            migrationBuilder.DropIndex(
                name: "ix_devlogs_owner_user_id_created_at",
                table: "devlogs");

            migrationBuilder.DropIndex(
                name: "ix_devlogs_project_id_created_at",
                table: "devlogs");
        }
    }
}

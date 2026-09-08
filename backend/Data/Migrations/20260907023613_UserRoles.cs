using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace torque_backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class UserRoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE users ALTER COLUMN role DROP DEFAULT;");

            migrationBuilder.Sql(
                @"ALTER TABLE users
                  ALTER COLUMN role TYPE text[]
                  USING CASE WHEN role IS NULL THEN NULL ELSE ARRAY[role] END;");

            migrationBuilder.Sql("ALTER TABLE users ALTER COLUMN role DROP NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                @"ALTER TABLE users
                  ALTER COLUMN role TYPE text
                  USING CASE WHEN role IS NULL THEN '' ELSE array_to_string(role, ',') END;");

            migrationBuilder.Sql("ALTER TABLE users ALTER COLUMN role SET NOT NULL;");
        }
    }
}

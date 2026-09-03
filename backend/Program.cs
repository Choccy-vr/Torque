using Torque.Database;
using Torque.Auth;
using Torque.Testing;
using Torque.Users;
using DotNetEnv;

Env.Load();
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers(options =>
{
    options.Filters.Add<EnsureUserExistsFilter>();
});
builder.Services.AddScoped<EnsureUserExistsFilter>();
//builder.Services.AddFrontendCors(builder.Configuration);
builder.Services.AddAppDatabase(builder.Configuration);
builder.Services.AddSupabaseAuth(builder.Configuration);

var app = builder.Build();

//app.UseCors(CorsExtensions.FrontendPolicy);
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.UseTestingHarness();
}

app.MapControllers();
app.Run();

using System.Text.Json.Serialization;
using Torque.Airtable;
using Torque.Database;
using Torque.Auth;
using Torque.Crypto;
using Torque.Extensions;
using Torque.Frontend;
using Torque.Hackatime;
using Torque.Lapse;
using Torque.Payouts;
using Torque.Settings;
using Torque.Slack;
using Torque.Streaks;
using Torque.Testing;
using Torque.Users;
using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Torque.Data;

Env.Load();
var builder = WebApplication.CreateBuilder(args);

// Hosting platforms (Docker etc.) tell us which port to listen on through PORT
if (Environment.GetEnvironmentVariable("PORT") is { Length: > 0 } port)
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Services.AddControllers(options =>
{
    options.Filters.Add<EnsureUserExistsFilter>();
}).AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddScoped<EnsureUserExistsFilter>();
builder.Services.AddFrontendCors(builder.Configuration);
builder.Services.AddTokenEncryption(builder.Configuration);
builder.Services.AddAppDatabase(builder.Configuration);
builder.Services.AddHackClubAuth(builder.Configuration);
builder.Services.AddHackatime(builder.Configuration);
builder.Services.AddLapse(builder.Configuration);
builder.Services.AddAirtable(builder.Configuration);
builder.Services.AddSlack(builder.Configuration);
builder.Services.AddStreaks();
builder.Services.AddPayouts();
builder.Services.AddSettings();

var app = builder.Build();

// Outside Development, bring the database schema up to date on boot so a deploy never
// runs against missing tables. Set MIGRATE_ON_STARTUP=false to skip it.
if (!app.Environment.IsDevelopment() && app.Configuration["MIGRATE_ON_STARTUP"] != "false")
{
    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.Migrate();
}

app.UseForwardedProto();
app.UseCors(CorsExtensions.FrontendPolicy);
app.UseCsrfHeaderCheck();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.UseTestingHarness();
}

app.MapControllers();
app.UseFrontend();
app.Run();

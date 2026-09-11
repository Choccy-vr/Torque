using System.Text.Json.Serialization;
using Torque.Database;
using Torque.Auth;
using Torque.Extensions;
using Torque.Hackatime;
using Torque.Lapse;
using Torque.Testing;
using Torque.Users;
using DotNetEnv;

Env.Load();
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers(options =>
{
    options.Filters.Add<EnsureUserExistsFilter>();
}).AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddScoped<EnsureUserExistsFilter>();
builder.Services.AddFrontendCors(builder.Configuration);
builder.Services.AddAppDatabase(builder.Configuration);
builder.Services.AddSupabaseAuth(builder.Configuration);
builder.Services.AddHackatime(builder.Configuration);
builder.Services.AddLapse(builder.Configuration);

var app = builder.Build();

app.UseCors(CorsExtensions.FrontendPolicy);
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.UseTestingHarness();
}

app.MapControllers();
app.Run();

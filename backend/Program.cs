using Torque.Database;
using Torque.Auth;
using Torque.Testing;
using DotNetEnv;

Env.Load();
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
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

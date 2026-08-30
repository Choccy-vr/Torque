using Torque.Extensions;
using DotNetEnv;

Env.Load();
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
//builder.Services.AddFrontendCors(builder.Configuration);
builder.Services.AddAppDatabase(builder.Configuration);
var app = builder.Build();

//app.UseCors(CorsExtensions.FrontendPolicy);
app.MapControllers();
app.Run();
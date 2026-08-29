using Torque.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
//builder.Services.AddFrontendCors(builder.Configuration);

var app = builder.Build();

//app.UseCors(CorsExtensions.FrontendPolicy);
app.MapControllers();
app.Run();
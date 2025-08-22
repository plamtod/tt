using System.Diagnostics;
using CrewPortal.BackgroundServices;
using CrewPortal.BackgroundServices.Telemetry;
using Microsoft.ApplicationInsights.DependencyCollector;
using Microsoft.ApplicationInsights.Extensibility;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Bg = CrewPortal.BackgroundServices.Services;

const string isLocalEnv = "IsLocalEnvironment";
const string managedIdentityId = "BackgroundServices_Identity_ClientID";

using var loggerFactory = LoggerFactory.Create(loggingBuilder => loggingBuilder
       .SetMinimumLevel(LogLevel.Debug)
       .AddApplicationInsights()
       .AddConsole());

ILogger startupLogger = loggerFactory.CreateLogger<IFuncProgram>();

var host = new HostBuilder()
 .ConfigureFunctionsWorkerDefaults(workerApplication => workerApplication.UseMiddleware<GlobalExceptionHandlingMiddleware>())
 .ConfigureAppConfiguration((ctx, config) =>
 {
     config.AddJsonFile("appsettings.Func.json", optional: true, reloadOnChange: true)
    .AddJsonFile($"appsettings.Func.{ctx.HostingEnvironment.EnvironmentName}.json", optional: true, reloadOnChange: true);

     var tmpConfig = config.Build();
     var isLocalEnvironment = ctx.HostingEnvironment.IsEnvironment(EnvironmentNameHelper.Local)
                           || ctx.HostingEnvironment.IsEnvironment(EnvironmentNameHelper.LocalIntegration);

     Log.LogEnvironment(startupLogger, ctx.HostingEnvironment.EnvironmentName);
     Log.LogIsLocalEnvironment(startupLogger, isLocalEnvironment);
     ctx.Properties[isLocalEnv] = isLocalEnvironment;
     Services.ConfigureAzureVault(config, startupLogger, tmpConfig["KeyVaultName"], tmpConfig[managedIdentityId], isLocalEnvironment);
 })
.ConfigureServices((context, services) =>
{
    services.AddScoped<IRepository<FsriUpdateSync>, FsriUpdateSyncRepository>();

    services.AddApplicationInsightsTelemetryWorkerService(options => options.EnableDependencyTrackingTelemetryModule = true);
    services.Configure<DependencyTrackingTelemetryModule>(module =>
    {
        module.EnableSqlCommandTextInstrumentation = true;
        module.IncludeDiagnosticSourceActivities.Add("LinqToDB.DataProvider");

    });
    services.ConfigureFunctionsApplicationInsights();

    var isLocalEnvironment = (bool)context.Properties[isLocalEnv];
    Log.LogEnvironment(startupLogger, context.HostingEnvironment.EnvironmentName);

    services.AddScoped(provider =>
    {
        var connectionString = context.Configuration.GetConnectionString("Workflow");
        if (isLocalEnvironment)
        {
            connectionString += ";Authentication=\"Active Directory Default\"";
        }
        else
        {
            connectionString += $";User ID={context.Configuration[managedIdentityId]};Authentication=ActiveDirectoryManagedIdentity";
        }

        Log.LogConnectionString(startupLogger, connectionString);

        var baseOptions = new DataOptions()
                                .UseSqlServer(connectionString)
                                .UseTracing(TraceLevel.Info, ti =>
                                {
                                    Console.WriteLine(ti.SqlText);
                                    Console.WriteLine("Elapsed: " + ti.ExecutionTime?.TotalSeconds);
                                });
        var typedOptions = new DataOptions<WorkflowDataConnection>(baseOptions);

        return new WorkflowDataConnection(typedOptions);
    });

    services.AddSingleton(provider =>
    {
        var telemetryClient = provider.GetRequiredService<TelemetryClient>();
        return new TelemetryHelper(telemetryClient, null);
    });

    services.SetupConfigurations(context.Configuration, startupLogger);
    services.AddScoped<Bg.MetricsCollectionService>();
    services.AddScoped<Bg.PhoenixErrorHandlingService>();

    var customRoleName = context.Configuration["AzFunctionRoleName"] ?? "TimerAzureFunction";
    services.TryAddSingleton<ITelemetryInitializer>(new CustomRoleNameTelemetryInitializer(customRoleName));
})
.Build();

try
{
    await host.RunAsync();
}
catch (OptionsValidationException ex)
{
    await Console.Error.WriteLineAsync("Startup failed due to invalid configuration.");

    foreach (var failure in ex.Failures)
    {
        await Console.Error.WriteLineAsync(failure);
    }

    Environment.Exit(1);
}
catch (Exception ex)
{
    await Console.Error.WriteLineAsync(ex.Message);
    Environment.Exit(1);
}

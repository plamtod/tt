

const string isLocalEnv = "IsLocalEnvironment";

using var loggerFactory = LoggerFactory.Create(loggingBuilder => loggingBuilder
       .SetMinimumLevel(LogLevel.Debug)
       .AddApplicationInsights()
       .AddConsole());

ILogger startupLogger = loggerFactory.CreateLogger<IFuncProgram>();

var host = new HostBuilder()
 .ConfigureFunctionsWorkerDefaults()
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
     Services.ConfigureAzureVault(config, startupLogger, tmpConfig["KeyVaultName"], tmpConfig[Services.ManagedIdentityId], isLocalEnvironment);
 })
.ConfigureServices((context, services) =>
{
    services.ConfigureFunctionServices(context, startupLogger);
    services.AddHttpContextAccessor();
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
//
 public static IServiceCollection ConfigureFunctionServices(this IServiceCollection services, HostBuilderContext context, ILogger startupLogger)
 {
     services.AddLogging(logging =>
     {
         logging.AddApplicationInsights();
         logging.SetMinimumLevel(LogLevel.Information);
         logging.AddFilter("LinqToDB", LogLevel.Debug);
     });
     services.AddTelemetry();

     Log.LogEnvironment(startupLogger, context.HostingEnvironment.EnvironmentName);
     var isLocalEnvironment = (bool)context.Properties[isLocalEnv];

     services.ConfigureDbConnection(context.Configuration, startupLogger, isLocalEnvironment);
   
     services.SetupConfigurations(context.Configuration, startupLogger);
     services.ConfigureManagers();

     services.AddRepositories();
 

     services.ConfigureMsGraph(context.Configuration);
     services.ConfigureSignalr(context.Configuration, isLocalEnvironment);

     return services;
 }

public static IServiceCollection ConfigureSignalr(this IServiceCollection services, IConfiguration configuration, bool isLocalEnvironment)
{
    //------- CONFIGURE SIGNALR -------
    if (isLocalEnvironment)
    {
        services.AddSingleton(sp =>
        {
            var loggerFactory = sp.GetRequiredService<ILoggerFactory>();

            var manager = new ServiceManagerBuilder()
                .WithOptions(o =>
                {
                    o.ServiceEndpoints = new ServiceEndpoint[]
                    {
                        new(new Uri(configuration.GetValue<string>("CREW_SIGNALR_ENDPOINT")),
                            new DefaultAzureCredential())
                    };
                    o.ServiceTransportType = ServiceTransportType.Transient;
                    o.UseJsonObjectSerializer(new JsonObjectSerializer(
                        new JsonSerializerOptions()
                        {
                            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                        }));
                })
                .WithLoggerFactory(loggerFactory)
                .BuildServiceManager();

            // Create once and reuse
            var serviceContext = manager.CreateHubContextAsync("MainHub", cancellationToken: CancellationToken.None).GetAwaiter().GetResult();
            return serviceContext;
        });
    }
    else
    {
        services.AddSingleton(sp =>
        {
            var loggerFactory = sp.GetRequiredService<ILoggerFactory>();

            var manager = new ServiceManagerBuilder()
                .WithOptions(o =>
                {
                    o.ServiceEndpoints = new ServiceEndpoint[]
                    {
                        new(new Uri(configuration.GetValue<string>("CW_SIGNALR_ENDPOINT")),
                            new ManagedIdentityCredential(configuration[ManagedIdentityId])),
                    };
                    o.ServiceTransportType = ServiceTransportType.Transient;
                    o.UseJsonObjectSerializer(new JsonObjectSerializer(
                        new JsonSerializerOptions()
                        {
                            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                        }));
                })
                .WithLoggerFactory(loggerFactory)
                .BuildServiceManager();

            // Create once and reuse
            var serviceContext = manager.CreateHubContextAsync("MainHub", cancellationToken: CancellationToken.None).GetAwaiter().GetResult();
            return serviceContext;
        });
    }

    services.AddSingleton<ILiveUpdatesClient, FunctionsLiveUpdatesClient>();

    return services;
}

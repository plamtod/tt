m1
m2
.ConfigureServices((context, services) =>
{
    services.AddScoped<IRepository<FsriUpdateSync>, FsriUpdateSyncRepository>();

    services.AddApplicationInsightsTelemetryWorkerService();
    services.PostConfigure<DependencyTrackingTelemetryModule>(telemetryConfiguration =>
    telemetryConfiguration.EnableSqlCommandTextInstrumentation = true);
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

        var baseOptions = new DataOptions().UseSqlServer(connectionString);
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

    var isLocalEnvironment = (bool)context.Properties[isLocalEnv];
    Log.LogEnvironment(startupLogger, context.HostingEnvironment.EnvironmentName);

 "value": "[concat('DefaultEndpointsProtocol=https;AccountName=', parameters('storageAccountName'), ';AccountKey=', listKeys(resourceId('Microsoft.Storage/storageAccounts', parameters('storageAccountName')),
      '2021-09-01').keys[0].value, ';EndpointSuffix=', environment().suffixes.storage)]"

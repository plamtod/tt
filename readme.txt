m1
m2
.ConfigureServices((context, services) =>
{
    services.AddScoped<IRepository<FsriUpdateSync>, FsriUpdateSyncRepository>();

    services.PostConfigure<DependencyTrackingTelemetryModule>(telemetryConfiguration => telemetryConfiguration.EnableSqlCommandTextInstrumentation = true);
    services.AddApplicationInsightsTelemetryWorkerService();
    services.ConfigureFunctionsApplicationInsights();

    var isLocalEnvironment = (bool)context.Properties[isLocalEnv];
    Log.LogEnvironment(startupLogger, context.HostingEnvironment.EnvironmentName);

 "value": "[concat('DefaultEndpointsProtocol=https;AccountName=', parameters('storageAccountName'), ';AccountKey=', listKeys(resourceId('Microsoft.Storage/storageAccounts', parameters('storageAccountName')),
      '2021-09-01').keys[0].value, ';EndpointSuffix=', environment().suffixes.storage)]"

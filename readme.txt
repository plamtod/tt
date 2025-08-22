m1
m2
Name: APPLICATIONINSIGHTS_ENABLE_SQL_COMMAND_TEXT_INSTRUMENTATION
Value: true

    var isLocalEnvironment = (bool)context.Properties[isLocalEnv];
    Log.LogEnvironment(startupLogger, context.HostingEnvironment.EnvironmentName);

 "value": "[concat('DefaultEndpointsProtocol=https;AccountName=', parameters('storageAccountName'), ';AccountKey=', listKeys(resourceId('Microsoft.Storage/storageAccounts', parameters('storageAccountName')),
      '2021-09-01').keys[0].value, ';EndpointSuffix=', environment().suffixes.storage)]"

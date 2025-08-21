m1
m2
m3
 "value": "[concat('DefaultEndpointsProtocol=https;AccountName=', parameters('storageAccountName'), ';AccountKey=', listKeys(resourceId('Microsoft.Storage/storageAccounts', parameters('storageAccountName')),
      '2021-09-01').keys[0].value, ';EndpointSuffix=', environment().suffixes.storage)]"

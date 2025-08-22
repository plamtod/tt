m1
m2
namespace Microsoft.ApplicationInsights.Extensibility;

//
// Summary:
//     Encapsulates the global telemetry configuration typically loaded from the ApplicationInsights.config
//     file.
//
// Remarks:
//     All Microsoft.ApplicationInsights.DataContracts.TelemetryContext objects are
//     initialized using the Microsoft.ApplicationInsights.Extensibility.TelemetryConfiguration.Active
//     telemetry configuration provided by this class.
public sealed class TelemetryConfiguration : IDisposable
{
    internal readonly SamplingRateStore LastKnownSampleRateStore = new SamplingRateStore();
    private static object syncRoot;
    private static TelemetryConfiguration active;
    private readonly SnapshottingList<ITelemetryInitializer> telemetryInitializers = new SnapshottingList<ITelemetryInitializer>();
    private readonly TelemetrySinkCollection telemetrySinks = new TelemetrySinkCollection();
    private TelemetryProcessorChain telemetryProcessorChain;
    private string instrumentationKey = string.Empty;
    private string connectionString;
    private bool disableTelemetry;
    private TelemetryProcessorChainBuilder builder;
    private MetricManager metricManager;
    private IApplicationIdProvider applicationIdProvider;

 "value": "[concat('DefaultEndpointsProtocol=https;AccountName=', parameters('storageAccountName'), ';AccountKey=', listKeys(resourceId('Microsoft.Storage/storageAccounts', parameters('storageAccountName')),
      '2021-09-01').keys[0].value, ';EndpointSuffix=', environment().suffixes.storage)]"

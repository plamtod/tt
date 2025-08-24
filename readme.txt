 <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="9.0.0" />
 <PackageReference Include="Microsoft.Data.SqlClient" Version="6.1.1" />
 <PackageReference Include="OpenTelemetry.Instrumentation.SqlClient" Version="1.12.0-beta.2" />

 builder.Services.AddOpenTelemetry()
.WithTracing(tracing =>
{
    tracing.AddSource("LinqToDB.OpenTelemetry");
    tracing.AddSqlClientInstrumentation(options =>
    {
        options.SetDbStatementForText = true;
        options.RecordException = true;
    });
});

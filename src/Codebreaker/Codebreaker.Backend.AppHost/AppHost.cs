var builder = DistributedApplication.CreateBuilder(args);

var dataStore = builder.Configuration["DataStore"] ?? "InMemory";

var gameapis = builder.AddProject<Projects.Codebreaker_GameAPIs>("codebreaker-gameapis")
    .WithEnvironment("DataStore", dataStore);

if (dataStore == "SqlServer")
{
    var gamesdb = builder.AddSqlServer("gamessql")
        .WithDataVolume("games-volume")
        .AddDatabase("gamesdb");

    gameapis.WithReference(gamesdb).WaitFor(gamesdb);
}

builder.AddProject<Projects.CodeBreaker_Bot>("codebreaker-bot")
    .WithReference(gameapis).WaitFor(gameapis)
    .WithExternalHttpEndpoints();

#pragma warning disable ASPIREBROWSERLOGS001

// Aspire auto-injects OTEL_EXPORTER_OTLP_ENDPOINT pointing to the HTTPS gRPC endpoint.
// Override it with the plain HTTP OTLP/HTTP endpoint so Vite's built-in HTTP/1.1 proxy
// can forward telemetry from the browser without needing HTTP/2 or TLS.
var otlpHttpEndpoint = builder.Configuration["ASPIRE_DASHBOARD_OTLP_HTTP_ENDPOINT_URL"]
    ?? "http://localhost:4318";

builder.AddViteApp("codebreaker-frontend", "../Codebreaker.Frontend")
    .WithBrowserLogs()
    .WithExternalHttpEndpoints()
    .WithEnvironment("OTEL_EXPORTER_OTLP_ENDPOINT", otlpHttpEndpoint)
    .WithReference(gameapis)
    .WaitFor(gameapis);

#pragma warning restore ASPIREBROWSERLOGS001

builder.Build().Run();

using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using PortalEcf.Api.Data;
using PortalEcf.Api.Middleware;
using PortalEcf.Api.Repositories;
using PortalEcf.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// Acceso a datos (Dapper + SQL Server)
builder.Services.AddSingleton<IDbConnectionFactory, SqlConnectionFactory>();
builder.Services.AddScoped<IDashboardRepository, DashboardRepository>();
builder.Services.AddScoped<ISistemaRepository, SistemaRepository>();
builder.Services.AddScoped<IEncfEmitidoRepository, EncfEmitidoRepository>();
builder.Services.AddScoped<IEncfRecibidoRepository, EncfRecibidoRepository>();
builder.Services.AddScoped<IDocumentoRepository, DocumentoRepository>();
builder.Services.AddScoped<IDgiiLogRepository, DgiiLogRepository>();
builder.Services.AddScoped<ICertificacionRepository, CertificacionRepository>();

// Servicios de aplicación
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<ISistemaService, SistemaService>();
builder.Services.AddScoped<IEncfEmitidoService, EncfEmitidoService>();
builder.Services.AddScoped<IEncfRecibidoService, EncfRecibidoService>();
builder.Services.AddScoped<IDocumentoFirmaService, DocumentoFirmaService>();
builder.Services.AddScoped<ICertificacionService, CertificacionService>();
builder.Services.AddScoped<ICertificadoProvider, CertificadoProvider>();
builder.Services.AddSingleton<IXmlSignatureService, XmlSignatureService>();
builder.Services.AddScoped<IEcfPdfService, EcfPdfService>();

// Comunicación con los servicios web de la DGII
builder.Services.Configure<DgiiSettings>(builder.Configuration.GetSection(DgiiSettings.SectionName));

var dgiiTimeout = TimeSpan.FromSeconds(
    builder.Configuration.GetValue($"{DgiiSettings.SectionName}:TimeoutSegundos", 60));

builder.Services.AddHttpClient<IDgiiAuthenticator, DgiiAuthenticator>(c => c.Timeout = dgiiTimeout);
builder.Services.AddHttpClient<IDgiiClient, DgiiClient>(c => c.Timeout = dgiiTimeout);

// QuestPDF, licencia comunitaria (gratuita para empresas con ingresos < US$1M).
QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

// JWT Bearer
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
    throw new InvalidOperationException(
        "Jwt:Key no está configurado o es demasiado corta (mínimo 32 caracteres). " +
        "Defínala mediante variable de entorno (Jwt__Key) o user-secrets.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();

// Limita los intentos de login por IP para mitigar ataques de fuerza bruta.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

// Swagger/OpenAPI con soporte de JWT
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Portal ECF API",
        Version = "v1",
        Description = "API para recepción, emisión, firma, consulta y seguimiento de e-CF (DGII, República Dominicana)."
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Ingrese el token JWT obtenido en /api/auth/login."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

app.UseMiddleware<ErrorHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

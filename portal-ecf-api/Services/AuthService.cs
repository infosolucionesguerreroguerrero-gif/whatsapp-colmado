using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Dapper;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using PortalEcf.Api.Common;
using PortalEcf.Api.Data;
using PortalEcf.Api.Dtos;

namespace PortalEcf.Api.Services;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request);
}

/// <summary>
/// Autenticación contra dbo.AspNetUsers (hash de ASP.NET Core Identity) emitiendo JWT.
/// Los roles se leen de dbo.AspNetUserRoles/dbo.AspNetRoles si existen; en caso contrario
/// se asigna el rol por defecto 'Usuario'.
/// </summary>
public class AuthService : IAuthService
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;
    private readonly PasswordHasher<object> _passwordHasher = new();

    public AuthService(IDbConnectionFactory connectionFactory, IConfiguration configuration, ILogger<AuthService> logger)
    {
        _connectionFactory = connectionFactory;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Usuario) || string.IsNullOrWhiteSpace(request.Clave))
            throw new AppValidationException("Usuario y clave son requeridos.");

        const string sqlUsuario = @"
SELECT TOP 1 u.Id, u.UserName, u.PasswordHash, u.rnc AS Rnc, u.RazonSocial
FROM dbo.AspNetUsers u
WHERE u.NormalizedUserName = @Usuario OR u.NormalizedEmail = @Usuario;";

        const string sqlRoles = @"
SELECT r.Name
FROM dbo.AspNetUserRoles ur
JOIN dbo.AspNetRoles r ON r.Id = ur.RoleId
WHERE ur.UserId = @UserId;";

        using var connection = _connectionFactory.CreateConnection();
        var usuario = await connection.QuerySingleOrDefaultAsync<UsuarioLoginData>(sqlUsuario,
            new { Usuario = request.Usuario.Trim().ToUpperInvariant() });

        if (usuario is null || string.IsNullOrEmpty(usuario.PasswordHash) ||
            _passwordHasher.VerifyHashedPassword(new object(), usuario.PasswordHash, request.Clave)
                == PasswordVerificationResult.Failed)
        {
            _logger.LogWarning("Intento de login fallido para {Usuario}", request.Usuario);
            throw new UnauthorizedAccessException("Credenciales inválidas.");
        }

        List<string> roles;
        try
        {
            roles = (await connection.QueryAsync<string>(sqlRoles, new { UserId = usuario.Id })).ToList();
        }
        catch
        {
            roles = new List<string>();
        }
        if (roles.Count == 0) roles.Add("Usuario");

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, usuario.Id),
            new(ClaimTypes.Name, usuario.UserName ?? request.Usuario),
        };
        if (!string.IsNullOrEmpty(usuario.Rnc)) claims.Add(new Claim("rnc", usuario.Rnc));
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key no está configurado.")));
        var expira = DateTime.UtcNow.AddMinutes(_configuration.GetValue("Jwt:ExpiraMinutos", 60));

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: expira,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        _logger.LogInformation("Login exitoso: {Usuario}", usuario.UserName);

        return new LoginResponse
        {
            Token = new JwtSecurityTokenHandler().WriteToken(token),
            Expira = expira,
            Usuario = usuario.UserName ?? request.Usuario,
            Rnc = usuario.Rnc,
            RazonSocial = usuario.RazonSocial,
            Roles = roles
        };
    }

    private class UsuarioLoginData
    {
        public string Id { get; set; } = string.Empty;
        public string? UserName { get; set; }
        public string? PasswordHash { get; set; }
        public string? Rnc { get; set; }
        public string? RazonSocial { get; set; }
    }
}

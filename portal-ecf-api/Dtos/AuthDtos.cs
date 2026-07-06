namespace PortalEcf.Api.Dtos;

public class LoginRequest
{
    public string Usuario { get; set; } = string.Empty;
    public string Clave { get; set; } = string.Empty;
}

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public DateTime Expira { get; set; }
    public string Usuario { get; set; } = string.Empty;
    public string? Rnc { get; set; }
    public string? RazonSocial { get; set; }
    public List<string> Roles { get; set; } = new();
}

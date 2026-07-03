namespace PortalEcf.Api.Data;

/// <summary>Datos de empresa/certificado leídos de dbo.AspNetUsers (esquema real de producción).</summary>
public class UsuarioCertificadoData
{
    public string Id { get; set; } = string.Empty;
    public string? Rnc { get; set; }
    public string? RazonSocial { get; set; }
    public string? Ambiente { get; set; }
    public string? Certificate { get; set; }
    public string? CertPassWord { get; set; }
}

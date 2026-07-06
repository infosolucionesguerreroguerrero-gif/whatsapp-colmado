namespace PortalEcf.Api.Dtos;

public class SistemaEstadoResponse
{
    public int DiasVencimientoCertificado { get; set; }
    public DateTime? FechaVencimientoCertificado { get; set; }
    public bool ServicioDgiiEnLinea { get; set; }
    public string EstadoServicioDgii { get; set; } = string.Empty;
    public string AmbienteActual { get; set; } = string.Empty;
    public string RncEmpresa { get; set; } = string.Empty;
    public string NombreEmpresa { get; set; } = string.Empty;
    public bool AlertaCertificado { get; set; }
}

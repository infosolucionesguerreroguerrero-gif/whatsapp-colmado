namespace PortalEcf.Api.Dtos;

public class CertificacionResumenResponse
{
    public string AmbienteActual { get; set; } = string.Empty;
    public int CertificadosActivos { get; set; }
    public DateTime? ProximoVencimiento { get; set; }
    public int DiasParaVencimiento { get; set; }
    public bool AlertaVencimiento { get; set; }
    public int PruebasRealizadas { get; set; }
    public int PruebasExitosas { get; set; }
    public DateTime? UltimaConexionDgii { get; set; }
}

public class CertificadoResponse
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? Emisor { get; set; }
    public string? NumeroSerie { get; set; }
    public string? Huella { get; set; }
    public DateTime FechaEmision { get; set; }
    public DateTime FechaVencimiento { get; set; }
    public bool Activo { get; set; }
    public int DiasParaVencimiento { get; set; }
}

public class RegistrarCertificadoRequest
{
    public string Nombre { get; set; } = string.Empty;
    public string ArchivoBase64 { get; set; } = string.Empty;
    public string Clave { get; set; } = string.Empty;
    public bool Activar { get; set; } = true;
}

public class ProbarConexionDgiiResponse
{
    public bool Exitosa { get; set; }
    public string Ambiente { get; set; } = string.Empty;
    public string? Detalle { get; set; }
    public DateTime Fecha { get; set; }
}

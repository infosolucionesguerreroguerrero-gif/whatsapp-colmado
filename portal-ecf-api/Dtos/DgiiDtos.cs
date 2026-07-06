namespace PortalEcf.Api.Dtos;

public class ConsultaDgiiRequest
{
    public string RncEmisor { get; set; } = string.Empty;
    public string? RncComprador { get; set; }
    public string Encf { get; set; } = string.Empty;
    public string? CodigoSeguridad { get; set; }
    public DateTime? FechaEmision { get; set; }
    public decimal? MontoTotal { get; set; }
}

public class ConsultaDgiiResponse
{
    public bool Encontrado { get; set; }
    public string? Encf { get; set; }
    public string? RncEmisor { get; set; }
    public string? RncComprador { get; set; }
    public string? Estado { get; set; }
    public DateTime? FechaEmision { get; set; }
    public decimal? MontoTotal { get; set; }
    public string? MensajeDgii { get; set; }
}

public class DgiiEstadoServicioResponse
{
    public bool EnLinea { get; set; }
    public string Estado { get; set; } = string.Empty;
    public string Ambiente { get; set; } = string.Empty;
    public DateTime FechaConsulta { get; set; }
}

public class DgiiEstadoDocumentoResponse
{
    public long DocumentoId { get; set; }
    public string? Encf { get; set; }
    public string? TrackId { get; set; }
    public string Estado { get; set; } = string.Empty;
    public string? MensajeDgii { get; set; }
    public DateTime FechaConsulta { get; set; }
}

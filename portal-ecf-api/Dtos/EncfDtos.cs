namespace PortalEcf.Api.Dtos;

public class EncfListFilter
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public DateTime? FechaDesde { get; set; }
    public DateTime? FechaHasta { get; set; }
    public string? Estado { get; set; }
    public string? Encf { get; set; }
    public string? Rnc { get; set; }
    public string? TipoDocumento { get; set; }
    public int? EmpresaId { get; set; }
}

public class EncfEmitidoResponse
{
    public long Id { get; set; }
    public string Encf { get; set; } = string.Empty;
    public string TipoDocumento { get; set; } = string.Empty;
    public string RncEmisor { get; set; } = string.Empty;
    public string RncComprador { get; set; } = string.Empty;
    public string? RazonSocialComprador { get; set; }
    public DateTime FechaEmision { get; set; }
    public decimal MontoTotal { get; set; }
    public decimal TotalItbis { get; set; }
    public string Estado { get; set; } = string.Empty;
    public string? CodigoSeguridad { get; set; }
    public string? TrackIdDgii { get; set; }
    public string Ambiente { get; set; } = string.Empty;
    public DateTime FechaCreacion { get; set; }
}

public class EncfRecibidoResponse
{
    public long Id { get; set; }
    public string Encf { get; set; } = string.Empty;
    public string TipoDocumento { get; set; } = string.Empty;
    public string RncEmisor { get; set; } = string.Empty;
    public string? RazonSocialEmisor { get; set; }
    public string RncComprador { get; set; } = string.Empty;
    public DateTime FechaEmision { get; set; }
    public decimal MontoTotal { get; set; }
    public decimal TotalItbis { get; set; }
    public string Estado { get; set; } = string.Empty;
    public DateTime FechaRecepcion { get; set; }
}

public class CrearEncfDetalleRequest
{
    public string Descripcion { get; set; } = string.Empty;
    public decimal Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }
    public decimal Itbis { get; set; }
    public decimal MontoLinea { get; set; }
}

public class CrearEncfRequest
{
    public string Encf { get; set; } = string.Empty;
    public string TipoDocumento { get; set; } = string.Empty;
    public string RncEmisor { get; set; } = string.Empty;
    public string RncComprador { get; set; } = string.Empty;
    public string? RazonSocialComprador { get; set; }
    public DateTime FechaEmision { get; set; }
    public decimal MontoTotal { get; set; }
    public decimal TotalItbis { get; set; }
    public string Ambiente { get; set; } = "TestECF";
    public string XmlOriginal { get; set; } = string.Empty;
    public List<CrearEncfDetalleRequest> Detalles { get; set; } = new();
}

public class RecibirXmlRequest
{
    public string XmlContenido { get; set; } = string.Empty;
    public string? Encf { get; set; }
    public string? RncEmisor { get; set; }
    public string? Origen { get; set; }
}

public class EnviarDgiiResponse
{
    public long DocumentoId { get; set; }
    public string Encf { get; set; } = string.Empty;
    public string? TrackId { get; set; }
    public string Estado { get; set; } = string.Empty;
    public string? MensajeDgii { get; set; }
}

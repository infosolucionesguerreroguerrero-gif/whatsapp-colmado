namespace PortalEcf.Api.Dtos;

public class SearchResultItemResponse
{
    public long Id { get; set; }
    public string Tipo { get; set; } = string.Empty; // facturaEmitida | facturaRecibida | cliente | proveedor | documentoFirmado
    public string? Encf { get; set; }
    public string? Rnc { get; set; }
    public string? RazonSocial { get; set; }
    public DateTime? Fecha { get; set; }
    public decimal? Monto { get; set; }
    public string? Estado { get; set; }
    public string? NumeroInterno { get; set; }
}

public class GlobalSearchResponse
{
    public string Term { get; set; } = string.Empty;
    public List<SearchResultItemResponse> FacturasEmitidas { get; set; } = new();
    public List<SearchResultItemResponse> FacturasRecibidas { get; set; } = new();
    public List<SearchResultItemResponse> Clientes { get; set; } = new();
    public List<SearchResultItemResponse> Proveedores { get; set; } = new();
    public List<SearchResultItemResponse> DocumentosFirmados { get; set; } = new();
    public int TotalResultados =>
        FacturasEmitidas.Count + FacturasRecibidas.Count + Clientes.Count + Proveedores.Count + DocumentosFirmados.Count;
}

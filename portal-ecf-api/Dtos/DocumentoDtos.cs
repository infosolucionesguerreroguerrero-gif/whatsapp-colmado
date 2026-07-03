namespace PortalEcf.Api.Dtos;

public class FirmarDocumentoRequest
{
    public long? DocumentoId { get; set; }
    public string? XmlContenido { get; set; }
    public int? CertificadoId { get; set; }
}

public class FirmarDocumentoResponse
{
    public long DocumentoId { get; set; }
    public string? Encf { get; set; }
    public bool Firmado { get; set; }
    public DateTime FechaFirma { get; set; }
    public string? HuellaCertificado { get; set; }
    public string? XmlFirmado { get; set; }
}

public class ValidarFirmaRequest
{
    public long? DocumentoId { get; set; }
    public string? XmlContenido { get; set; }
}

public class ValidarFirmaResponse
{
    public bool FirmaValida { get; set; }
    public string? Detalle { get; set; }
    public string? HuellaCertificado { get; set; }
    public DateTime? FechaFirma { get; set; }
}

public class DocumentoFirmadoResponse
{
    public long Id { get; set; }
    public string? Encf { get; set; }
    public string? RncEmisor { get; set; }
    public DateTime FechaFirma { get; set; }
    public string? HuellaCertificado { get; set; }
    public string Estado { get; set; } = string.Empty;
}

public class DocumentoHistorialResponse
{
    public long Id { get; set; }
    public long DocumentoId { get; set; }
    public string EstadoAnterior { get; set; } = string.Empty;
    public string EstadoNuevo { get; set; } = string.Empty;
    public string? Comentario { get; set; }
    public string? Usuario { get; set; }
    public DateTime Fecha { get; set; }
}

public class CambiarEstadoRequest
{
    public string NuevoEstado { get; set; } = string.Empty;
    public string? Comentario { get; set; }
}

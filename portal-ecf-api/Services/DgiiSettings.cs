namespace PortalEcf.Api.Services;

/// <summary>Configuración de la sección <c>Dgii</c> de appsettings.</summary>
public class DgiiSettings
{
    public const string SectionName = "Dgii";

    public string Ambiente { get; set; } = "TestECF";
    public string BaseUrlTestECF { get; set; } = "https://ecf.dgii.gov.do/testecf";
    public string BaseUrlCerteCF { get; set; } = "https://ecf.dgii.gov.do/certecf";
    public string BaseUrlProduccion { get; set; } = "https://ecf.dgii.gov.do/ecf";
    public int TimeoutSegundos { get; set; } = 60;
    public string? RncEmisor { get; set; }
    public DgiiPaths Paths { get; set; } = new();

    /// <summary>URL base del ambiente indicado (o del configurado por defecto).</summary>
    public string BaseUrl(string? ambiente = null)
    {
        var valor = Normalizar(ambiente ?? Ambiente);
        return valor switch
        {
            "certecf" => BaseUrlCerteCF,
            "produccion" or "prod" => BaseUrlProduccion,
            _ => BaseUrlTestECF
        };
    }

    public string Url(string path, string? ambiente = null) =>
        $"{BaseUrl(ambiente).TrimEnd('/')}/{path.TrimStart('/')}";

    public static string Normalizar(string? ambiente) =>
        (ambiente ?? string.Empty).Trim().ToLowerInvariant()
            .Replace("ó", "o").Replace("á", "a").Replace("é", "e");
}

/// <summary>
/// Rutas relativas de los servicios de la DGII. Se exponen en configuración para poder
/// ajustarlas sin recompilar si la DGII cambia sus endpoints.
/// </summary>
public class DgiiPaths
{
    public string Semilla { get; set; } = "/autenticacion/api/autenticacion/semilla";
    public string ValidarSemilla { get; set; } = "/autenticacion/api/autenticacion/validarsemilla";
    public string Recepcion { get; set; } = "/recepcion/api/facturaselectronicas";
    public string ConsultaEstado { get; set; } = "/consultaresultado/api/consultas/estado";
    public string ConsultaEcf { get; set; } = "/consultas/api/consultas/ecf";
    public string EstatusServicios { get; set; } = "/consultaresultado/api/estatusservicios/obtenerestatus";
}

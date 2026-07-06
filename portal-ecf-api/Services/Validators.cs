using System.Text.RegularExpressions;

namespace PortalEcf.Api.Services;

public static class Validators
{
    private static readonly Regex RncRegex = new(@"^\d{9}(\d{2})?$", RegexOptions.Compiled);
    private static readonly Regex EncfRegex = new(@"^E\d{2}\d{10}$", RegexOptions.Compiled);

    public static readonly IReadOnlySet<string> TiposComprobante = new HashSet<string>
    {
        "31", "32", "33", "34", "41", "43", "44", "45", "46", "47"
    };

    public static readonly IReadOnlySet<string> EstadosValidos = new HashSet<string>
    {
        "Pendiente", "EnProceso", "Aceptado", "Aceptado Condicional", "Rechazado", "Error", "Anulado"
    };

    public static bool EsRncValido(string? rnc) =>
        !string.IsNullOrWhiteSpace(rnc) && RncRegex.IsMatch(rnc.Trim());

    public static bool EsEncfValido(string? encf) =>
        !string.IsNullOrWhiteSpace(encf) && EncfRegex.IsMatch(encf.Trim());

    public static bool EsTipoComprobanteValido(string? tipo) =>
        !string.IsNullOrWhiteSpace(tipo) && TiposComprobante.Contains(tipo.Trim());

    public static bool EsEstadoValido(string? estado) =>
        !string.IsNullOrWhiteSpace(estado) && EstadosValidos.Contains(estado.Trim());

    public static bool EsAmbienteValido(string? ambiente) =>
        ambiente is "TestECF" or "CerteCF" or "Producción" or "Produccion";
}

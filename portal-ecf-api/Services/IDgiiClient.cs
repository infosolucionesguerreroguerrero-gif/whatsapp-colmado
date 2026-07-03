using PortalEcf.Api.Dtos;

namespace PortalEcf.Api.Services;

/// <summary>
/// Cliente desacoplado para la comunicación con los servicios de la DGII.
/// La implementación real debe consumir los web services oficiales de e-CF
/// (recepción, consulta de estado, consulta de e-NCF, autenticación con certificado).
/// </summary>
public interface IDgiiClient
{
    Task<EnviarDgiiResponse> EnviarDocumentoAsync(long documentoId, string encf, string xmlFirmado, string ambiente);
    Task<ConsultaDgiiResponse> ConsultarEncfAsync(ConsultaDgiiRequest request);
    Task<DgiiEstadoServicioResponse> ConsultarEstadoServicioAsync();
    Task<DgiiEstadoDocumentoResponse> ConsultarEstadoDocumentoAsync(long documentoId, string? trackId, string? encf);
    Task<ProbarConexionDgiiResponse> ProbarConexionAsync();
}

using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;

namespace PortalEcf.Api.Repositories;

public interface IDocumentoRepository
{
    Task<PagedResponse<DocumentoFirmadoResponse>> GetFirmadosAsync(int page, int pageSize);
    Task<DocumentoFirmadoResponse?> GetFirmadoByIdAsync(long id);
    Task<long> RegistrarFirmaAsync(long? documentoId, string? encf, string? rncEmisor, string xmlFirmado, string huella, string usuario);
    Task<IReadOnlyList<DocumentoHistorialResponse>> GetHistorialAsync(long documentoId);
    Task<string?> GetEstadoActualAsync(long documentoId);
    Task CambiarEstadoAsync(long documentoId, string nuevoEstado, string? comentario, string usuario);
}

using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;

namespace PortalEcf.Api.Repositories;

public interface IEncfRecibidoRepository
{
    Task<PagedResponse<EncfRecibidoResponse>> GetListAsync(EncfListFilter filter);
    Task<EncfRecibidoResponse?> GetByIdAsync(long id);
    Task<bool> ExisteEncfAsync(string encf, string rncEmisor);
    Task<long> RecibirXmlAsync(RecibirXmlRequest request, string encf, string rncEmisor, string rncComprador,
        string tipoDocumento, DateTime fechaEmision, decimal montoTotal, decimal totalItbis, string usuario);
    Task<string?> GetXmlAsync(long id);
    Task ActualizarEstadoAsync(long id, string estado, string? comentario, string usuario);
}

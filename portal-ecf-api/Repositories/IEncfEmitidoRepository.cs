using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;

namespace PortalEcf.Api.Repositories;

public interface IEncfEmitidoRepository
{
    Task<PagedResponse<EncfEmitidoResponse>> GetListAsync(EncfListFilter filter);
    Task<EncfEmitidoResponse?> GetByIdAsync(long id);
    Task<bool> ExisteEncfAsync(string encf, string rncEmisor);
    Task<long> CrearAsync(CrearEncfRequest request, string usuario);
    Task<string?> GetXmlAsync(long id, bool firmado);
    Task ActualizarEnvioDgiiAsync(long id, string estado, string? trackId, string usuario);
    Task GuardarXmlFirmadoAsync(long id, string xmlFirmado);
}

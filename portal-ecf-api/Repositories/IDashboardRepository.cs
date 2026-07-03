using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;

namespace PortalEcf.Api.Repositories;

public interface IDashboardRepository
{
    Task<DashboardResumenResponse> GetResumenAsync(DashboardResumenFilter filter);
    Task<PagedResponse<ActividadRecienteItemResponse>> GetActividadRecienteAsync(ActividadRecienteFilter filter);
    Task<GlobalSearchResponse> GlobalSearchAsync(string term, int maxPorCategoria);
}

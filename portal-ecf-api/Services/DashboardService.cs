using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Repositories;

namespace PortalEcf.Api.Services;

public interface IDashboardService
{
    Task<DashboardResumenResponse> GetResumenAsync(DashboardResumenFilter filter);
    Task<PagedResponse<ActividadRecienteItemResponse>> GetActividadRecienteAsync(ActividadRecienteFilter filter);
    Task<GlobalSearchResponse> GlobalSearchAsync(string term);
}

public class DashboardService : IDashboardService
{
    private readonly IDashboardRepository _repository;
    private readonly ILogger<DashboardService> _logger;

    public DashboardService(IDashboardRepository repository, ILogger<DashboardService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task<DashboardResumenResponse> GetResumenAsync(DashboardResumenFilter filter)
    {
        if (filter.FechaDesde.HasValue && filter.FechaHasta.HasValue && filter.FechaDesde > filter.FechaHasta)
            throw new AppValidationException("fechaDesde no puede ser mayor que fechaHasta.");

        if (filter.RncEmpresa is not null && !Validators.EsRncValido(filter.RncEmpresa))
            throw new AppValidationException("El RNC de empresa no es válido.");

        if (filter.Ambiente is not null && !Validators.EsAmbienteValido(filter.Ambiente))
            throw new AppValidationException("El ambiente debe ser CerteCF o Producción.");

        return await _repository.GetResumenAsync(filter);
    }

    public Task<PagedResponse<ActividadRecienteItemResponse>> GetActividadRecienteAsync(ActividadRecienteFilter filter)
    {
        if (filter.Estado is not null && !Validators.EsEstadoValido(filter.Estado))
            throw new AppValidationException("Estado no válido.");

        return _repository.GetActividadRecienteAsync(filter);
    }

    public Task<GlobalSearchResponse> GlobalSearchAsync(string term)
    {
        if (string.IsNullOrWhiteSpace(term) || term.Trim().Length < 3)
            throw new AppValidationException("El término de búsqueda debe tener al menos 3 caracteres.");

        _logger.LogInformation("Búsqueda global: {Term}", term);
        return _repository.GlobalSearchAsync(term.Trim(), 10);
    }
}

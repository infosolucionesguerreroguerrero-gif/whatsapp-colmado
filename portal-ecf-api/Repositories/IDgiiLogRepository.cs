namespace PortalEcf.Api.Repositories;

public interface IDgiiLogRepository
{
    Task RegistrarComunicacionAsync(long? documentoId, string operacion, string request, string response, bool exitosa, string ambiente);
}

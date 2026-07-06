using System.Data;

namespace PortalEcf.Api.Data;

public interface IDbConnectionFactory
{
    IDbConnection CreateConnection();
}

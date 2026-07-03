using System.Data;
using Microsoft.Data.SqlClient;

namespace PortalEcf.Api.Data;

public class SqlConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public SqlConnectionFactory(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection no está configurado.");
    }

    public IDbConnection CreateConnection() => new SqlConnection(_connectionString);
}

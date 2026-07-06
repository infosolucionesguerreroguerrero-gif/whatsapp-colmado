namespace PortalEcf.Api.Dtos;

public class DashboardResumenFilter
{
    public DateTime? FechaDesde { get; set; }
    public DateTime? FechaHasta { get; set; }
    public int? EmpresaId { get; set; }
    public string? RncEmpresa { get; set; }
    public string? Ambiente { get; set; }
}

public class DashboardResumenResponse
{
    public int TotalFacturas { get; set; }
    public int TotalDevoluciones { get; set; }
    public int TotalGastos { get; set; }
    public decimal TotalMes { get; set; }
    public int FacturasDelDia { get; set; }
    public decimal VentasDelMes { get; set; }
    public decimal DevolucionesDelMes { get; set; }
    public decimal GastosDelMes { get; set; }
    public int Aceptados { get; set; }
    public int Rechazados { get; set; }
    public int EnProceso { get; set; }
    public int Pendientes { get; set; }
}

public class ActividadRecienteFilter
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public DateTime? FechaDesde { get; set; }
    public DateTime? FechaHasta { get; set; }
    public string? Estado { get; set; }
    public string? RncComprador { get; set; }
    public string? Ncf { get; set; }
    public string? TipoDocumento { get; set; }
}

public class ActividadRecienteItemResponse
{
    public long Id { get; set; }
    public string Ncf { get; set; } = string.Empty;
    public string RncComprador { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public decimal Monto { get; set; }
    public string Estado { get; set; } = string.Empty;
}

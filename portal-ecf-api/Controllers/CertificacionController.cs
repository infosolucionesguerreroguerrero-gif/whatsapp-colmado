using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Services;

namespace PortalEcf.Api.Controllers;

[ApiController]
[Route("api/certificacion")]
[Authorize]
public class CertificacionController : ControllerBase
{
    private readonly ICertificacionService _service;

    public CertificacionController(ICertificacionService service)
    {
        _service = service;
    }

    private string Usuario => User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "sistema";

    [HttpGet("resumen")]
    public async Task<ActionResult<ApiResponse<CertificacionResumenResponse>>> GetResumen()
    {
        var data = await _service.GetResumenAsync();
        return Ok(ApiResponse<CertificacionResumenResponse>.Ok(data));
    }

    [HttpGet("certificados")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<CertificadoResponse>>>> GetCertificados()
    {
        var data = await _service.GetCertificadosAsync();
        return Ok(ApiResponse<IReadOnlyList<CertificadoResponse>>.Ok(data));
    }

    /// <summary>Registro de certificado digital (solo Admin).</summary>
    [HttpPost("certificados")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<CertificadoResponse>>> RegistrarCertificado([FromBody] RegistrarCertificadoRequest request)
    {
        var data = await _service.RegistrarCertificadoAsync(request, Usuario);
        return CreatedAtAction(nameof(GetCertificados), null,
            ApiResponse<CertificadoResponse>.Ok(data, "Certificado registrado correctamente"));
    }

    [HttpPost("probar-conexion-dgii")]
    [Authorize(Roles = "Admin,Supervisor")]
    public async Task<ActionResult<ApiResponse<ProbarConexionDgiiResponse>>> ProbarConexionDgii()
    {
        var data = await _service.ProbarConexionDgiiAsync();
        return Ok(ApiResponse<ProbarConexionDgiiResponse>.Ok(data));
    }
}

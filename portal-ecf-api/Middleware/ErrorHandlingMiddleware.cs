using System.Net;
using System.Text.Json;
using PortalEcf.Api.Common;

namespace PortalEcf.Api.Middleware;

public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        HttpStatusCode statusCode;
        ApiResponse<object> response;

        switch (exception)
        {
            case AppValidationException validationEx:
                statusCode = HttpStatusCode.BadRequest;
                response = ApiResponse<object>.Fail(validationEx.Message, validationEx.Errors);
                break;
            case NotFoundException:
                statusCode = HttpStatusCode.NotFound;
                response = ApiResponse<object>.Fail(exception.Message);
                break;
            case ConflictException:
                statusCode = HttpStatusCode.Conflict;
                response = ApiResponse<object>.Fail(exception.Message);
                break;
            case ForbiddenException:
                statusCode = HttpStatusCode.Forbidden;
                response = ApiResponse<object>.Fail(exception.Message);
                break;
            case UnauthorizedAccessException:
                statusCode = HttpStatusCode.Unauthorized;
                response = ApiResponse<object>.Fail("No autenticado.");
                break;
            default:
                statusCode = HttpStatusCode.InternalServerError;
                _logger.LogError(exception, "Error no controlado en {Path}", context.Request.Path);
                response = ApiResponse<object>.Fail("Ha ocurrido un error inesperado.");
                break;
        }

        if (statusCode != HttpStatusCode.InternalServerError)
        {
            _logger.LogWarning(exception, "Error controlado ({StatusCode}) en {Path}", (int)statusCode, context.Request.Path);
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;
        await context.Response.WriteAsync(JsonSerializer.Serialize(response, JsonOptions));
    }
}

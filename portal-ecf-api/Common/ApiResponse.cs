namespace PortalEcf.Api.Common;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public List<string> Errors { get; set; } = new();

    public static ApiResponse<T> Ok(T data, string message = "Operación realizada correctamente") =>
        new() { Success = true, Message = message, Data = data };

    public static ApiResponse<T> Fail(string message, IEnumerable<string>? errors = null) =>
        new() { Success = false, Message = message, Errors = errors?.ToList() ?? new List<string>() };
}

public class ApiResponse : ApiResponse<object>
{
    public static ApiResponse Ok(string message = "Operación realizada correctamente") =>
        new() { Success = true, Message = message };

    public new static ApiResponse Fail(string message, IEnumerable<string>? errors = null) =>
        new() { Success = false, Message = message, Errors = errors?.ToList() ?? new List<string>() };
}

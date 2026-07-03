# Portal ECF API

API REST en ASP.NET Core 8 (Dapper + SQL Server, sin Entity Framework) para recepción, emisión, firma, consulta y seguimiento de e-CF de la DGII (República Dominicana).

## Requisitos

- .NET 8 SDK
- SQL Server con la base de datos existente de producción

## Configuración

Los secretos NO van en `appsettings.json` (se dejan vacíos en el repositorio); configurarlos con variables de entorno o user-secrets:

```bash
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=...;Database=...;User Id=...;Password=...;Encrypt=True;"
dotnet user-secrets set "Jwt:Key" "<clave secreta de al menos 32 caracteres>"
# o variables de entorno: ConnectionStrings__DefaultConnection y Jwt__Key
```

La aplicación falla al iniciar si faltan estos valores.

Otras claves de `appsettings.json`:
- `Dgii:*` — URLs base por ambiente (`TestECF`, `CerteCF`, `Producción`).
- `Certificado:DiasAlertaVencimiento` — umbral de alerta de vencimiento (por defecto 30).

## Ejecución

```bash
dotnet run
```

Swagger disponible en `/swagger` (ambiente Development).

## Mapeo al esquema real de la base de datos

| Módulo | Tabla real |
|---|---|
| eNCF emitidos, dashboard, actividad reciente, firmados, historial de estados | `dbo.ECF` |
| XML (original/firmado) y eNCF recibidos | `dbo.DocumentosXML` (vinculado a `dbo.ECF` por `NCF` + `RncEmisor`) |
| Certificación (pruebas CerteCF) | `dbo.ecfCertef` |
| Tokens de autenticación DGII | `dbo.DgiiTokens` |
| Empresa, certificado digital (base64 + clave), ambiente, login | `dbo.AspNetUsers` |
| Configuración clave/valor (ej. `Ambiente`) | `dbo.config` |

Notas:

- El tipo de comprobante se deriva del eNCF: `SUBSTRING(eNCF, 2, 2)` ('31', '32', '34', '41', '47'...).
- `dbo.ECF.FechaEmision` es varchar formato 105 (`dd-mm-yyyy`); las consultas usan la columna calculada `FechaEmisionDate`.
- La fecha de vencimiento del certificado se calcula cargando el X509 desde `AspNetUsers.Certificate`.
- Los documentos recibidos se almacenan en `dbo.DocumentosXML` con `TipoDocumento = 'Recibido'`; los montos se extraen del propio XML.

## Tablas opcionales (aditivas)

El esquema actual no tiene tablas de historial de estados ni de logs de comunicación con DGII. Para cumplir las reglas "registrar todo cambio de estado" y "registrar request/response DGII", el script `sql/tablas_opcionales.sql` crea (solo si no existen) `dbo.EcfHistorial` y `dbo.LogsDgii`. **No modifica ninguna tabla existente.** Si no se desea crearlas, comentar los INSERT correspondientes en `EncfEmitidoRepository`, `DocumentoRepository` y `DgiiLogRepository`.

## Autenticación

`POST /api/auth/login` valida usuario/clave contra `dbo.AspNetUsers` (hash de ASP.NET Core Identity) y emite un JWT. Roles desde `dbo.AspNetUserRoles`/`dbo.AspNetRoles` si existen; por defecto rol `Usuario`. Los endpoints sensibles requieren `[Authorize]`; cambios manuales de estado requieren rol `Admin` o `Supervisor`; registrar certificados requiere `Admin`.

## Pendientes / TODO

- `DgiiClient` es un stub desacoplado mediante `IDgiiClient`: implementar la integración real (semilla, firma de semilla, token, envío y consulta) según los servicios de la DGII.
- Firma XML-DSig real en `DocumentoFirmaService` (estructura y persistencia ya implementadas).
- Generación de PDF (representación impresa) del e-CF.

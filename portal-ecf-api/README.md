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
- `Dgii:*` — URLs base por ambiente (`TestECF`, `CerteCF`, `Producción`), `TimeoutSegundos`, `RncEmisor` (RNC cuyo certificado se usa para autenticarse; si se deja vacío se toma el primer certificado vigente) y `Dgii:Paths:*` con las rutas relativas de cada servicio de la DGII (semilla, validar semilla, recepción, consulta de estado, consulta de e-CF y estatus de servicios), configurables sin recompilar.
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

## Integración con la DGII

`DgiiClient` consume los servicios reales de la DGII. La autenticación (`DgiiAuthenticator`) hace el ciclo
semilla → firma de la semilla con el certificado digital → canje por token bearer, y reutiliza el token
mientras esté vigente (se renueva automáticamente y ante un 401). Cada request/response se registra en
`dbo.LogsDgii`. Operaciones soportadas: envío del e-CF firmado (multipart `{RNCEmisor}{eNCF}.xml`),
consulta de estado por TrackId, consulta de e-NCF y estatus de los servicios.

El token se cachea en memoria del proceso; no se persiste en `dbo.DgiiTokens`.

## Firma digital

`XmlSignatureService` firma con XML-DSig envuelto (RSA-SHA256, C14N, `KeyInfo/X509Data`) usando el
certificado de `dbo.AspNetUsers` que corresponda al RNC emisor del documento, y agrega el nodo
`<Signature>` como último hijo del elemento raíz. `POST /api/documentos/validar-firma` verifica la firma
con `SignedXml.CheckSignature` contra el certificado incluido en la firma e informa si está fuera de vigencia.

## Representación impresa (PDF)

`GET /api/encf/emitidos/{id}/pdf` genera la representación impresa con QuestPDF (licencia Community):
datos del emisor y del comprador, e-NCF, código de seguridad, TrackId, detalle de líneas leído del XML
(firmado si existe) y totales. En Linux requiere las fuentes del sistema (`libfontconfig1`).

## Pendientes / TODO

- Sello QR y código de seguridad calculado sobre la firma en la representación impresa.
- Persistir los tokens de la DGII en `dbo.DgiiTokens` para compartirlos entre instancias.

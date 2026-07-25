using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Xml;
using PortalEcf.Api.Common;

namespace PortalEcf.Api.Services;

public record ResultadoValidacionFirma(bool Valida, string Detalle, string? Huella, DateTime? FechaFirma);

/// <summary>
/// Firma y validación XML-DSig (firma envuelta, RSA-SHA256) según lo exigido por la DGII
/// para los e-CF y para la validación de la semilla de autenticación.
/// </summary>
public interface IXmlSignatureService
{
    string Firmar(string xml, X509Certificate2 certificado);
    ResultadoValidacionFirma Validar(string xml);
}

public class XmlSignatureService : IXmlSignatureService
{
    public string Firmar(string xml, X509Certificate2 certificado)
    {
        var documento = CargarDocumento(xml);

        var rsa = certificado.GetRSAPrivateKey()
            ?? throw new ConflictException("El certificado digital no tiene clave privada RSA utilizable.");

        var signedXml = new SignedXml(documento) { SigningKey = rsa };
        signedXml.SignedInfo!.CanonicalizationMethod = SignedXml.XmlDsigC14NTransformUrl;
        signedXml.SignedInfo.SignatureMethod = SignedXml.XmlDsigRSASHA256Url;

        var reference = new Reference(string.Empty) { DigestMethod = SignedXml.XmlDsigSHA256Url };
        reference.AddTransform(new XmlDsigEnvelopedSignatureTransform());
        reference.AddTransform(new XmlDsigC14NTransform());
        signedXml.AddReference(reference);

        var keyInfo = new KeyInfo();
        keyInfo.AddClause(new KeyInfoX509Data(certificado, X509IncludeOption.EndCertOnly));
        signedXml.KeyInfo = keyInfo;

        signedXml.ComputeSignature();

        // La DGII exige la firma como último elemento hijo del nodo raíz.
        documento.DocumentElement!.AppendChild(documento.ImportNode(signedXml.GetXml(), true));

        return Serializar(documento);
    }

    public ResultadoValidacionFirma Validar(string xml)
    {
        XmlDocument documento;
        try
        {
            documento = CargarDocumento(xml);
        }
        catch (Exception ex)
        {
            return new ResultadoValidacionFirma(false, $"XML inválido: {ex.Message}", null, null);
        }

        var nodos = documento.GetElementsByTagName("Signature", SignedXml.XmlDsigNamespaceUrl);
        if (nodos.Count == 0)
            return new ResultadoValidacionFirma(false, "El documento no contiene nodo Signature.", null, null);

        var signedXml = new SignedXml(documento);
        try
        {
            signedXml.LoadXml((XmlElement)nodos[0]!);
        }
        catch (Exception ex)
        {
            return new ResultadoValidacionFirma(false, $"No se pudo leer la firma: {ex.Message}", null, null);
        }

        var certificado = (signedXml.KeyInfo ?? new KeyInfo())
            .OfType<KeyInfoX509Data>()
            .SelectMany(k => k.Certificates?.OfType<X509Certificate2>() ?? Enumerable.Empty<X509Certificate2>())
            .FirstOrDefault();

        if (certificado is null)
            return new ResultadoValidacionFirma(false, "La firma no incluye el certificado del firmante (KeyInfo/X509Data).", null, null);

        using (certificado)
        {
            var valida = signedXml.CheckSignature(certificado, verifySignatureOnly: true);
            var vigente = DateTime.Now >= certificado.NotBefore && DateTime.Now <= certificado.NotAfter;

            var detalle = valida
                ? vigente
                    ? "Firma válida."
                    : $"Firma válida, pero el certificado está fuera de vigencia (vence {certificado.NotAfter:dd/MM/yyyy})."
                : "La firma no coincide con el contenido del documento.";

            return new ResultadoValidacionFirma(valida, detalle, certificado.Thumbprint, LeerFechaFirma(documento));
        }
    }

    private static DateTime? LeerFechaFirma(XmlDocument documento)
    {
        var nodo = documento.GetElementsByTagName("SigningTime", "http://uri.etsi.org/01903/v1.3.2#")
            .OfType<XmlNode>()
            .FirstOrDefault();

        return DateTime.TryParse(nodo?.InnerText, out var fecha) ? fecha : null;
    }

    private static XmlDocument CargarDocumento(string xml)
    {
        var documento = new XmlDocument { PreserveWhitespace = true, XmlResolver = null };
        documento.LoadXml(xml);
        if (documento.DocumentElement is null)
            throw new AppValidationException("El XML no tiene elemento raíz.");
        return documento;
    }

    private static string Serializar(XmlDocument documento)
    {
        using var stringWriter = new StringWriter();
        using (var writer = XmlWriter.Create(stringWriter, new XmlWriterSettings
               {
                   OmitXmlDeclaration = documento.FirstChild is not XmlDeclaration,
                   Encoding = new UTF8Encoding(false),
                   Indent = false
               }))
        {
            documento.Save(writer);
        }

        return stringWriter.ToString();
    }
}

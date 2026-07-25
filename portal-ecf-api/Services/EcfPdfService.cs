using System.Globalization;
using System.Xml.Linq;
using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Repositories;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PortalEcf.Api.Services;

/// <summary>Genera la representación impresa (PDF) de un e-CF emitido.</summary>
public interface IEcfPdfService
{
    Task<byte[]> GenerarAsync(long documentoId);
}

public class EcfPdfService : IEcfPdfService
{
    private static readonly CultureInfo Cultura = CultureInfo.GetCultureInfo("es-DO");

    private readonly IEncfEmitidoRepository _repository;

    public EcfPdfService(IEncfEmitidoRepository repository)
    {
        _repository = repository;
    }

    public async Task<byte[]> GenerarAsync(long documentoId)
    {
        var documento = await _repository.GetByIdAsync(documentoId)
            ?? throw new NotFoundException($"No existe el documento emitido con id {documentoId}.");

        var xml = await _repository.GetXmlAsync(documentoId, firmado: true)
                  ?? await _repository.GetXmlAsync(documentoId, firmado: false);

        var emisor = LeerEmisor(xml);
        var items = LeerItems(xml);

        return Documento(documento, emisor, items).GeneratePdf();
    }

    private static IDocument Documento(EncfEmitidoResponse ecf, DatosEmisor emisor, IReadOnlyList<LineaItem> items) =>
        QuestPDF.Fluent.Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.Letter);
                page.Margin(30);
                page.DefaultTextStyle(x => x.FontSize(9).FontFamily(Fonts.Arial));

                page.Header().Element(c => Encabezado(c, ecf, emisor));
                page.Content().PaddingVertical(10).Element(c => Contenido(c, ecf, items));
                page.Footer().AlignCenter().Text(t =>
                {
                    t.Span("Representación impresa del e-CF · ");
                    t.Span($"Ambiente: {ecf.Ambiente} · ");
                    t.Span($"Generado el {DateTime.Now.ToString("dd/MM/yyyy HH:mm", Cultura)}");
                });
            });
        });

    private static void Encabezado(IContainer container, EncfEmitidoResponse ecf, DatosEmisor emisor)
    {
        container.Row(row =>
        {
            row.RelativeItem().Column(col =>
            {
                col.Item().Text(emisor.RazonSocial ?? ecf.RncEmisor).FontSize(14).Bold();
                col.Item().Text($"RNC: {ecf.RncEmisor}");
                if (!string.IsNullOrWhiteSpace(emisor.Direccion)) col.Item().Text(emisor.Direccion);
                if (!string.IsNullOrWhiteSpace(emisor.Telefono)) col.Item().Text($"Tel.: {emisor.Telefono}");
            });

            row.ConstantItem(230).Border(1).Padding(8).Column(col =>
            {
                col.Item().AlignCenter().Text(Descripcion(ecf.TipoDocumento)).Bold();
                col.Item().AlignCenter().Text($"e-NCF: {ecf.Encf}").FontSize(11).Bold();
                col.Item().Text($"Fecha de emisión: {ecf.FechaEmision.ToString("dd/MM/yyyy", Cultura)}");
                col.Item().Text($"Estado DGII: {ecf.Estado}");
                if (!string.IsNullOrWhiteSpace(ecf.CodigoSeguridad))
                    col.Item().Text($"Código de seguridad: {ecf.CodigoSeguridad}");
                if (!string.IsNullOrWhiteSpace(ecf.TrackIdDgii))
                    col.Item().Text($"TrackId: {ecf.TrackIdDgii}").FontSize(7);
            });
        });
    }

    private static void Contenido(IContainer container, EncfEmitidoResponse ecf, IReadOnlyList<LineaItem> items)
    {
        container.Column(col =>
        {
            col.Spacing(10);

            col.Item().Border(1).Padding(8).Column(comprador =>
            {
                comprador.Item().Text("Datos del comprador").Bold();
                comprador.Item().Text($"RNC/Cédula: {ecf.RncComprador}");
                comprador.Item().Text($"Razón social: {ecf.RazonSocialComprador ?? "-"}");
            });

            col.Item().Table(tabla =>
            {
                tabla.ColumnsDefinition(columnas =>
                {
                    columnas.ConstantColumn(30);
                    columnas.RelativeColumn();
                    columnas.ConstantColumn(60);
                    columnas.ConstantColumn(80);
                    columnas.ConstantColumn(80);
                });

                tabla.Header(header =>
                {
                    header.Cell().Element(Celda).Text("#").Bold();
                    header.Cell().Element(Celda).Text("Descripción").Bold();
                    header.Cell().Element(Celda).AlignRight().Text("Cant.").Bold();
                    header.Cell().Element(Celda).AlignRight().Text("Precio").Bold();
                    header.Cell().Element(Celda).AlignRight().Text("Importe").Bold();
                });

                if (items.Count == 0)
                {
                    tabla.Cell().ColumnSpan(5).Element(Celda).AlignCenter()
                        .Text("El XML del documento no contiene el detalle de líneas.").Italic();
                }

                var linea = 0;
                foreach (var item in items)
                {
                    linea++;
                    tabla.Cell().Element(Celda).Text(item.Numero ?? linea.ToString());
                    tabla.Cell().Element(Celda).Text(item.Descripcion);
                    tabla.Cell().Element(Celda).AlignRight().Text(Numero(item.Cantidad));
                    tabla.Cell().Element(Celda).AlignRight().Text(Numero(item.PrecioUnitario));
                    tabla.Cell().Element(Celda).AlignRight().Text(Numero(item.Monto));
                }
            });

            col.Item().AlignRight().Width(240).Column(totales =>
            {
                Total(totales, "Subtotal", ecf.MontoTotal - ecf.TotalItbis);
                Total(totales, "ITBIS", ecf.TotalItbis);
                Total(totales, "Total", ecf.MontoTotal, negrita: true);
            });
        });
    }

    private static void Total(ColumnDescriptor columna, string etiqueta, decimal valor, bool negrita = false)
    {
        columna.Item().Row(row =>
        {
            row.RelativeItem().Text(text => Resaltar(text.Span(etiqueta), negrita));
            row.ConstantItem(100).AlignRight().Text(text => Resaltar(text.Span($"RD$ {Numero(valor)}"), negrita));
        });
    }

    private static void Resaltar(TextSpanDescriptor span, bool negrita)
    {
        if (negrita) span.Bold();
    }

    private static IContainer Celda(IContainer container) =>
        container.BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten1).PaddingVertical(4).PaddingHorizontal(2);

    private static string Numero(decimal valor) => valor.ToString("N2", Cultura);

    private static string Descripcion(string tipo) => tipo switch
    {
        "31" => "FACTURA DE CRÉDITO FISCAL ELECTRÓNICA",
        "32" => "FACTURA DE CONSUMO ELECTRÓNICA",
        "33" => "NOTA DE DÉBITO ELECTRÓNICA",
        "34" => "NOTA DE CRÉDITO ELECTRÓNICA",
        "41" => "COMPRA ELECTRÓNICA",
        "43" => "GASTO MENOR ELECTRÓNICO",
        "44" => "REGÍMENES ESPECIALES",
        "45" => "GUBERNAMENTAL ELECTRÓNICO",
        "46" => "COMPROBANTE DE EXPORTACIÓN ELECTRÓNICO",
        "47" => "COMPROBANTE PARA PAGOS AL EXTERIOR",
        _ => $"COMPROBANTE FISCAL ELECTRÓNICO {tipo}"
    };

    private static DatosEmisor LeerEmisor(string? xml)
    {
        var raiz = Parsear(xml);
        return new DatosEmisor(
            Valor(raiz, "RazonSocialEmisor"),
            Valor(raiz, "DireccionEmisor"),
            Valor(raiz, "TelefonoEmisor"));
    }

    private static IReadOnlyList<LineaItem> LeerItems(string? xml)
    {
        var raiz = Parsear(xml);
        if (raiz is null) return Array.Empty<LineaItem>();

        return raiz.Descendants()
            .Where(e => e.Name.LocalName.Equals("Item", StringComparison.OrdinalIgnoreCase))
            .Select(e => new LineaItem(
                Valor(e, "NumeroLinea"),
                Valor(e, "NombreItem") ?? Valor(e, "DescripcionItem") ?? "-",
                Decimal(e, "CantidadItem"),
                Decimal(e, "PrecioUnitarioItem"),
                Decimal(e, "MontoItem")))
            .ToList();
    }

    private static XElement? Parsear(string? xml)
    {
        if (string.IsNullOrWhiteSpace(xml)) return null;
        try
        {
            return XDocument.Parse(xml).Root;
        }
        catch (Exception)
        {
            return null;
        }
    }

    private static string? Valor(XElement? contenedor, string nombre) =>
        contenedor?.Descendants()
            .FirstOrDefault(e => e.Name.LocalName.Equals(nombre, StringComparison.OrdinalIgnoreCase))?
            .Value.Trim();

    private static decimal Decimal(XElement contenedor, string nombre) =>
        decimal.TryParse(Valor(contenedor, nombre), NumberStyles.Any, CultureInfo.InvariantCulture, out var valor)
            ? valor
            : 0m;

    private record DatosEmisor(string? RazonSocial, string? Direccion, string? Telefono);

    private record LineaItem(string? Numero, string Descripcion, decimal Cantidad, decimal PrecioUnitario, decimal Monto);
}

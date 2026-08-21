'use strict';

const fs = require('fs').promises;
const path = require('path');
const util = require('util');

/**
 * Conversión a JavaScript del procedimiento de facturación electrónica
 * contra la DGII (República Dominicana).
 *
 * Esta clase mantiene, en lo posible, la misma secuencia y nombres del
 * código Pascal original. Los métodos auxiliares que operan XML, firma,
 * semilla, token y envío HTTP están dejados como stubs; deben reemplazarse
 * por las implementaciones reales cuando se tengan los algoritmos
 * equivalentes.
 */
/**
 * Conversión a JavaScript de TFirmaDigital / FirmarXml.
 */
class FirmaDigital {
  constructor(_owner) {
    // En Delphi se pasaba el formulario padre (self); no aplica en Node.js.
  }

  /**
   * Equivalente a firmaxml.ReciboDatosFirma(archivoxml, rutaCertificado, claveCertificado).
   *
   * @param {string} archivoXml - Ruta del XML a firmar.
   * @param {string} rutaCertificado - Ruta del certificado digital (.p12/.pfx).
   * @param {string} claveCertificado - Contraseña del certificado.
   */
  async reciboDatosFirma(_archivoXml, _rutaCertificado, _claveCertificado) {
    // TODO: implementar firma XML-DSig con el certificado digital.
    throw new Error('Pendiente: FirmaDigital.reciboDatosFirma');
  }
}

class FacturacionElectronicaService {
  constructor({ config, db, logger = console }) {
    this.config = config;
    this.db = db;
    this.logger = logger;
    this.reset();
  }

  reset() {
    this.ECF_Completado = false;
    this.envioDirecto = false;
    this.noElije = 0;
    this.FRCE = '';

    this.token = '';
    this.trackId = '';
    this.codigoSeguridad = '';
    this.fechaFirma = '';

    this.fechaEmision = '';
    this.hora = '';
    this.min = '';
    this.seg = '';

    this.ambienteTrabajo = '';
    this.nombreCertificado = '';
    this.rutaCertificado = '';
    this.claveCertificado = '';
    this.rutaSistema = '';
    this.credencialesHostingRecepcionXml = '';
    this.urlEnvioXml = '';

    this.urlAutenticacion = '';
    this.urlCrearSemilla = '';
    this.urlValidarSemilla = '';
    this.urlRecepcion = '';
    this.urlConsultaEmision = '';
    this.urlConsultaTimbre = '';
    this.urlConsultaFc = '';
    this.urlRecepcionFc = '';
    this.urlAprobacionComercial = '';

    this.rncEmisor = '';
    this.datosFacturacion = [];
    this.nombreArchivoMenor250k = '';

    this.codigoRespuesta = 0;
    this.respuestaEnvioMensaje = '';

    this.encfEstado = '';
    this.encfSecuenciaUtilizada = '';
    this.encfFechaRecepcion = '';
    this.encfMensajes = '';
    this.encfCodigo = '';
  }

  /**
   * Equivalente a TFdlgFormaPagoTactil.Facturacion_Electronica_Produccion.
   *
   * @param {object} factura - Datos de la factura a procesar.
   * @returns {Promise<object>} Resultado del proceso de facturación.
   */
  async facturacionElectronicaProduccion(factura) {
    this.ECF_Completado = false;

    const emitir = this.config.emitirFacturaElectronica;
    if (emitir !== 'S' && emitir !== true) {
      return { completado: false, razon: 'Facturación electrónica deshabilitada' };
    }

    if (factura.tipoCom === 3) {
      return { completado: false, razon: 'TipoCom = 3 no requiere facturación electrónica' };
    }

    const hayInternet = await this.hayInternet();
    if (!hayInternet) {
      this.logger.error('!!ERROR!! NO POSEE UNA CONEXION ACTIVA AL INTERNET');
      this.ECF_Completado = false;
      return { completado: false, razon: 'Sin conexión a Internet' };
    }

    this.envioDirecto = this.config.envioDirectoADgii === 'S' || this.config.envioDirectoADgii === true;

    const ahora = new Date();
    const dia = String(ahora.getDate()).padStart(2, '0');
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const anio = String(ahora.getFullYear());
    this.fechaEmision = `${dia}-${mes}-${anio}`;
    this.hora = String(ahora.getHours()).padStart(2, '0');
    this.min = String(ahora.getMinutes()).padStart(2, '0');
    this.seg = String(ahora.getSeconds()).padStart(2, '0');

    this.ambienteTrabajo = String(this.config.ambienteTrabajo || '').trim();
    this.nombreCertificado = String(this.config.nombreCertificado || '').trim();
    this.rutaCertificado = String(this.config.rutaCertificado || '').trim();
    this.claveCertificado = String(this.config.claveCertificado || '').trim();
    this.rutaSistema = String(this.config.rutaSistema || '').trim();
    this.credencialesHostingRecepcionXml = String(this.config.credencialesHostingRecepcionXml || '').trim();
    this.urlEnvioXml = String(this.config.urlEnvioXml || '').trim();

    if (this.ambienteTrabajo === '') {
      throw new Error('!!Error!! El Ambiente De Trabajo Para la Factura Electronica no Esta Configurado..');
    }
    if (this.rutaSistema === '') {
      throw new Error('!!Error!! La Ruta Para el Alojamiento de la Facturacion Electronica no Esta Configurada..');
    }
    if (this.claveCertificado === '') {
      throw new Error('!!Error!! Debe Proveer una Clave de Certificado Valida..');
    }
    if (this.nombreCertificado === '') {
      throw new Error('!!Error!! El Certificado no se encuentra Registrado En la Base de Datos..');
    }

    this.urlAutenticacion = `https://ecf.dgii.gov.do/${this.ambienteTrabajo}/Autenticacion`;
    this.urlCrearSemilla = `https://ecf.dgii.gov.do/${this.ambienteTrabajo}/Autenticacion/api/Autenticacion/Semilla`;
    this.urlValidarSemilla = `https://ecf.dgii.gov.do/${this.ambienteTrabajo}/Autenticacion/api/Autenticacion/ValidarSemilla`;
    this.urlRecepcion = `https://ecf.dgii.gov.do/${this.ambienteTrabajo}/Recepcion/api/FacturasElectronicas`;
    this.urlConsultaEmision = `https://ecf.dgii.gov.do/${this.ambienteTrabajo}/consultaresultado/api/Consultas/Estado`;
    this.urlConsultaTimbre = `https://ecf.dgii.gov.do/${this.ambienteTrabajo}/ConsultaTimbre?`;
    this.urlConsultaFc = `https://fc.dgii.gov.do/${this.ambienteTrabajo}/ConsultaTimbreFC?`;
    this.urlRecepcionFc = `https://fc.dgii.gov.do/${this.ambienteTrabajo}/recepcionfc/api/recepcion/ecf`;
    this.urlAprobacionComercial = `https://ecf.dgii.gov.do/${this.ambienteTrabajo}/AprobacionComercial/api/AprobacionComercial`;

    this.rncEmisor = String(this.config.rnc || '').trim();

    if (this.ambienteTrabajo === 'PruebaComunicacion') {
      this.urlRecepcion = 'https://angypos.online/fe/recepcion/api/ecf';
    }

    this.datosFacturacion = [];
    this.datosFacturacion.push(String(factura.numeroFactura));
    this.datosFacturacion.push(factura.ncf);
    this.datosFacturacion.push(factura.ncf); // NCF

    this.logger.info('...Generando Factura XML');

    this.FRCE = '';

    if (factura.tipoCom === 32 && factura.neto > 250000) {
      if (!factura.clienteRnc || String(factura.clienteRnc).trim() === '') {
        throw new Error('!!Error!! Para las Ventas de Consumo Mayor a RD$250,000.00 es Requerido el Rnc o Cedula del Cliente..');
      }
    }

    let res = await this.obtenerSemillaFirmada();
    if (res !== 200) {
      this.logger.error('SERVICIO NO DISPONIBLE, ERROR EN COMUNICACION CON SERVIDOR DGII');
      return { completado: false, razon: 'Error obteniendo semilla DGII' };
    }

    let resultado = await this.obtenerTokenDigital(1);
    let respuesta = resultado[0];
    if (respuesta !== '200') {
      throw new Error('Error AL OBTENER EL TOKEN DIGITAL...');
    }

    this.noElije = 0;
    await this.generarXmlTipoE31Produccion(factura);
    if (this.noElije === 1) {
      return { completado: false, razon: 'Generación de XML cancelada' };
    }

    let nombreArchivo = path.join(this.rutaSistema, `${this.rncEmisor}${factura.encfNumero}.xml`);

    await this.firmarXml(nombreArchivo);

    this.logger.info('Firmando Factura XML');

    this.extraerCodigoSeguridad(nombreArchivo);

    this.FRCE = '';

    const total1 = factura.neto;

    if (factura.tipoCom === 32 && total1 < 250000) {
      res = await this.obtenerSemillaFirmada();
      if (res === 200) {
        resultado = await this.obtenerTokenDigital(1);
        respuesta = resultado[0];
      }

      nombreArchivo = path.join(this.rutaSistema, `${this.rncEmisor}${factura.encfNumero}.xml`);

      this.generaXmlResumenFacturaE32(factura);
      this.nombreArchivoMenor250k = nombreArchivo;
      await this.firmarXml(nombreArchivo);
    }

    this.logger.info('...Factura Generada con Exito');

    if (this.envioDirecto) {
      if (this.codigoRespuesta === 400) {
        this.encfMensajes = this.respuestaEnvioMensaje;
        await this.grabaEnDb(factura);
        throw new Error(`Mensaje tipo codigo 400 ${this.encfMensajes}`);
      }

      if (respuesta === '200') {
        this.logger.info('Firmando y Enviando la Factura XML a DGII');

        nombreArchivo = path.join(this.rutaSistema, `${this.rncEmisor}${factura.encfNumero}.xml`);

        resultado = await this.enviarFacturaXml(this.token, nombreArchivo);
        this.logger.info('Documento Enviado Correctamente....');

        await this.sleep(1500);

        if (resultado[0] === 'null') {
          this.ECF_Completado = false;
          throw new Error('Error en la Peticion HTTP al enviar la factura..Se Cancelo el proceso');
        }

        respuesta = resultado[0];
        if (respuesta === '200') {
          if (factura.tipoCom !== 32 || (factura.tipoCom === 32 && factura.montoTotal > 250000)) {
            this.logger.info('Consultando Track ID');

            resultado = await this.consultarTrackId(this.token, this.trackId, this.urlConsultaEmision);
            respuesta = resultado[0];

            if (respuesta === '200') {
              this.encfEstado = resultado[1];
              this.encfSecuenciaUtilizada = resultado[4];
              this.encfFechaRecepcion = resultado[5];
              this.encfMensajes = resultado[6];
              this.encfCodigo = resultado[7];

              this.logger.info(`Estado del Comprobante: ${this.encfEstado} Mensaje:${this.encfMensajes}`);
              await this.sleep(1500);

              this.logger.info('Generando la Consulta Timbre');
              this.extraerCodigoSeguridad(nombreArchivo);
              this.ECF_Completado = true;
            } else {
              this.ECF_Completado = false;
            }
          } else if (factura.tipoCom === 32 && factura.montoTotal < 250000) {
            respuesta = resultado[0];
            this.encfCodigo = resultado[2];
            this.encfEstado = resultado[3];
            this.encfMensajes = resultado[4];

            this.logger.info(`Estado del Comprobante: ${this.encfEstado} Mensaje:${this.encfMensajes}`);
            await this.sleep(1500);

            this.logger.info('Generando la Consulta Timbre');
            this.ECF_Completado = true;
          }
        } else {
          throw new Error('Error en la Peticion HTTP al enviar la factura..Se Cancelo el proceso');
        }
      }
    }

    let cadenaUrl;

    if (factura.tipoCom !== 32 || (factura.tipoCom === 32 && factura.montoTotal > 250000)) {
      this.extraerCodigoSeguridad(nombreArchivo);

      cadenaUrl = `${this.urlConsultaTimbre}` +
        `RncEmisor=${this.urlEncode(this.rncEmisor)}` +
        `&RncComprador=${this.urlEncode(factura.rncComprador)}` +
        `&ENCF=${this.urlEncode(factura.encfNumero)}` +
        `&FechaEmision=${this.urlEncode(this.fechaEmision)}` +
        `&MontoTotal=${this.urlEncode(factura.montoTotalStr)}` +
        `&FechaFirma=${this.urlEncode(this.fechaFirma)}` +
        `&CodigoSeguridad=${this.urlEncode(this.codigoSeguridad)}`;
    }

    if (factura.tipoCom === 32 && factura.montoTotal < 250000) {
      this.urlConsultaTimbre = `https://fc.dgii.gov.do/${this.ambienteTrabajo}/consultarfce/api/Consultas/Consulta?`;

      cadenaUrl = `${this.urlConsultaFc}` +
        `RncEmisor=${this.urlEncode(this.rncEmisor)}` +
        `&ENCF=${this.urlEncode(factura.encfNumero)}` +
        `&MontoTotal=${this.urlEncode(factura.montoTotalStr)}` +
        `&CodigoSeguridad=${this.urlEncode(this.codigoSeguridad)}`;
    }

    let re;
    const enviarAHosting = this.config.enviarXmlAHosting === 'S' || this.config.enviarXmlAHosting === true;
    if (enviarAHosting) {
      const archivoAEnviar = (factura.tipoCom === 32 && total1 < 250000)
        ? this.nombreArchivoMenor250k
        : nombreArchivo;

      re = await this.enviarXmlHosting(
        archivoAEnviar,
        this.urlEnvioXml,
        this.credencialesHostingRecepcionXml,
        this.encfEstado,
        this.encfMensajes,
        this.ambienteTrabajo,
      );
      this.logger.info(re);
    } else {
      this.logger.info('No SE ENVIO AL HOSTING LA FACTURA.');
    }

    await this.sleep(2500);

    const urlTimbreQr = cadenaUrl;

    this.logger.info('Guardando la Informacion en la Base de Datos');

    await this.guardarEstadoEnDb({
      numeroFactura: factura.numeroFactura,
      ecfNumero: factura.ncf,
      fechaEmision: this.fechaEmision,
      estado: this.encfEstado,
      trackId: this.trackId,
      rncComprador: factura.rncComprador,
      rncEmisor: this.rncEmisor,
      urlImagenQr: urlTimbreQr,
      codigoSeguridad: this.codigoSeguridad,
      secuenciaUtilizada: this.encfSecuenciaUtilizada,
      resultadoTxt: factura.nombreComprobante,
      mensaje: this.encfMensajes,
      horaFirmaDigital: this.fechaFirma,
      estatusFactura: this.envioDirecto ? 'E' : 'P',
      montoTotal: factura.neto,
    });

    this.logger.info('Proceso Finalizado con Exito, Proceciendo a Imprimir la Factura');

    this.ECF_Completado = true;

    return {
      completado: this.ECF_Completado,
      urlTimbreQr,
      estado: this.encfEstado,
      mensaje: this.encfMensajes,
      codigo: this.encfCodigo,
      secuenciaUtilizada: this.encfSecuenciaUtilizada,
      nombreArchivo,
      nombreArchivoMenor250k: this.nombreArchivoMenor250k,
    };
  }

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------

  urlEncode(value) {
    return encodeURIComponent(String(value ?? ''));
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---------------------------------------------------------------------------
  // Helpers HTTP / XML / firma. Algunos aún requieren la implementación real
  // de firma XML-DSig y generación de e-CF; los métodos de red usan fetch.
  // ---------------------------------------------------------------------------

  async hayInternet() {
    // TODO: implementar verificación real de conectividad (ping/DNS/HTTP).
    return true;
  }

  async obtenerSemillaFirmada() {
    // TODO: consumir this.urlCrearSemilla + this.urlValidarSemilla.
    throw new Error('Pendiente: obtenerSemillaFirmada');
  }

  async obtenerTokenDigital(_tipo) {
    // TODO: autenticación con el certificado digital.
    return ['200', 'token_pendiente'];
  }

  async generarXmlTipoE31Produccion(_factura) {
    // TODO: generar XML tipo E31 en this.rutaSistema.
    this.noElije = 0;
  }

  async firmarXml(rutaXml) {
    this.logger.info('Proceso de Firma del Documento');

    const firmaXml = new FirmaDigital(this);
    await firmaXml.reciboDatosFirma(rutaXml, this.rutaCertificado, this.claveCertificado);

    this.logger.info('Factura Firmada Correctamente');
    this.fechaFirma = new Date().toISOString();
  }

  extraerCodigoSeguridad(_rutaXml) {
    // TODO: extraer el código de seguridad del XML firmado.
    this.codigoSeguridad = '123456';
  }

  async generaXmlResumenFacturaE32(_factura) {
    // TODO: generar XML resumen E32 para facturas < RD$250,000.
  }

  /**
   * Envía el XML firmado a la DGII usando peticionHttp.
   * Equivalente aproximado de ENVIAR_FACTURA_XML.
   *
   * @param {string} token - Bearer token de autenticación.
   * @param {string} rutaXml - Ruta del XML a enviar.
   * @returns {Promise<string[]>} [codigoHttp, contenidoRespuesta, ''].
   */
  async enviarFacturaXml(token, rutaXml) {
    const datos = await this.peticionHttp({
      url: this.urlRecepcion,
      metodo: 'POST',
      token,
      archivo: rutaXml,
    });

    // Intenta extraer el TrackId si la respuesta es JSON.
    try {
      const json = JSON.parse(datos[1]);
      this.trackId = json.trackId || json.TrackId || this.trackId;
    } catch {
      // La respuesta no es JSON o no contiene trackId.
    }

    return datos;
  }

  /**
   * Petición HTTP genérica. Conversión de peticionHttp(envioPeticion).
   *
   * @param {object} params
   * @param {string} params.url
   * @param {string} params.metodo - 'GET' | 'POST' | etc.
   * @param {string} [params.token]
   * @param {string} [params.archivo] - Ruta del archivo a adjuntar como 'xml'.
   * @returns {Promise<string[]>} [codigoHttp, contenido, ''].
   */
  async peticionHttp({ url, metodo, token, archivo }) {
    const datosObtenidos = [];

    if (!url) {
      this.logger.error('!!Error!! Falta la URL de la peticion');
      return ['!!ERROR!!', 'Falta la Url de la peticion', ''];
    }
    if (!metodo) {
      this.logger.error('!!Error!! Falta el METODO de la peticion');
      return ['!!ERROR!!', 'Falta El Metodo del llamado a la url', ''];
    }

    const method = metodo.toUpperCase();
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let body;
    if (archivo && ['POST', 'PUT', 'PATCH'].includes(method)) {
      const buffer = await fs.readFile(archivo);
      const blob = new Blob([buffer], { type: 'application/xml' });
      const formData = new FormData();
      formData.append('xml', blob, path.basename(archivo));
      body = formData;
    }

    const response = await fetch(url, { method, headers, body });
    const content = await response.text();

    const statusCode = response.status;
    datosObtenidos.push(String(statusCode));
    datosObtenidos.push(content);
    datosObtenidos.push('');

    if (statusCode !== 200) {
      this.logger.error(`MENSAJE DE ERROR: ${content}`);
    }

    return datosObtenidos;
  }

  /**
   * Consulta estado de un TrackId. Conversión de MostrarResultadoTrackId.
   *
   * @param {string} token
   * @param {string} trackId
   * @param {string} _url - Ignorado en el original; se usa URL fija de testecf.
   * @returns {Promise<string[]>} [contenido]
   */
  async mostrarResultadoTrackId(token, trackId, _url) {
    const url = `https://ecf.dgii.gov.do/testecf/consultaresultado/api/Consultas/Estado?TrackId=${encodeURIComponent(trackId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const content = await response.text();
    return [content];
  }

  /**
   * Consulta estado de un TrackId y parsea la respuesta JSON.
   * Conversión de ConsultarTrackId.
   *
   * @param {string} token
   * @param {string} trackId
   * @param {string} url
   * @returns {Promise<string[]>} Array con status y campos parseados.
   */
  async consultarTrackId(token, trackId, url) {
    const fullUrl = `${url}?TrackId=${encodeURIComponent(trackId)}`;
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    const content = await response.text();
    const datosObtenidos = [String(response.status)];

    if (response.status === 200) {
      const json = JSON.parse(content);
      const extraer = (key) => (json[key] !== undefined && json[key] !== null ? String(json[key]) : '');

      datosObtenidos.push(extraer('estado'));
      datosObtenidos.push(extraer('rnc'));
      datosObtenidos.push(extraer('encf'));
      datosObtenidos.push(extraer('secuenciaUtilizada'));
      datosObtenidos.push(extraer('fechaRecepcion'));
      datosObtenidos.push(extraer('mensajes'));
      datosObtenidos.push(extraer('codigo'));
    }

    datosObtenidos.push(content);
    return datosObtenidos;
  }

  /**
   * Envía el XML a un portal/hosting propio vía multipart con Basic Auth.
   * Conversión de EnviarXMLHosting.
   *
   * @param {string} archivo - Ruta del XML.
   * @param {string} urlFormat - URL con placeholders %s para estado, comentario, ambiente.
   * @param {string} credenciales - Usuario:contraseña en claro.
   * @param {string} estado
   * @param {string} comentario
   * @param {string} ambiente
   * @returns {Promise<string>} Respuesta del servidor.
   */
  async enviarXmlHosting(archivo, urlFormat, credenciales, estado, comentario, ambiente) {
    if (!archivo) {
      return 'Error: no se proporcionó archivo';
    }

    const url = util.format(urlFormat, estado, comentario, ambiente);
    const auth = Buffer.from(credenciales).toString('base64');

    const buffer = await fs.readFile(archivo);
    const blob = new Blob([buffer], { type: 'application/xml' });
    const formData = new FormData();
    formData.append('xml', blob, path.basename(archivo));

    const response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Basic ${auth}` },
      body: formData,
    });

    const text = await response.text();
    return response.status === 200
      ? `Respuesta del Servidor: ${text}`
      : `Error: ${text}`;
  }

  async grabaEnDb(_factura) {
    // TODO: guardar en tabla auxiliar (codigo 400 / rechazo).
  }

  async guardarEstadoEnDb(data) {
    if (!this.db) {
      this.logger.warn('guardarEstadoEnDb: no se proporcionó conexión a base de datos');
      return;
    }

    const request = this.db.request();
    request.input('numero_factura', String(data.numeroFactura).slice(0, 50));
    request.input('ecf_numero', String(data.ecfNumero).slice(0, 50));
    request.input('fecha_emision', String(data.fechaEmision).slice(0, 10));
    request.input('estado', String(data.estado).slice(0, 120));
    request.input('trackid', String(data.trackId).slice(0, 40));
    request.input('rnc_comprador', String(data.rncComprador).slice(0, 13));
    request.input('rnc_emisor', String(data.rncEmisor).slice(0, 13));
    request.input('url_imagen_qr', String(data.urlImagenQr).slice(0, 350));
    request.input('codigo_seguridad', String(data.codigoSeguridad).slice(0, 6));
    request.input('secuencia_utilizada', String(data.secuenciaUtilizada).slice(0, 10));
    request.input('resultado_txt', String(data.resultadoTxt).slice(0, 200));
    request.input('mensaje', String(data.mensaje).slice(0, 400));
    request.input('hora_firma_digital', String(data.horaFirmaDigital).slice(0, 50));
    request.input('estatus_factura', String(data.estatusFactura).slice(0, 1));
    request.input('monto_total', Number(data.montoTotal));

    const query = `
      INSERT INTO ecf_estados (
        numero_factura, ecf_numero, fecha_Emision, estado, trackid,
        rnc_comprador, rnc_emisor, url_imagen_qr, codigo_seguridad,
        secuencia_utilizada, resultado_txt, mensaje, hora_firma_digital,
        estatus_factura, MONTO_TOTAL
      ) VALUES (
        @numero_factura, @ecf_numero, @fecha_emision, @estado, @trackid,
        @rnc_comprador, @rnc_emisor, @url_imagen_qr, @codigo_seguridad,
        @secuencia_utilizada, @resultado_txt, @mensaje, @hora_firma_digital,
        @estatus_factura, @monto_total
      )
    `;

    await request.query(query);
  }
}

module.exports = FacturacionElectronicaService;

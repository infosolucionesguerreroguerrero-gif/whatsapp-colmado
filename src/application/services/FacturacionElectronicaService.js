'use strict';

const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const { SignedXml } = require('xml-crypto');
const forge = require('node-forge');

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
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * Equivalente a firmaxml.ReciboDatosFirma(archivoxml, rutaCertificado, claveCertificado).
   *
   * @param {string} archivoXml - Ruta del XML a firmar.
   * @param {string} rutaCertificado - Ruta del certificado digital (.p12/.pfx).
   * @param {string} claveCertificado - Contraseña del certificado.
   * @returns {Promise<string>} 'Proceso Realizado' si todo sale bien.
   */
  async reciboDatosFirma(archivoXml, rutaCertificado, claveCertificado) {
    this.owner.logger.info(`Proceso de Firma del Documento: ${archivoXml}`);

    const xmlString = await fs.readFile(archivoXml, 'utf8');
    const signedXml = await this.firmarXml(xmlString, rutaCertificado, claveCertificado);
    await fs.writeFile(archivoXml, signedXml, 'utf8');

    this.owner.logger.info('Factura Firmada Correctamente');
    return 'Proceso Realizado';
  }

  /**
   * Firma un XML usando XML-DSig (RSA-SHA256, C14N, enveloped-signature).
   *
   * @param {string} xmlString - Contenido XML a firmar.
   * @param {string} rutaCertificado - Ruta del certificado P12/PFX.
   * @param {string} claveCertificado - Contraseña del certificado.
   * @returns {Promise<string>} XML firmado.
   */
  async firmarXml(xmlString, rutaCertificado, claveCertificado) {
    try {
      await fs.access(rutaCertificado);
      const certBuffer = await fs.readFile(rutaCertificado);
      const { privateKeyPem, certificatePem } = this.extraerCertificadoYClave(certBuffer, claveCertificado);

      const sig = new SignedXml({
        privateKey: privateKeyPem,
        publicCert: certificatePem,
        signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
        canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
        getKeyInfoContent: SignedXml.getKeyInfoContent,
      });

      sig.addReference({
        xpath: '/*',
        transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature'],
        digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
        uri: '',
        isEmptyUri: true,
      });

      sig.computeSignature(xmlString, {
        location: { reference: '/*', action: 'append' },
      });

      return sig.getSignedXml();
    } catch (error) {
      throw new Error(`Error al firmar el XML: ${error.message}`);
    }
  }

  /**
   * Extrae la clave privada (PKCS#8) y el certificado X.509 de un archivo P12/PFX.
   *
   * @param {Buffer} certBuffer - Contenido del archivo P12/PFX.
   * @param {string} claveCertificado - Contraseña del contenedor.
   * @returns {{privateKeyPem: string, certificatePem: string}}
   */
  extraerCertificadoYClave(certBuffer, claveCertificado) {
    const p12Der = certBuffer.toString('binary');
    const p12Asn1 = forge.asn1.fromDer(p12Der);

    let p12;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, claveCertificado);
    } catch {
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, true, claveCertificado);
    }

    const keyBags = [].concat(
      p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [],
      p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [],
    );
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];

    if (!keyBags.length || !certBags || !certBags.length) {
      throw new Error('No se pudo extraer la clave privada o el certificado del archivo P12/PFX');
    }

    const privateKey = keyBags[0].key;
    const certificate = certBags[0].cert;

    const rsaPrivateKey = forge.pki.privateKeyToAsn1(privateKey);
    const privateKeyInfo = forge.pki.wrapRsaPrivateKey(rsaPrivateKey);
    const privateKeyPem = forge.pki.privateKeyInfoToPem(privateKeyInfo);
    const certificatePem = forge.pki.certificateToPem(certificate);

    return { privateKeyPem, certificatePem };
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

    if (factura.tipoCom === 32 && factura.montoTotal > 250000) {
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

    if (factura.tipoCom === 32 && factura.montoTotal < 250000) {
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

        resultado = await this.enviarFacturaXml(this.token, nombreArchivo, factura);
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
            let respuestaRecepcion = {};
            try {
              respuestaRecepcion = JSON.parse(resultado[1] || '{}');
            } catch {
              respuestaRecepcion = {};
            }
            this.encfCodigo = String(respuestaRecepcion.codigo || respuestaRecepcion.Codigo || '');
            this.encfEstado = String(respuestaRecepcion.estado || respuestaRecepcion.Estado || '');
            this.encfMensajes = String(respuestaRecepcion.mensajes || respuestaRecepcion.Mensajes || '');

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
      const archivoAEnviar = (factura.tipoCom === 32 && factura.montoTotal < 250000)
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
    const respuestaLista = await this.peticionHttp({
      url: this.urlCrearSemilla,
      metodo: 'GET',
    });

    const codigoResultado = respuestaLista[0];
    const contenido = respuestaLista[1] || '';

    if (codigoResultado === '200') {
      await fs.mkdir(this.rutaSistema, { recursive: true });
      const rutaxml = path.join(this.rutaSistema, 'semillafirmada.xml');
      await fs.writeFile(rutaxml, contenido, 'utf8');

      this.logger.info('...Firmando la Semilla Descargada');
      const firmaXml = new FirmaDigital(this);
      await firmaXml.reciboDatosFirma(rutaxml, this.rutaCertificado, this.claveCertificado);
      this.logger.info('Semilla Firmada Correctamente');
      return 200;
    }

    this.logger.error('!!Error!! No se Pudo Realizar la Peticion, Servidor HTTP No responde..');
    return Number(codigoResultado) || 0;
  }

  async obtenerTokenDigital(_numero) {
    const rutaxml = path.join(this.rutaSistema, 'semillafirmada.xml');

    const respuestaLista = await this.peticionHttp({
      url: this.urlValidarSemilla,
      metodo: 'POST',
      token: '',
      archivo: rutaxml,
    });

    const codigoResultado = respuestaLista[0];
    const datosObtenidos = [codigoResultado];

    if (codigoResultado === '200') {
      let originalObjet = {};
      try {
        originalObjet = JSON.parse(respuestaLista[1] || '{}');
      } catch {
        originalObjet = {};
      }

      this.token = String(originalObjet.token || originalObjet.Token || '');
      datosObtenidos.push(this.token);
      datosObtenidos.push(String(originalObjet.expedido || originalObjet.Expedido || ''));
      datosObtenidos.push(String(originalObjet.expira || originalObjet.Expira || ''));
    } else {
      datosObtenidos.push('!!Error!! No se Pudo Realizar la Peticion, Servidor HTTP No responde..');
    }

    return datosObtenidos;
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
   * Equivalente a ENVIAR_FACTURA_XML.
   *
   * @param {string} token - Bearer token de autenticación.
   * @param {string} rutaXml - Ruta del XML a enviar.
   * @param {object} factura - Datos de la factura (tipoCom, montoTotal).
   * @returns {Promise<string[]>} Lista con código, contenido y campos parseados.
   */
  async enviarFacturaXml(token, rutaXml, factura) {
    if (this.FRCE === 'S') {
      return [];
    }

    let url = this.urlRecepcion;
    if (factura.tipoCom === 32 && factura.montoTotal < 250000) {
      url = this.urlRecepcionFc;
    }

    const respuestaLista = await this.peticionHttp({
      url,
      metodo: 'POST',
      token,
      archivo: rutaXml,
    });

    const codigoResultado = respuestaLista[0];
    const datosObtenidos = [codigoResultado];
    datosObtenidos.push(respuestaLista[1] || '');

    if (codigoResultado === '200') {
      let originalObjet = {};
      try {
        originalObjet = JSON.parse(respuestaLista[1] || '{}');
      } catch {
        originalObjet = {};
      }

      if (factura.tipoCom !== 32 || (factura.tipoCom === 32 && factura.montoTotal > 250000)) {
        this.trackId = String(originalObjet.trackId || originalObjet.TrackId || '');
        datosObtenidos.push(this.trackId);
        datosObtenidos.push(String(originalObjet.error || originalObjet.Error || ''));
        datosObtenidos.push(String(originalObjet.mensaje || originalObjet.Mensaje || ''));
      } else {
        this.encfCodigo = String(originalObjet.codigo || originalObjet.Codigo || '');
        this.encfEstado = String(originalObjet.estado || originalObjet.Estado || '');
        this.encfMensajes = String(originalObjet.mensajes || originalObjet.Mensajes || '');
        datosObtenidos.push(this.encfCodigo);
        datosObtenidos.push(this.encfEstado);
        datosObtenidos.push(this.encfMensajes);
      }
    }

    return datosObtenidos;
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

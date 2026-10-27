'use strict';

/**
 * Convierte un número a su representación en letras (español).
 * Pensado para recibos/facturas dominicanos: "MIL QUINIENTOS PESOS CON 50/100".
 */

const UNIDADES = [
  '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE',
];
const VEINTIS = [
  '', 'VEINTIUNO', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO',
  'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
];

function _decenas(n) {
  if (n <= 20) return UNIDADES[n];
  if (n < 30) return VEINTIS[n - 20];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u ? `${DECENAS[d]} Y ${UNIDADES[u]}` : DECENAS[d];
}

function _centenas(n) {
  if (n < 100) return _decenas(n);
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const r = n % 100;
  return r ? `${CENTENAS[c]} ${_decenas(r)}` : CENTENAS[c];
}

function _miles(n) {
  if (n < 1000) return _centenas(n);
  const m = Math.floor(n / 1000);
  const r = n % 1000;
  const prefijo = m === 1 ? 'MIL' : `${_centenas(m)} MIL`;
  return r ? `${prefijo} ${_centenas(r)}` : prefijo;
}

function _millones(n) {
  if (n < 1000000) return _miles(n);
  const m = Math.floor(n / 1000000);
  const r = n % 1000000;
  const prefijo = m === 1 ? 'UN MILLON' : `${_miles(m)} MILLONES`;
  return r ? `${prefijo} ${_miles(r)}` : prefijo;
}

/**
 * Número entero a letras (sin unidad monetaria).
 * Ej.: 1500 -> 'MIL QUINIENTOS'; 0 -> 'CERO'.
 */
function enteroALetras(n) {
  const entero = Math.floor(Math.abs(Number(n) || 0));
  if (entero === 0) return 'CERO';
  return _millones(entero);
}

/**
 * Monto a letras con centavos en fracción.
 * Ej.: 1500.5 -> 'MIL QUINIENTOS PESOS CON 50/100'
 *
 * @param {number} monto
 * @param {object} [opts]
 * @param {string} [opts.unidad]    Palabra de la moneda (default 'PESOS').
 * @param {boolean} [opts.un]      true usa 'UN' en lugar de 'UNO' al final.
 */
function numeroALetras(monto, { unidad = 'PESOS', un = true } = {}) {
  const valor = Math.abs(Number(monto) || 0);
  const entero = Math.floor(valor);
  const centavos = Math.round((valor - entero) * 100);

  let letras = enteroALetras(entero);
  if (un) {
    if (letras.endsWith('UNO')) letras = `${letras.slice(0, -3)}UN`;
    else if (letras === 'UNO') letras = 'UN';
  }
  return `${letras} ${unidad} CON ${String(centavos).padStart(2, '0')}/100`;
}

module.exports = { enteroALetras, numeroALetras };

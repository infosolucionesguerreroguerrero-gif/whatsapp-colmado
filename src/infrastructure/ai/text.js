'use strict';

/** Utilidades de texto compartidas por el motor NLU. */

function normalizar(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const NUMEROS = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, media: 0.5, medio: 0.5,
};

/** Convierte una palabra/número a cantidad numérica, o null si no aplica. */
function palabraANumero(token) {
  if (token == null) return null;
  const t = normalizar(token);
  if (/^\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  if (t in NUMEROS) return NUMEROS[t];
  return null;
}

module.exports = { normalizar, palabraANumero, NUMEROS };

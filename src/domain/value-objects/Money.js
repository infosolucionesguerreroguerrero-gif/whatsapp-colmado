'use strict';

/**
 * Utilidades de dinero. Trabaja con números con 2 decimales y formatea
 * según la moneda configurada. Evita errores de coma flotante redondeando.
 */
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function format(amount, currency = 'RD$') {
  const value = round2(amount).toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency}${value}`;
}

module.exports = { round2, format };

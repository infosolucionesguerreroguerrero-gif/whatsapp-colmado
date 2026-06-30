'use strict';

/**
 * Codificador ESC/POS mínimo (sin dependencias nativas). Construye el buffer
 * de comandos que entiende una impresora térmica estándar.
 */
const ESC = 0x1b;
const GS = 0x1d;

class EscPosEncoder {
  constructor() {
    this._buffers = [];
    this.init();
  }

  _push(bytes) {
    this._buffers.push(Buffer.from(bytes));
    return this;
  }

  init() {
    return this._push([ESC, 0x40]); // ESC @ -> reset
  }

  text(str = '') {
    // CP437/latin: usamos latin1 para acentos básicos
    this._buffers.push(Buffer.from(String(str), 'latin1'));
    return this;
  }

  line(str = '') {
    return this.text(str).newline();
  }

  newline(n = 1) {
    return this._push(Array(n).fill(0x0a));
  }

  align(mode = 'left') {
    const map = { left: 0, center: 1, right: 2 };
    return this._push([ESC, 0x61, map[mode] ?? 0]);
  }

  bold(on = true) {
    return this._push([ESC, 0x45, on ? 1 : 0]);
  }

  doubleHeight(on = true) {
    // GS ! n -> tamaño (0x00 normal, 0x01 doble alto, 0x11 doble alto+ancho)
    return this._push([GS, 0x21, on ? 0x11 : 0x00]);
  }

  cut() {
    return this._push([GS, 0x56, 0x42, 0x00]); // GS V B 0 -> corte parcial
  }

  beep() {
    return this._push([ESC, 0x42, 0x02, 0x02]);
  }

  encode() {
    return Buffer.concat(this._buffers);
  }
}

module.exports = EscPosEncoder;

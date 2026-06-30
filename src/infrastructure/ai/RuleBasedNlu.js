'use strict';

const { normalizar, palabraANumero, NUMEROS } = require('./text');

/**
 * Motor NLU basado en reglas (sin costo, offline). Detecta la intención del
 * mensaje y extrae ítems de pedido (cantidad + texto del producto).
 *
 * Devuelve siempre: { intent, items, raw, opcion }
 *   - items: [{ texto, cantidad }]
 *   - opcion: número de menú si el usuario respondió "1".."5"
 */
class RuleBasedNlu {
  // eslint-disable-next-line no-unused-vars
  async interpret(mensaje, _contexto = {}) {
    const raw = String(mensaje || '');
    const t = normalizar(raw);
    const opcion = /^\d+$/.test(t) ? Number(t) : null;

    const intent = this._detectarIntent(t, opcion);
    const items = ['hacer_pedido', 'agregar', 'quitar', 'desconocido'].includes(intent)
      ? this._extraerItems(t)
      : [];

    return { intent, items, raw, opcion };
  }

  _detectarIntent(t, opcion) {
    if (this._match(t, ['hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches', 'saludos'])) return 'saludo';
    if (this._match(t, ['menu', 'opciones', 'inicio', 'volver'])) return 'menu';
    if (this._match(t, ['operador', 'humano', 'persona', 'ayuda', 'agente'])) return 'operador';

    if (opcion === 5 || this._match(t, ['hablar con un operador'])) return 'operador';

    // Repetir pedido
    if (this._match(t, ['lo mismo', 'repetir', 'repite', 'mismo de ayer', 'mismo de la semana', 'otra vez lo mismo']) || opcion === 4) return 'repetir_pedido';

    // Ofertas
    if (this._match(t, ['oferta', 'ofertas', 'promocion', 'promociones', 'descuento']) || opcion === 2) return 'ver_ofertas';

    // Consultar pedido / estado
    if (this._match(t, ['mi pedido', 'estado de mi pedido', 'donde esta mi pedido', 'consultar pedido', 'seguimiento']) || opcion === 3) return 'consultar_pedido';

    // Catálogo
    if (this._match(t, ['muestrame', 'muestra', 'que tienes', 'que refrescos', 'catalogo', 'productos', 'que hay'])) return 'catalogo';

    // Confirmar / cancelar / carrito
    if (this._match(t, ['confirmar', 'confirmo', 'finalizar', 'cerrar pedido'])) return 'confirmar';
    if (this._match(t, ['cancelar', 'cancela', 'cancelo'])) return 'cancelar';
    if (this._match(t, ['empieza otra vez', 'empezar de nuevo', 'reiniciar', 'vaciar carrito', 'elimina todo', 'borra todo', 'quita todo'])) return 'vaciar';
    if (this._match(t, ['ver carrito', 'mi carrito', 'carrito'])) return 'ver_carrito';

    // Quitar / modificar
    if (this._match(t, ['quita', 'quitar', 'elimina', 'eliminar', 'remueve', 'saca'])) return 'quitar';

    // Agregar / hacer pedido
    if (this._match(t, ['agrega', 'agregar', 'ponme', 'pon', 'añade', 'anade', 'sumale', 'echa'])) return 'agregar';
    if (this._match(t, ['quiero comprar', 'hacer pedido', 'quiero hacer un pedido', 'pedido']) || opcion === 1) return 'hacer_pedido';
    if (this._match(t, ['quiero', 'enviame', 'envíame', 'mandame', 'necesito', 'dame', 'comprar'])) return 'hacer_pedido';

    if (this._match(t, ['si', 'sí', 'ok', 'dale', 'correcto', 'claro', 'afirmativo'])) return 'si';
    if (this._match(t, ['no', 'negativo', 'todavia no'])) return 'no';

    return 'desconocido';
  }

  _match(t, palabras) {
    return palabras.some((p) => {
      const pn = normalizar(p);
      return t === pn || t.includes(pn);
    });
  }

  /**
   * Extrae ítems del texto. Divide por conectores ("y", ",", "más") y para cada
   * fragmento busca un número (dígito o palabra) seguido del nombre del producto.
   */
  _extraerItems(t) {
    const limpio = t
      .replace(/\b(quiero|comprar|enviame|mandame|necesito|dame|agrega|agregar|ponme|pon|anade|echa|de|por\s*favor|porfa)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const fragmentos = limpio.split(/\s*(?:,|\sy\s|\smas\s|\+)\s*/).filter(Boolean);
    const items = [];

    for (const frag of fragmentos) {
      const item = this._parseFragmento(frag);
      if (item && item.texto) items.push(item);
    }
    return items;
  }

  _parseFragmento(frag) {
    const tokens = frag.split(' ').filter(Boolean);
    if (!tokens.length) return null;

    let cantidad = 1;
    let start = 0;
    const primero = palabraANumero(tokens[0]);
    if (primero != null) {
      cantidad = primero;
      start = 1;
    }

    // Quitar palabras de presentación/relleno que no aportan al nombre buscable
    const stop = new Set(['de', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', ...Object.keys(NUMEROS)]);
    const palabras = tokens.slice(start).filter((w) => !stop.has(w));
    const texto = palabras.join(' ').trim();
    if (!texto) return null;
    return { texto, cantidad };
  }
}

module.exports = RuleBasedNlu;

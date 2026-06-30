'use strict';

const logger = require('../logger/logger');
const RuleBasedNlu = require('./RuleBasedNlu');

/**
 * Adaptador NLU basado en LLM (OpenAI). Usa "function/JSON output" para extraer
 * intención e ítems. Si la librería o la API key no están disponibles, hace
 * fallback automático al motor de reglas (degradación elegante).
 */
class OpenAiNluAdapter {
  constructor({ apiKey, model }) {
    this.model = model;
    this.fallback = new RuleBasedNlu();
    this.client = null;
    try {
      // require diferido: openai es optionalDependency
      const OpenAI = require('openai');
      if (apiKey) this.client = new OpenAI({ apiKey });
    } catch (_e) {
      logger.warn('Librería "openai" no instalada; NLU usará reglas.');
    }
  }

  async interpret(mensaje, contexto = {}) {
    if (!this.client) return this.fallback.interpret(mensaje, contexto);

    const system =
      'Eres el NLU de un colmado dominicano. Devuelve SOLO JSON con la forma ' +
      '{"intent":"saludo|menu|hacer_pedido|agregar|quitar|ver_carrito|confirmar|cancelar|vaciar|ver_ofertas|consultar_pedido|repetir_pedido|catalogo|operador|si|no|desconocido",' +
      '"items":[{"texto":"nombre del producto","cantidad":number}],"opcion":number|null}. ' +
      'Interpreta cantidades, presentaciones y marcas en lenguaje natural.';

    try {
      const resp = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: String(mensaje || '') },
        ],
      });
      const content = resp.choices[0].message.content;
      const parsed = JSON.parse(content);
      return {
        intent: parsed.intent || 'desconocido',
        items: Array.isArray(parsed.items) ? parsed.items : [],
        opcion: parsed.opcion ?? null,
        raw: String(mensaje || ''),
      };
    } catch (err) {
      logger.warn({ err: err.message }, 'Fallo OpenAI NLU; usando reglas.');
      return this.fallback.interpret(mensaje, contexto);
    }
  }

  /** Transcribe audio (voz a texto) con Whisper si está disponible. */
  async transcribir(buffer, filename = 'audio.ogg') {
    if (!this.client) throw new Error('OpenAI no configurado para transcripción');
    const { toFile } = require('openai');
    const file = await toFile(buffer, filename);
    const resp = await this.client.audio.transcriptions.create({ file, model: 'whisper-1' });
    return resp.text;
  }

  /** Analiza una imagen y describe los productos visibles. */
  async analizarImagen(base64Image) {
    if (!this.client) throw new Error('OpenAI no configurado para visión');
    const resp = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Lista los productos de colmado que ves, uno por línea, en español.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
    });
    return resp.choices[0].message.content;
  }
}

module.exports = OpenAiNluAdapter;

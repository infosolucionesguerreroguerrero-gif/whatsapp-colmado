'use strict';

const RuleBasedNlu = require('./RuleBasedNlu');
const OpenAiNluAdapter = require('./OpenAiNluAdapter');

/**
 * Fábrica del motor NLU. Selecciona la implementación según configuración
 * (rules | openai). Ambas exponen el mismo método `interpret(mensaje, ctx)`.
 */
function createNluEngine(aiConfig) {
  if (aiConfig.provider === 'openai') {
    return new OpenAiNluAdapter({ apiKey: aiConfig.openaiApiKey, model: aiConfig.openaiModel });
  }
  return new RuleBasedNlu();
}

module.exports = { createNluEngine, RuleBasedNlu, OpenAiNluAdapter };

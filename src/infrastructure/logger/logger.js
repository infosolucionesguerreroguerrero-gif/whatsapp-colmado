'use strict';

const pino = require('pino');
const env = require('../../config/env');

const logger = pino({
  level: env.logLevel,
  transport:
    env.nodeEnv === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});

module.exports = logger;

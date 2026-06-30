'use strict';

/** Envuelve handlers async para propagar errores al middleware de errores. */
module.exports = function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};

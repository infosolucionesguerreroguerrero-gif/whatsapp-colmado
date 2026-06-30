'use strict';

const { ValidationError } = require('../../../domain/errors/AppError');

/** Middleware factory: valida req[parte] contra un esquema Joi. */
function validate(schema, parte = 'body') {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[parte], { abortEarly: false, stripUnknown: true });
    if (error) {
      return next(new ValidationError('Datos inválidos', error.details.map((d) => d.message)));
    }
    req[parte] = value;
    return next();
  };
}

module.exports = { validate };

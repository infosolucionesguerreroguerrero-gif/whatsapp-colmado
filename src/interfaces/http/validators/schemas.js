'use strict';

const Joi = require('joi');

const login = Joi.object({
  usuario: Joi.string().required(),
  password: Joi.string().required(),
});

const crearCliente = Joi.object({
  telefono: Joi.string().min(7).max(30).required(),
  nombre: Joi.string().max(150).allow(null, ''),
  direccion: Joi.object({
    direccion: Joi.string().max(300).required(),
    referencia: Joi.string().max(200).allow(null, ''),
    sector: Joi.string().max(120).allow(null, ''),
    esPrincipal: Joi.boolean().default(true),
  }).optional(),
});

const crearPedido = Joi.object({
  telefono: Joi.string().min(7).max(30).required(),
  items: Joi.array()
    .items(
      Joi.object({
        productoId: Joi.number().integer().required(),
        descripcion: Joi.string().max(200).required(),
        cantidad: Joi.number().positive().required(),
        precioUnit: Joi.number().min(0).required(),
      })
    )
    .min(1)
    .required(),
  formaPago: Joi.string().max(30).allow(null, ''),
  notas: Joi.string().max(400).allow(null, ''),
});

const actualizarEstado = Joi.object({
  estadoId: Joi.number()
    .integer()
    .valid(1, 2, 3, 4, 5, 6)
    .required(),
});

const imprimir = Joi.object({
  pedidoId: Joi.number().integer().required(),
});

const mensajeBot = Joi.object({
  from: Joi.string().min(7).max(30).required(),
  text: Joi.string().required(),
  type: Joi.string().valid('text', 'audio', 'image').default('text'),
});

const lineaPago = Joi.object({
  metodo: Joi.string().max(30).required(),
  monto: Joi.number().positive().required(),
  montoMoneda: Joi.number().positive().allow(null),
  moneda: Joi.string().max(10).allow(null, ''),
  referencia: Joi.string().max(120).allow(null, ''),
});

const calcularPago = Joi.object({
  lineas: Joi.array().items(lineaPago).min(1).required(),
  cargoTC: Joi.number().min(0).allow(null),
});

const procesarPago = Joi.object({
  lineas: Joi.array().items(lineaPago).min(1).required(),
  rncComprador: Joi.string().max(20).allow(null, ''),
  generarFe: Joi.boolean().default(false),
  cargoTC: Joi.number().min(0).allow(null),
});

module.exports = { login, crearCliente, crearPedido, actualizarEstado, imprimir, mensajeBot, calcularPago, procesarPago };

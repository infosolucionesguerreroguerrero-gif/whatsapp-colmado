'use strict';

const Joi = require('joi');
const Pedido = require('../../../domain/entities/Pedido');

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
  formaPago: Joi.string().valid(...Pedido.FORMAS_PAGO).default('efectivo'),
  notas: Joi.string().max(400).allow(null, ''),
});

const actualizarEstado = Joi.object({
  estadoId: Joi.number()
    .integer()
    .valid(...Object.values(Pedido.ESTADOS))
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

const formaPagoRecibo = Joi.object({
  tipo: Joi.string().valid('efectivo', 'cheque', 'transferencia', 'tarjeta', 'otro').required(),
  monto: Joi.number().positive().required(),
  referencia: Joi.string().max(60).allow(null, ''),
  banco: Joi.string().max(60).allow(null, ''),
});

const aplicacionRecibo = Joi.object({
  nroFact: Joi.string().max(30).required(),
  montoAplicado: Joi.number().positive().required(),
});

const crearRecibo = Joi.object({
  codCliente: Joi.string().max(30).required(),
  nombreCliente: Joi.string().max(150).allow(null, ''),
  concepto: Joi.string().max(300).allow(null, ''),
  formasPago: Joi.array().items(formaPagoRecibo).min(1).required(),
  aplicaciones: Joi.array().items(aplicacionRecibo).default([]),
  fecha: Joi.date().optional(),
  usuario: Joi.string().max(60).allow(null, ''),
});

module.exports = { login, crearCliente, crearPedido, actualizarEstado, imprimir, mensajeBot, crearRecibo };

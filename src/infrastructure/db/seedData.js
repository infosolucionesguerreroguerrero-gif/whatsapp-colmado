'use strict';

/**
 * Datos de demostración usados por el driver "memory" (DB_DRIVER=memory).
 * Reflejan el mismo contenido que sql/06_seed.sql para que la app funcione
 * sin SQL Server (pruebas, demos, desarrollo).
 */

const categorias = [
  { categoriaId: 1, nombre: 'Bebidas' },
  { categoriaId: 2, nombre: 'Lácteos' },
  { categoriaId: 3, nombre: 'Carnes' },
  { categoriaId: 4, nombre: 'Embutidos' },
  { categoriaId: 5, nombre: 'Vegetales' },
  { categoriaId: 6, nombre: 'Enlatados' },
  { categoriaId: 7, nombre: 'Panadería' },
  { categoriaId: 8, nombre: 'Snacks' },
  { categoriaId: 9, nombre: 'Limpieza' },
  { categoriaId: 10, nombre: 'Higiene' },
  { categoriaId: 11, nombre: 'Congelados' },
  { categoriaId: 12, nombre: 'Víveres' },
];

const productos = [
  ['Coca Cola 2L', 'Coca Cola', '2L', 'litro', 'Bebidas', 120, 'coca,refresco,gaseosa,cola', 99],
  ['Coca Cola 1L', 'Coca Cola', '1L', 'litro', 'Bebidas', 75, 'coca,refresco,gaseosa', null],
  ['Agua 1 galón', 'Planeta', '1gal', 'galón', 'Bebidas', 55, 'agua,botellon', null],
  ['Jugo de naranja 1L', 'Rica', '1L', 'litro', 'Bebidas', 90, 'jugo,naranja', null],
  ['Leche entera 1L', 'Rica', '1L', 'litro', 'Lácteos', 85, 'leche', null],
  ['Queso geo 1 lb', 'Geo', '1 lb', 'libra', 'Lácteos', 180, 'queso', null],
  ['Huevos docena', 'Granja', 'docena', 'docena', 'Lácteos', 140, 'huevo,huevos', null],
  ['Arroz 10 lb', 'Cibao', '10 lb', 'libra', 'Víveres', 550, 'arroz', null],
  ['Arroz 5 lb', 'Cibao', '5 lb', 'libra', 'Víveres', 290, 'arroz', null],
  ['Aceite 1L', 'Crisol', '1L', 'litro', 'Víveres', 210, 'aceite', null],
  ['Habichuela roja 1lb', 'Cibao', '1 lb', 'libra', 'Víveres', 75, 'habichuela,frijol', null],
  ['Espagueti 1 lb', 'Milano', '1 lb', 'libra', 'Víveres', 55, 'espagueti,pasta,fideo', null],
  ['Pan de agua', 'Local', 'unidad', 'unidad', 'Panadería', 30, 'pan,panes', null],
  ['Salami 1 lb', 'Induveca', '1 lb', 'libra', 'Embutidos', 160, 'salami', null],
  ['Pollo entero', 'Cibao', 'unidad', 'unidad', 'Carnes', 320, 'pollo', null],
  ['Papas 1 lb', 'Local', '1 lb', 'libra', 'Vegetales', 45, 'papa,papas', null],
  ['Atún lata', 'Calvo', 'lata', 'unidad', 'Enlatados', 95, 'atun', null],
  ['Galletas', 'Hatuey', 'paquete', 'unidad', 'Snacks', 40, 'galleta,galletas', null],
  ['Jabón de cuaba', 'Candado', 'unidad', 'unidad', 'Limpieza', 35, 'jabon', null],
  ['Papel higiénico 4u', 'Nevax', '4u', 'unidad', 'Higiene', 120, 'papel,higienico', null],
].map(([nombre, marca, presentacion, unidad, categoria, precio, palabras, oferta], idx) => {
  const cat = categorias.find((c) => c.nombre === categoria);
  return {
    productoId: idx + 1,
    nombre,
    marca,
    presentacion,
    unidad,
    categoria,
    categoriaId: cat ? cat.categoriaId : null,
    precio,
    precioEfectivo: oferta == null ? precio : oferta,
    existencia: 50,
    disponible: true,
    imagenUrl: null,
    palabras,
  };
});

const formasPago = [
  { formaPagoId: 1, codigo: '1', nombre: 'Efectivo', orden: 1, requiereReferencia: false, esPagoMultiple: false, activo: true },
  { formaPagoId: 2, codigo: '2', nombre: 'Transferencia', orden: 2, requiereReferencia: true, esPagoMultiple: false, activo: true },
  { formaPagoId: 3, codigo: '3', nombre: 'Tarjeta', orden: 3, requiereReferencia: true, esPagoMultiple: false, activo: true },
  { formaPagoId: 4, codigo: '4', nombre: 'Contra entrega', orden: 4, requiereReferencia: false, esPagoMultiple: false, activo: true },
  { formaPagoId: 5, codigo: '5', nombre: 'Cheque', orden: 5, requiereReferencia: true, esPagoMultiple: false, activo: true },
  { formaPagoId: 6, codigo: '6', nombre: 'Pago múltiple', orden: 6, requiereReferencia: false, esPagoMultiple: true, activo: true },
  { formaPagoId: 7, codigo: 'C', nombre: 'Crédito', orden: 7, requiereReferencia: false, esPagoMultiple: false, activo: true },
  { formaPagoId: 8, codigo: '8', nombre: 'Nota de crédito', orden: 8, requiereReferencia: false, esPagoMultiple: false, activo: true },
];

const monedas = [
  { monedaId: 1, codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'US$', tasa: 0, prima: 0, orden: 1, activo: true },
  { monedaId: 2, codigo: 'EUR', nombre: 'Euro', simbolo: '€', tasa: 0, prima: 0, orden: 2, activo: true },
  { monedaId: 3, codigo: 'CAD', nombre: 'Dólar canadiense', simbolo: 'C$', tasa: 0, prima: 0, orden: 3, activo: true },
];

module.exports = { categorias, productos, formasPago, monedas };

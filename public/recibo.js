'use strict';

/* eslint-env browser */

const API = '/api';
let token = localStorage.getItem('cxc_token') || '';
let EMPRESA = { nombre: '', rnc: '', telefono: '', direccion: '', moneda: 'RD$' };
let FORMAS = ['efectivo', 'cheque', 'transferencia', 'tarjeta', 'otro'];
let reciboActual = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const fmt = (n) => `${EMPRESA.moneda} ${Number(n || 0).toFixed(2)}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fechaCorta = (f) => {
  const d = new Date(f);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-DO');
};

function show(el, visible) {
  document.getElementById(el).classList.toggle('hidden', !visible);
}

function error(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg || '';
  setTimeout(() => { el.textContent = ''; }, 6000);
}

function ok(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg || '';
  setTimeout(() => { el.textContent = ''; }, 6000);
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const body = await res.json().catch(() => ({ ok: false, error: { message: 'Respuesta inválida' } }));
  if (!res.ok || !body.ok) throw new Error(body.error?.message || `Error ${res.status}`);
  return body.data;
}

async function login() {
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usuario: $('#usuario').value, password: $('#password').value }),
    });
    token = data.token;
    localStorage.setItem('cxc_token', token);
    show('login', false);
    show('app', true);
    initApp();
  } catch (e) {
    error('loginError', e.message);
  }
}

async function cargarConfig() {
  try {
    const data = await api('/recibos/formas-pago');
    EMPRESA = data.empresa || EMPRESA;
    FORMAS = (data.formasPago || []).map((f) => f.tipo);
  } catch (e) {
    error('appError', e.message);
  }
}

// ===== Cliente y facturas pendientes =====

async function buscarCliente() {
  try {
    const cod = $('#codCliente').value.trim();
    if (!cod) return;
    const data = await api(`/cxc/cliente/${encodeURIComponent(cod)}`);
    const nombre = data.cliente?.nombre || cod;
    $('#clienteInfo').textContent = `${nombre} — balance total: ${fmt(data.balanceTotal)}`;
    renderFacturas(data.facturas || []);
  } catch (e) {
    error('appError', e.message);
  }
}

function renderFacturas(facturas) {
  const tb = $('#tbodyFacturas');
  tb.innerHTML = '';
  if (!facturas.length) {
    tb.innerHTML = '<tr><td colspan="5" class="mini">Sin facturas pendientes.</td></tr>';
    return;
  }
  for (const f of facturas) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="chk-fact" /></td>
      <td>${esc(f.nroFact)}</td>
      <td>${esc(f.fechaFact)}</td>
      <td class="num" data-bal="${f.balFact}">${fmt(f.balFact)}</td>
      <td class="num"><input type="number" class="monto-aplicar" min="0" step="0.01" value="${Number(f.balFact).toFixed(2)}" style="width:100px;" /></td>
    `;
    tr.dataset.nroFact = f.nroFact;
    tb.appendChild(tr);
  }
  tb.querySelectorAll('.chk-fact, .monto-aplicar').forEach((el) => {
    el.addEventListener('change', recalcularTotales);
    el.addEventListener('input', recalcularTotales);
  });
  recalcularTotales();
}

function aplicacionesSeleccionadas() {
  return $$('#tbodyFacturas tr')
    .filter((tr) => tr.querySelector('.chk-fact')?.checked)
    .map((tr) => ({
      nroFact: tr.dataset.nroFact,
      montoAplicado: Number(tr.querySelector('.monto-aplicar').value) || 0,
    }))
    .filter((a) => a.montoAplicado > 0);
}

// ===== Formas de pago =====

function agregarPago(p = {}) {
  const tb = $('#tbodyPagos');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <select class="pago-tipo">
        ${FORMAS.map((t) => `<option value="${t}" ${t === p.tipo ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}
      </select>
    </td>
    <td class="num"><input type="number" class="pago-monto" min="0" step="0.01" value="${p.monto ?? ''}" style="width:100px;" /></td>
    <td><input type="text" class="pago-ref" value="${esc(p.referencia || '')}" placeholder="No. cheque/transf." style="width:110px;" /></td>
    <td><input type="text" class="pago-banco" value="${esc(p.banco || '')}" style="width:100px;" /></td>
    <td><button class="link btn-quitar">✕</button></td>
  `;
  tr.querySelector('.btn-quitar').addEventListener('click', () => { tr.remove(); recalcularTotales(); });
  tr.querySelectorAll('input,select').forEach((el) => el.addEventListener('input', recalcularTotales));
  tb.appendChild(tr);
  recalcularTotales();
}

function formasPagoIngresadas() {
  return $$('#tbodyPagos tr')
    .map((tr) => ({
      tipo: tr.querySelector('.pago-tipo').value,
      monto: Number(tr.querySelector('.pago-monto').value) || 0,
      referencia: tr.querySelector('.pago-ref').value.trim() || null,
      banco: tr.querySelector('.pago-banco').value.trim() || null,
    }))
    .filter((p) => p.monto > 0);
}

function recalcularTotales() {
  const aplicado = aplicacionesSeleccionadas().reduce((a, x) => a + x.montoAplicado, 0);
  const recibido = formasPagoIngresadas().reduce((a, x) => a + x.monto, 0);
  $('#totalAplicado').textContent = fmt(aplicado);
  $('#totalRecibido').textContent = fmt(recibido);
}

// ===== Emitir / anular =====

async function emitir() {
  try {
    const codCliente = $('#codCliente').value.trim();
    const formasPago = formasPagoIngresadas();
    const aplicaciones = aplicacionesSeleccionadas();
    const concepto = $('#concepto').value.trim();
    const nombre = ($('#clienteInfo').textContent.split(' — ')[0] || '').trim();

    const recibo = await api('/recibos', {
      method: 'POST',
      body: JSON.stringify({
        codCliente,
        nombreCliente: nombre || undefined,
        concepto,
        formasPago,
        aplicaciones,
        usuario: $('#usuario').value,
      }),
    });
    reciboActual = recibo;
    renderRecibo(recibo);
    ok('appOk', `Recibo ${recibo.numero} emitido.`);
    cargarRecibos();
    buscarCliente().catch(() => {});
  } catch (e) {
    error('appError', e.message);
  }
}

async function anular() {
  if (!reciboActual) return;
  if (!confirm(`¿Anular el recibo ${reciboActual.numero}?`)) return;
  try {
    const recibo = await api(`/recibos/${encodeURIComponent(reciboActual.numero)}/anular`, { method: 'POST' });
    reciboActual = recibo;
    renderRecibo(recibo);
    ok('appOk', `Recibo ${recibo.numero} anulado.`);
    cargarRecibos();
  } catch (e) {
    error('appError', e.message);
  }
}

// ===== Render talonario + asiento =====

const ETIQUETA_PAGO = {
  efectivo: 'Efectivo',
  cheque: 'Cheque',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

function renderRecibo(r) {
  const anulado = r.estado === 'anulado';
  const pagos = (r.formasPago || []).map((p) => {
    let desc = ETIQUETA_PAGO[p.tipo] || p.tipo;
    if (p.referencia) desc += ` No. ${p.referencia}`;
    if (p.banco) desc += ` ${p.banco}`;
    return `<tr><td>${esc(desc)}</td><td class="num">${fmt(p.monto)}</td></tr>`;
  }).join('');

  const aplicaciones = (r.aplicaciones || []).map((a) => `
    <tr><td>${esc(a.nroFact)}</td><td class="num">${fmt(a.montoAplicado)}</td></tr>
  `).join('');

  $('#talonario').innerHTML = `
    <div class="talonario ${anulado ? 'anulado' : ''}">
      ${anulado ? '<div class="sello-anulado">ANULADO</div>' : ''}
      <div class="empresa">
        <div class="nombre">${esc(EMPRESA.nombre)}</div>
        <div class="datos">RNC: ${esc(EMPRESA.rnc)} &nbsp; Tel: ${esc(EMPRESA.telefono)}</div>
        <div class="datos">${esc(EMPRESA.direccion)}</div>
      </div>
      <div class="titulo-fila">
        <div class="titulo">RECIBO DE INGRESOS</div>
        <div class="numero">No. ${esc(r.numero)}</div>
      </div>
      <div class="linea"><span class="etq">Fecha:</span><span class="val" style="max-width:160px;">${esc(fechaCorta(r.fecha))}</span></div>
      <div class="linea"><span class="etq">Recibido de:</span><span class="val">${esc(r.nombreCliente)} (${esc(r.codCliente)})</span></div>
      <div class="linea"><span class="etq">La suma de:</span><span class="val">${esc(r.montoLetras)}</span></div>
      <div class="linea"><span class="etq">Por concepto de:</span><span class="val">${esc(r.concepto)}</span></div>
      ${aplicaciones ? `
      <table class="det">
        <thead><tr><th>Aplicado a factura</th><th class="num">Valor aplicado</th></tr></thead>
        <tbody>${aplicaciones}</tbody>
      </table>` : ''}
      <table class="det">
        <thead><tr><th>Forma de pago</th><th class="num">Monto</th></tr></thead>
        <tbody>${pagos}</tbody>
      </table>
      <div class="totales">
        <div class="gran">TOTAL RECIBIDO: ${fmt(r.totalRecibido)}</div>
        ${r.saldoFavor > 0 ? `<div>Saldo a favor del cliente: ${fmt(r.saldoFavor)}</div>` : ''}
      </div>
      <div class="firmas">
        <div class="firma">Elaborado por${r.usuario ? ` (${esc(r.usuario)})` : ''}</div>
        <div class="firma">Recibido por</div>
      </div>
    </div>
  `;

  renderAsiento(r.asiento);
  show('btnAnular', !anulado);
}

function renderAsiento(asiento) {
  const el = $('#asiento');
  if (!asiento || !asiento.lineas?.length) {
    el.innerHTML = '<p class="mini">Sin asiento generado.</p>';
    return;
  }
  el.innerHTML = `
    <table>
      <thead><tr><th>Cuenta</th><th>Descripción</th><th class="num">Débito</th><th class="num">Crédito</th></tr></thead>
      <tbody>
        ${asiento.lineas.map((l) => `
          <tr><td>${esc(l.cuenta)}</td><td>${esc(l.descripcion)}</td>
          <td class="num">${l.debito ? fmt(l.debito) : ''}</td>
          <td class="num">${l.credito ? fmt(l.credito) : ''}</td></tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr><td colspan="2">Totales</td>
        <td class="num">${fmt(asiento.totalDebito)}</td>
        <td class="num">${fmt(asiento.totalCredito)}</td></tr>
      </tfoot>
    </table>
    <p class="mini">${esc(asiento.descripcion || '')}</p>
  `;
}

// ===== Recibos recientes =====

async function cargarRecibos() {
  try {
    const recibos = await api('/recibos');
    const tb = $('#tbodyRecibos');
    tb.innerHTML = '';
    if (!recibos.length) {
      tb.innerHTML = '<tr><td colspan="5" class="mini">Sin recibos.</td></tr>';
      return;
    }
    for (const r of recibos.slice(0, 15)) {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML = `
        <td>${esc(r.numero)}</td>
        <td>${esc(fechaCorta(r.fecha))}</td>
        <td>${esc(r.nombreCliente)}</td>
        <td class="num">${fmt(r.totalRecibido)}</td>
        <td>${esc(r.estado)}</td>
      `;
      tr.addEventListener('click', async () => {
        try {
          reciboActual = await api(`/recibos/${encodeURIComponent(r.numero)}`);
          renderRecibo(reciboActual);
        } catch (e) { error('appError', e.message); }
      });
      tb.appendChild(tr);
    }
  } catch (e) {
    error('appError', e.message);
  }
}

async function initApp() {
  await cargarConfig();
  if (!$('#tbodyPagos').children.length) agregarPago({ tipo: 'efectivo' });
  cargarRecibos();
}

document.addEventListener('DOMContentLoaded', () => {
  $('#btnLogin').addEventListener('click', login);
  $('#btnBuscarCliente').addEventListener('click', buscarCliente);
  $('#codCliente').addEventListener('keydown', (e) => { if (e.key === 'Enter') buscarCliente(); });
  $('#btnAgregarPago').addEventListener('click', () => agregarPago());
  $('#btnEmitir').addEventListener('click', emitir);
  $('#btnImprimir').addEventListener('click', () => window.print());
  $('#btnAnular').addEventListener('click', anular);
  $('#btnIrCxc').addEventListener('click', () => { window.location.href = '/cxc.html'; });

  if (token) {
    show('login', false);
    show('app', true);
    initApp();
  }
});

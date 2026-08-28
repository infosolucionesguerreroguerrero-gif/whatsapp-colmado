'use strict';

/* eslint-env browser */

const API = '/api';
let token = localStorage.getItem('cxc_token') || '';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const fmt = (n) => `RD$ ${Number(n || 0).toFixed(2)}`;

function show(el, visible) {
  document.getElementById(el).classList.toggle('hidden', !visible);
}

function error(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg || '';
  setTimeout(() => { el.textContent = ''; }, 5000);
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
      body: JSON.stringify({
        usuario: $('#usuario').value,
        password: $('#password').value,
      }),
    });
    token = data.token;
    localStorage.setItem('cxc_token', token);
    show('login', false);
    show('app', true);
    consultar();
  } catch (e) {
    error('loginError', e.message);
  }
}

function buildParams() {
  const p = new URLSearchParams();
  if ($('#codCliente').value) p.append('codCliente', $('#codCliente').value);
  if ($('#vendedor').value) p.append('vendedor', $('#vendedor').value);
  if ($('#fechaDesde').value) p.append('fechaDesde', $('#fechaDesde').value);
  if ($('#fechaHasta').value) p.append('fechaHasta', $('#fechaHasta').value);
  if ($('#orden').value) p.append('orden', $('#orden').value);
  return p.toString() ? `?${p.toString()}` : '';
}

async function consultar(min, max) {
  try {
    let path = '/cxc';
    if (min != null && max != null) path = `/cxc/antiguedad/${min}/${max}`;
    path += buildParams();
    const data = await api(path);
    render(data.facturas, data.resumen);
  } catch (e) {
    error('appError', e.message);
  }
}

function colorStyle(colorName) {
  const map = {
    green: '#ccffcc',
    blue: '#cce5ff',
    yellow: '#fff9c4',
    gray: '#e0e0e0',
    red: '#ffcccc',
    white: '#ffffff',
  };
  return `background-color: ${map[colorName] || '#ffffff'}`;
}

function render(facturas, resumen) {
  const tb = $('#tbody');
  tb.innerHTML = '';
  for (const f of facturas || []) {
    const row = document.createElement('tr');
    row.style = colorStyle(f.color?.color || 'white');
    row.innerHTML = `
      <td>${f.nroFact}</td>
      <td>${f.fechaFact}</td>
      <td>${f.codCliente}</td>
      <td>${f.nombreCliente}</td>
      <td>${fmt(f.montoTotal)}</td>
      <td>${fmt(f.descuento)}</td>
      <td>${fmt(f.itebis)}</td>
      <td>${fmt(f.neto)}</td>
      <td>${fmt(f.abono)}</td>
      <td>${fmt(f.balFact)}</td>
      <td>${f.plazo ?? ''}</td>
      <td>${f.ncf ?? ''}</td>
      <td>${f.diasVencido}</td>
    `;
    tb.appendChild(row);
  }

  const r = resumen || {};
  $('#resumen').innerHTML = `
    <div class="card"><label>Total x Cobrar</label><strong>${r.totalXCobrar || fmt(0)}</strong></div>
    <div class="card"><label>Vencido</label><strong>${r.totalVencido || fmt(0)}</strong></div>
    <div class="card"><label>0 - 14 días</label><strong>${r.a14 || fmt(0)}</strong></div>
    <div class="card"><label>15 - 29 días</label><strong>${r.a15 || fmt(0)}</strong></div>
    <div class="card"><label>30 - 44 días</label><strong>${r.a30 || fmt(0)}</strong></div>
    <div class="card"><label>45 - 59 días</label><strong>${r.a45 || fmt(0)}</strong></div>
    <div class="card"><label>60 - 89 días</label><strong>${r.a60 || fmt(0)}</strong></div>
    <div class="card"><label>90 días +</label><strong>${r.a90 || fmt(0)}</strong></div>
    <div class="card"><label>15 a 90 días</label><strong>${r.totalA15a90 || fmt(0)}</strong></div>
  `;
}

async function exportarCsv() {
  try {
    const p = buildParams();
    const res = await fetch(`${API}/cxc/exportar/csv${p}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Error al exportar CSV');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cxc.csv';
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    error('appError', e.message);
  }
}

async function guardarAbono() {
  try {
    await api('/cxc/abono', {
      method: 'POST',
      body: JSON.stringify({
        nroFact: $('#abonoFact').value,
        monto: Number($('#abonoMonto').value),
        metodo: $('#abonoMetodo').value,
        referencia: $('#abonoRef').value,
      }),
    });
    show('abonoModal', false);
    $('#abonoFact').value = '';
    $('#abonoMonto').value = '';
    $('#abonoRef').value = '';
    consultar();
  } catch (e) {
    error('appError', e.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    show('login', false);
    show('app', true);
    consultar();
  }

  $('#btnLogin').addEventListener('click', login);
  $('#btnConsultar').addEventListener('click', () => consultar());
  $('#btnActualizar').addEventListener('click', async () => {
    try { render((await api('/cxc/actualizar')).facturas, (await api('/cxc/actualizar')).resumen); } catch (e) { error('appError', e.message); }
  });
  $('#btnExportarCsv').addEventListener('click', exportarCsv);
  $('#btnAbono').addEventListener('click', () => show('abonoModal', true));
  $('#btnCancelarAbono').addEventListener('click', () => show('abonoModal', false));
  $('#btnGuardarAbono').addEventListener('click', guardarAbono);

  $$('.row button[data-min]').forEach((btn) => {
    btn.addEventListener('click', () => consultar(Number(btn.dataset.min), Number(btn.dataset.max)));
  });
});

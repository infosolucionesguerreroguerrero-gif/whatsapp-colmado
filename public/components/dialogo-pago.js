'use strict';

/**
 * Diálogo de pago moderno (Web Component).
 *
 * Carga formas de pago y monedas desde el API, permite registrar pagos
 * múltiples, divisas con tasa/prima, calcula el cambio y dispara la
 * facturación electrónica.
 *
 * Uso:
 *   <dialogo-pago pedido-id="1001" api-base="/api"></dialogo-pago>
 */
class DialogoPago extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.pedidoId = null;
    this.apiBase = '/api';
    this.formas = [];
    this.monedas = [];
    this.pedido = null;
    this.lineas = [];
    this.currency = 'RD$';
    this.render();
  }

  static get observedAttributes() {
    return ['pedido-id', 'api-base'];
  }

  attributeChangedCallback(name, _oldValue, newValue) {
    if (name === 'pedido-id') this.pedidoId = Number(newValue);
    if (name === 'api-base') this.apiBase = newValue || '/api';
    if (this.shadowRoot) this.inicializar();
  }

  connectedCallback() {
    this.pedidoId = Number(this.getAttribute('pedido-id')) || this.pedidoId;
    this.apiBase = this.getAttribute('api-base') || this.apiBase;
    this.inicializar();
  }

  async inicializar() {
    if (!this.pedidoId) return;
    try {
      const [formas, monedas, pedido] = await Promise.all([
        this.fetchJSON(`${this.apiBase}/pagos/formas`),
        this.fetchJSON(`${this.apiBase}/pagos/monedas`),
        this.fetchJSON(`${this.apiBase}/pedido/${this.pedidoId}`),
      ]);
      this.formas = formas.data || [];
      this.monedas = monedas.data || [];
      this.pedido = pedido.data || null;
      this.currency = this.pedido ? `RD$` : 'RD$'; // Moneda base del negocio
      this.renderContenido();
    } catch (err) {
      this.mostrarError('No se pudo cargar el diálogo de pago: ' + err.message);
    }
  }

  async fetchJSON(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    return resp.json();
  }

  async postJSON(url, body) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error?.message || `${resp.status} ${resp.statusText}`);
    return data;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .dialogo { max-width: 720px; margin: 0 auto; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.12); background: #fff; }
        h2 { margin: 0 0 1rem; font-size: 1.4rem; }
        .totales { display: flex; justify-content: space-between; align-items: center; background: #f6f7f8; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
        .total { font-size: 1.6rem; font-weight: 700; color: #1a1a1a; }
        .label { color: #666; font-size: 0.9rem; }
        .linea { display: grid; grid-template-columns: 1fr 120px 120px 120px 40px; gap: 0.5rem; align-items: end; margin-bottom: 0.75rem; }
        .linea input, .linea select { padding: 0.55rem; border: 1px solid #d1d5db; border-radius: 6px; width: 100%; box-sizing: border-box; }
        .linea .btn-quitar { background: #fee2e2; color: #991b1b; border: none; border-radius: 6px; cursor: pointer; padding: 0.55rem; }
        .linea .btn-quitar:hover { background: #fecaca; }
        .referencia { grid-column: 1 / -1; }
        .referencia input { width: 100%; }
        .acciones { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem; }
        button { padding: 0.65rem 1.1rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
        .btn-agregar { background: #e5e7eb; color: #374151; }
        .btn-calcular { background: #3b82f6; color: #fff; }
        .btn-procesar { background: #10b981; color: #fff; }
        .btn-procesar:disabled { background: #9ca3af; cursor: not-allowed; }
        .resultado { margin-top: 1rem; padding: 1rem; border-radius: 8px; background: #f0fdf4; color: #14532d; }
        .resultado.error { background: #fef2f2; color: #7f1d1d; }
        .resultado pre { white-space: pre-wrap; word-break: break-word; }
        .opciones-fe { margin-top: 1rem; padding: 0.75rem; background: #f9fafb; border-radius: 6px; }
        .opciones-fe label { display: block; margin-bottom: 0.5rem; }
        .opciones-fe input[type="text"] { width: 100%; padding: 0.45rem; border: 1px solid #d1d5db; border-radius: 4px; }
        .resumen { margin-top: 1rem; font-size: 0.95rem; }
        .resumen table { width: 100%; border-collapse: collapse; }
        .resumen th, .resumen td { text-align: left; padding: 0.4rem; border-bottom: 1px solid #e5e7eb; }
        @media (max-width: 640px) {
          .linea { grid-template-columns: 1fr 1fr 40px; }
          .linea .referencia { grid-column: 1 / -1; }
        }
      </style>
      <div class="dialogo">
        <h2>Diálogo de Pago</h2>
        <div id="contenido">
          <p>Cargando...</p>
        </div>
      </div>
    `;
  }

  renderContenido() {
    if (!this.pedido) {
      this.shadowRoot.getElementById('contenido').innerHTML = '<p>Indica un <code>pedido-id</code> válido.</p>';
      return;
    }
    const totalFmt = this.format(this.pedido.total);

    this.shadowRoot.getElementById('contenido').innerHTML = `
      <div class="totales">
        <div>
          <div class="label">Total a pagar</div>
          <div class="total" id="total-pagar">${totalFmt}</div>
        </div>
        <div style="text-align:right">
          <div class="label">Pedido #${this.pedidoId}</div>
          <div id="cambio-resumen" class="label">Cambio: --</div>
        </div>
      </div>

      <div id="lineas"></div>

      <div class="acciones">
        <button class="btn-agregar" id="btn-agregar">+ Agregar pago</button>
        <button class="btn-calcular" id="btn-calcular">Calcular</button>
        <button class="btn-procesar" id="btn-procesar" disabled>Procesar pago</button>
      </div>

      <div class="opciones-fe">
        <label>
          <input type="checkbox" id="generar-fe"> Generar factura electrónica (e-CF)
        </label>
        <label>
          RNC/Cédula comprador (opcional)
          <input type="text" id="rnc-comprador" maxlength="11" placeholder="00000000000">
        </label>
      </div>

      <div id="resultado" class="resultado" style="display:none"></div>
    `;

    this.shadowRoot.getElementById('btn-agregar').addEventListener('click', () => this.agregarLinea());
    this.shadowRoot.getElementById('btn-calcular').addEventListener('click', () => this.calcular());
    this.shadowRoot.getElementById('btn-procesar').addEventListener('click', () => this.procesar());

    this.shadowRoot.getElementById('lineas').addEventListener('change', (e) => this.toggleReferencia(e));
    this.agregarLinea();
  }

  agregarLinea() {
    const lineas = this.shadowRoot.getElementById('lineas');
    const idx = lineas.children.length;
    const div = document.createElement('div');
    div.className = 'linea';
    div.dataset.index = idx;
    const formasOpts = this.formas.map((f) => `<option value="${f.codigo}">${f.nombre}</option>`).join('');
    const monedaOpts = ['<option value="">RD$</option>'].concat(this.monedas.map((m) => `<option value="${m.codigo}">${m.codigo}</option>`)).join('');
    const monedaDisplay = this.monedas.length ? '' : 'style="display:none"';
    div.innerHTML = `
      <select class="metodo" required>${formasOpts}</select>
      <input class="monto" type="number" step="0.01" min="0.01" placeholder="Monto" required>
      <select class="moneda" ${monedaDisplay}>${monedaOpts}</select>
      <input class="monto-moneda" type="number" step="0.01" min="0.01" placeholder="Monto moneda" title="Monto en la moneda seleccionada" style="display:none">
      <button class="btn-quitar" title="Quitar" ${idx === 0 ? 'style="visibility:hidden"' : ''}>×</button>
      <div class="referencia" style="display:none"><input type="text" maxlength="120" placeholder="Referencia"></div>
    `;
    lineas.appendChild(div);
    if (lineas.children.length > 1) {
      div.querySelector('.btn-quitar').addEventListener('click', () => div.remove());
    }
  }

  toggleReferencia(e) {
    const target = e.target;
    if (!target.classList.contains('metodo') && !target.classList.contains('moneda')) return;
    const linea = target.closest('.linea');
    if (target.classList.contains('metodo')) {
      const forma = this.formas.find((f) => f.codigo === target.value);
      const ref = linea.querySelector('.referencia');
      ref.style.display = forma && forma.requiereReferencia ? 'block' : 'none';
      ref.querySelector('input').required = Boolean(forma && forma.requiereReferencia);
    }
    if (target.classList.contains('moneda')) {
      const mm = linea.querySelector('.monto-moneda');
      mm.style.display = target.value ? 'block' : 'none';
      mm.required = Boolean(target.value);
    }
  }

  leerLineas() {
    const lineas = [];
    for (const div of this.shadowRoot.getElementById('lineas').children) {
      const metodo = div.querySelector('.metodo').value;
      const moneda = div.querySelector('.moneda').value || null;
      const montoMoneda = div.querySelector('.monto-moneda').value || null;
      const monto = div.querySelector('.monto').value;
      const referencia = div.querySelector('.referencia input').value || null;
      const obj = { metodo, monto: Number(monto) };
      if (moneda) {
        obj.moneda = moneda;
        obj.montoMoneda = montoMoneda ? Number(montoMoneda) : Number(monto);
      }
      if (referencia) obj.referencia = referencia;
      lineas.push(obj);
    }
    return lineas;
  }

  async calcular() {
    try {
      const lineas = this.leerLineas();
      const data = await this.postJSON(`${this.apiBase}/pagos/${this.pedidoId}/calcular`, { lineas });
      this.mostrarResumen(data.data);
      this.shadowRoot.getElementById('btn-procesar').disabled = !data.data.completado;
      return data.data;
    } catch (err) {
      this.mostrarError(err.message);
      return null;
    }
  }

  async procesar() {
    try {
      const lineas = this.leerLineas();
      const generarFe = this.shadowRoot.getElementById('generar-fe').checked;
      const rncComprador = this.shadowRoot.getElementById('rnc-comprador').value.trim() || null;
      const data = await this.postJSON(`${this.apiBase}/pagos/${this.pedidoId}/procesar`, {
        lineas,
        generarFe,
        rncComprador,
      });
      this.mostrarResultado(data.data);
      this.shadowRoot.getElementById('btn-procesar').disabled = true;
    } catch (err) {
      this.mostrarError(err.message);
    }
  }

  mostrarResumen(resumen) {
    const cambio = resumen.cambio > 0 ? this.format(resumen.cambio) : '0.00';
    const faltante = resumen.faltante > 0 ? this.format(resumen.faltante) : '0.00';
    const estado = resumen.completado ? 'Pago completo' : 'Faltante';
    this.shadowRoot.getElementById('cambio-resumen').innerHTML = `${estado}: ${resumen.completado ? 'Cambio ' + cambio : faltante}`;

    let html = '<div class="resumen"><table><thead><tr><th>Método</th><th>Base</th><th>Moneda</th><th>Tasa</th><th>Prima</th></tr></thead><tbody>';
    for (const l of resumen.lineas) {
      html += `<tr>
        <td>${l.metodo}</td>
        <td>${this.format(l.montoBase)}</td>
        <td>${l.moneda ? `${l.montoMoneda} ${l.moneda}` : '—'}</td>
        <td>${l.tasa || '—'}</td>
        <td>${l.prima ? l.prima + '%' : '—'}</td>
      </tr>`;
    }
    html += `</tbody></table><p><strong>Total pagado:</strong> ${this.format(resumen.totalPagado)} | <strong>Cambio:</strong> ${cambio}</p></div>`;
    const result = this.shadowRoot.getElementById('resultado');
    result.className = resumen.completado ? 'resultado' : 'resultado error';
    result.style.display = 'block';
    result.innerHTML = html;
  }

  mostrarResultado(data) {
    const cambio = this.format(data.cambio || 0);
    const fe = data.facturacionElectronica || { completado: false, razon: 'No solicitada' };
    const result = this.shadowRoot.getElementById('resultado');
    result.className = 'resultado';
    result.style.display = 'block';
    result.innerHTML = `
      <p><strong>Pedido #${data.pedido.id} procesado.</strong></p>
      <p>Cambio: ${cambio}</p>
      <p>Facturación electrónica: ${fe.completado ? 'Generada' : fe.razon || 'No generada'}</p>
      <pre>${JSON.stringify(data, null, 2).slice(0, 1200)}</pre>
    `;
  }

  mostrarError(msg) {
    const result = this.shadowRoot.getElementById('resultado');
    result.className = 'resultado error';
    result.style.display = 'block';
    result.innerHTML = `<p><strong>Error:</strong> ${msg}</p>`;
  }

  format(amount) {
    return 'RD$' + Number(amount || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

customElements.define('dialogo-pago', DialogoPago);

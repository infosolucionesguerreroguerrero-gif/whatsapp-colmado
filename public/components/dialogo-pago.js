'use strict';

/**
 * Diálogo de pago moderno (Web Component).
 *
 * Replica el layout de UDlgFormapagoTactil.pas: botones de formas de pago,
 * CARGO TC, divisas con tasa/prima, nota de crédito, total pagado y
 * facturación electrónica. Todo se carga dinámicamente del API.
 *
 * Uso:
 *   <dialogo-pago pedido-id="1001" api-base="/api"></dialogo-pago>
 */
class DialogoPago extends HTMLElement {
  static get observedAttributes() {
    return ['pedido-id', 'api-base'];
  }

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
    this._renderEsqueleto();
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
    this._mostrarCargando();
    try {
      const [formas, monedas, pedido] = await Promise.all([
        this._fetchJSON(`${this.apiBase}/pagos/formas`),
        this._fetchJSON(`${this.apiBase}/pagos/monedas`),
        this._fetchJSON(`${this.apiBase}/pedido/${this.pedidoId}`),
      ]);
      this.formas = (formas.data || []).filter((f) => f.activo).sort((a, b) => a.orden - b.orden);
      this.monedas = (monedas.data || []).filter((m) => m.activo).sort((a, b) => a.orden - b.orden);
      this.pedido = pedido.data || null;
      this._renderContenido();
      this._calcular(true);
    } catch (err) {
      this._msg('No se pudo cargar el diálogo de pago: ' + err.message, true);
    }
  }

  async _fetchJSON(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    return resp.json();
  }

  async _postJSON(url, body) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error?.message || `${resp.status} ${resp.statusText}`);
    return data;
  }

  _renderEsqueleto() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .dialogo { max-width: 960px; margin: 0 auto; padding: 1rem; background: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
        .header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.75rem; }
        h2 { margin: 0; font-size: 1.3rem; }
        .totales { display: flex; gap: 1.5rem; flex-wrap: wrap; }
        .totales .label { color: #666; font-size: 0.85rem; display: block; }
        .totales .value { font-size: 1.3rem; font-weight: 700; }
        .totales .pagar .value { color: #111; }
        .totales .pagado .value { color: #2563eb; }
        .totales .cambio .value { color: #16a34a; }
        .totales .faltante .value { color: #dc2626; }
        .toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center; }
        .toolbar button { padding: 0.6rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; cursor: pointer; font-weight: 600; }
        .toolbar button:hover { background: #e2e8f0; }
        .toolbar .accion { margin-left: auto; }
        .toolbar .aceptar { background: #10b981; color: #fff; border-color: #10b981; }
        .toolbar .aceptar:hover { background: #059669; }
        .toolbar .salir { background: #ef4444; color: #fff; border-color: #ef4444; }
        .toolbar .salir:hover { background: #dc2626; }
        .cuerpo { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 1rem; }
        @media (max-width: 720px) { .cuerpo { grid-template-columns: 1fr; } }
        .panel { border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem; background: #f8fafc; }
        .campo { margin-bottom: 0.6rem; }
        .campo label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.25rem; color: #334155; }
        .campo input, .campo select { width: 100%; padding: 0.45rem; border: 1px solid #cbd5e1; border-radius: 5px; box-sizing: border-box; }
        .campo-inline { display: flex; align-items: center; gap: 0.5rem; }
        .campo-inline input { flex: 1; }
        .msg { min-height: 1.5rem; padding: 0.4rem; border-radius: 5px; font-size: 0.9rem; }
        .msg.error { background: #fee2e2; color: #7f1d1d; }
        .msg.ok { background: #dcfce7; color: #14532d; }
        table.lineas { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        table.lineas th, table.lineas td { text-align: left; padding: 0.4rem; border-bottom: 1px solid #e2e8f0; }
        table.lineas input { width: 100%; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 4px; }
        table.lineas button { background: #fee2e2; color: #991b1b; border: none; border-radius: 4px; cursor: pointer; padding: 0.25rem 0.5rem; }
        .monedas .moneda-row { display: grid; grid-template-columns: 1fr 120px 80px; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem; }
        .monedas label { font-size: 0.85rem; }
        .monedas .converted { font-size: 0.85rem; color: #475569; text-align: right; }
        .total-final { margin-top: 0.75rem; padding: 0.75rem; background: #2563eb; color: #fff; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
        .total-final .value { font-size: 1.5rem; font-weight: 700; }
        .opciones-fe { margin-top: 0.75rem; padding: 0.6rem; background: #f1f5f9; border-radius: 6px; }
        .opciones-fe label { display: block; margin-bottom: 0.4rem; font-size: 0.9rem; }
        .hidden { display: none; }
      </style>
      <div class="dialogo">
        <div id="contenido"><p>Cargando...</p></div>
      </div>
    `;
  }

  _renderContenido() {
    const formasBtns = this.formas
      .filter((f) => !f.esPagoMultiple)
      .map((f) => `<button class="forma" data-codigo="${f.codigo}">${f.nombre}</button>`)
      .join('');

    const monedaRows = this.monedas
      .map((m) => `
        <div class="moneda-row" data-codigo="${m.codigo}">
          <label>${m.nombre} (${m.simbolo || m.codigo})</label>
          <input type="number" step="0.01" min="0" placeholder="0.00" class="monto-moneda">
          <span class="converted">-</span>
        </div>
      `)
      .join('');

    this.shadowRoot.getElementById('contenido').innerHTML = `
      <div class="header">
        <h2>Formas de Pago</h2>
        <div class="totales">
          <div class="pagar"><span class="label">Total a pagar</span><span class="value" id="total-pagar">-</span></div>
          <div class="pagado"><span class="label">Total pagado</span><span class="value" id="total-pagado">-</span></div>
          <div class="cambio" id="cambio-wrap"><span class="label">Cambio</span><span class="value" id="cambio">-</span></div>
        </div>
      </div>
      <div class="toolbar">
        ${formasBtns}
        <button class="accion aceptar" id="btn-aceptar">Aceptar</button>
        <button class="salir" id="btn-salir">Salir</button>
      </div>
      <div class="cuerpo">
        <div class="panel">
          <div class="campo campo-inline">
            <label for="cargoTC">CARGO TC $</label>
            <input id="cargoTC" type="number" step="0.01" min="0" value="0" placeholder="0.00">
          </div>
          <div id="msg" class="msg"></div>
          <table class="lineas">
            <thead><tr><th>Forma</th><th>Monto</th><th>Moneda</th><th>Monto moneda</th><th>Tasa</th><th>Prima</th><th>Referencia</th><th></th></tr></thead>
            <tbody id="tbody-lineas"></tbody>
          </table>
        </div>
        <div class="panel">
          <div class="campo"><label>Divisas</label></div>
          <div class="monedas">${monedaRows}</div>
          <div class="campo" style="margin-top:0.75rem">
            <label>Nota de Crédito Número</label>
            <div class="campo-inline">
              <input id="nota-credito" type="text" maxlength="30" placeholder="Número">
              <button id="btn-buscar-nota">Buscar</button>
            </div>
          </div>
          <div class="opciones-fe">
            <label><input type="checkbox" id="generar-fe"> Generar e-CF</label>
            <label>RNC/Cédula comprador <input type="text" id="rnc-comprador" maxlength="11" placeholder="00000000000"></label>
          </div>
        </div>
      </div>
      <div class="total-final">
        <span>Total Pagado $</span>
        <span class="value" id="total-pagado-final">0.00</span>
      </div>
    `;

    this.shadowRoot.querySelectorAll('.toolbar .forma').forEach((b) => {
      b.addEventListener('click', () => this._agregarLinea(b.dataset.codigo));
    });
    this.shadowRoot.getElementById('btn-aceptar').addEventListener('click', () => this._procesar());
    this.shadowRoot.getElementById('btn-salir').addEventListener('click', () => this._salir());
    this.shadowRoot.getElementById('cargoTC').addEventListener('input', () => this._calcular(true));
    this.shadowRoot.getElementById('btn-buscar-nota').addEventListener('click', () => this._buscarNotaCredito());
    this.shadowRoot.querySelectorAll('.monedas .monto-moneda').forEach((input) => {
      input.addEventListener('input', () => this._sincronizarDivisas());
    });

    this._renderLineas();
  }

  _mostrarCargando() {
    this.shadowRoot.getElementById('contenido').innerHTML = '<p>Cargando...</p>';
  }

  _agregarLinea(codigoForma) {
    const forma = this.formas.find((f) => f.codigo === codigoForma);
    if (!forma) return;
    this.lineas.push({ metodo: forma.codigo, monto: '', moneda: '', montoMoneda: '', referencia: '' });
    this._renderLineas();
    this._calcular(true);
  }

  _eliminarLinea(index) {
    this.lineas.splice(index, 1);
    this._renderLineas();
    this._calcular(true);
  }

  _renderLineas() {
    const tbody = this.shadowRoot.getElementById('tbody-lineas');
    if (!tbody) return;
    const formasMap = new Map(this.formas.map((f) => [f.codigo, f]));
    const monedasMap = new Map(this.monedas.map((m) => [m.codigo, m]));
    const monedaOpts = ['<option value="">-</option>']
      .concat(this.monedas.map((m) => `<option value="${m.codigo}">${m.codigo}</option>`))
      .join('');

    tbody.innerHTML = this.lineas.map((l, i) => {
      const forma = formasMap.get(l.metodo);
      const moneda = l.moneda ? monedasMap.get(l.moneda) : null;
      const reqRef = forma && forma.requiereReferencia;
      const refDisplay = reqRef ? 'block' : 'none';
      return `
        <tr data-index="${i}">
          <td>${forma ? forma.nombre : l.metodo}</td>
          <td><input type="number" step="0.01" min="0" class="monto" value="${l.monto || ''}" ${l.moneda ? 'readonly' : ''}></td>
          <td><select class="moneda">${monedaOpts.replace(`value="${l.moneda}"`, `value="${l.moneda}" selected`)}</select></td>
          <td><input type="number" step="0.01" min="0" class="monto-moneda" value="${l.montoMoneda || ''}" ${l.moneda ? '' : 'disabled'}></td>
          <td>${moneda ? moneda.tasa : '-'}</td>
          <td>${moneda ? (moneda.prima || 0) + '%' : '-'}</td>
          <td>
            <input type="text" class="referencia" value="${l.referencia || ''}" placeholder="${reqRef ? 'Requerido' : 'Opcional'}" style="display:${refDisplay}">
          </td>
          <td><button class="eliminar">×</button></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('input, select').forEach((el) => {
      el.addEventListener('input', () => this._leerLineasDeTabla());
    });
    tbody.querySelectorAll('button.eliminar').forEach((b) => {
      b.addEventListener('click', (e) => this._eliminarLinea(Number(e.target.closest('tr').dataset.index)));
    });
  }

  _leerLineasDeTabla() {
    const tbody = this.shadowRoot.getElementById('tbody-lineas');
    const filas = tbody.querySelectorAll('tr');
    filas.forEach((tr, i) => {
      const l = this.lineas[i];
      if (!l) return;
      l.monto = tr.querySelector('.monto').value;
      l.moneda = tr.querySelector('.moneda').value;
      l.montoMoneda = tr.querySelector('.monto-moneda').value;
      l.referencia = tr.querySelector('.referencia').value;
    });
    this._calcular(true);
  }

  _sincronizarDivisas() {
    const map = new Map(this.monedas.map((m) => [m.codigo, m]));
    this.shadowRoot.querySelectorAll('.monedas .moneda-row').forEach((row) => {
      const codigo = row.dataset.codigo;
      const monto = row.querySelector('.monto-moneda').value;
      const span = row.querySelector('.converted');
      const moneda = map.get(codigo);
      if (!monto || !moneda || !moneda.tasa) {
        span.textContent = '-';
        return;
      }
      const prima = Number(moneda.prima || 0);
      const tasa = Number(moneda.tasa);
      const base = Number(monto) * tasa * (1 + prima / 100);
      span.textContent = this._fmt(base);
    });

    // Convierte divisas a líneas de pago (método Efectivo / 1)
    const efectivo = this.formas.find((f) => f.codigo === '1') || this.formas[0];
    const baseCodigo = efectivo ? efectivo.codigo : '1';

    // Quita líneas de pago que correspondan a divisas para recrearlas
    this.lineas = this.lineas.filter((l) => !l.moneda);

    this.shadowRoot.querySelectorAll('.monedas .moneda-row').forEach((row) => {
      const codigo = row.dataset.codigo;
      const monto = row.querySelector('.monto-moneda').value;
      if (!monto) return;
      this.lineas.push({
        metodo: baseCodigo,
        monto: '',
        moneda: codigo,
        montoMoneda: monto,
        referencia: '',
      });
    });

    this._renderLineas();
    this._calcular(true);
  }

  _buscarNotaCredito() {
    const numero = this.shadowRoot.getElementById('nota-credito').value.trim();
    if (!numero) return this._msg('Indique el número de nota de crédito', true);
    const nota = this.formas.find((f) => f.codigo === '8');
    const codigo = nota ? nota.codigo : '8';
    // Busca o crea línea de nota de crédito con la referencia
    const idx = this.lineas.findIndex((l) => l.metodo === codigo && l.referencia === numero);
    if (idx === -1) {
      this.lineas.push({ metodo: codigo, monto: '', moneda: '', montoMoneda: '', referencia: numero });
    }
    this._renderLineas();
    this._msg(`Nota de crédito ${numero} seleccionada. Indique el monto.`, false);
  }

  _leerPayload() {
    const cargoTCInput = this.shadowRoot.getElementById('cargoTC');
    const cargoTC = cargoTCInput ? Number(cargoTCInput.value || 0) : 0;
    const lineas = this.lineas
      .filter((l) => Number(l.monto || l.montoMoneda) > 0)
      .map((l) => {
        const obj = { metodo: l.metodo, monto: Number(l.monto || l.montoMoneda || 0) };
        if (l.moneda) {
          obj.moneda = l.moneda;
          obj.montoMoneda = Number(l.montoMoneda || l.monto || 0);
        }
        if (l.referencia) obj.referencia = l.referencia;
        return obj;
      });
    return { lineas, cargoTC };
  }

  async _calcular(silencioso = false) {
    try {
      const payload = this._leerPayload();
      if (payload.lineas.length === 0) {
        this._actualizarTotales({ totalConCargo: this.pedido ? this.pedido.totalConCargo || this.pedido.total : 0, totalPagado: 0, cambio: 0, faltante: this.pedido ? this.pedido.total : 0 });
        return;
      }
      const data = await this._postJSON(`${this.apiBase}/pagos/${this.pedidoId}/calcular`, payload);
      this._actualizarTotales(data.data);
      if (!silencioso) this._msg('Cálculo actualizado', false);
      return data.data;
    } catch (err) {
      if (!silencioso) this._msg(err.message, true);
      return null;
    }
  }

  async _procesar() {
    try {
      const payload = this._leerPayload();
      if (payload.lineas.length === 0) throw new Error('Indique al menos un pago');
      const generarFe = this.shadowRoot.getElementById('generar-fe').checked;
      const rncComprador = this.shadowRoot.getElementById('rnc-comprador').value.trim() || null;
      const data = await this._postJSON(`${this.apiBase}/pagos/${this.pedidoId}/procesar`, { ...payload, generarFe, rncComprador });
      this._actualizarTotales(data.data);
      const fe = data.data.facturacionElectronica || { completado: false, razon: 'No solicitada' };
      this._msg(`Pedido procesado. Cambio: ${this._fmt(data.data.cambio || 0)}. e-CF: ${fe.completado ? 'Generada' : fe.razon || 'No generada'}`, false);
      this.dispatchEvent(new CustomEvent('pago-procesado', { detail: data.data, bubbles: true, composed: true }));
    } catch (err) {
      this._msg(err.message, true);
    }
  }

  _salir() {
    this.dispatchEvent(new CustomEvent('pago-cerrar', { bubbles: true, composed: true }));
  }

  _actualizarTotales(resumen) {
    const totalPagar = Number(resumen.totalConCargo || resumen.total || 0);
    const totalPagado = Number(resumen.totalPagado || 0);
    const cambio = Number(resumen.cambio || 0);
    const faltante = Number(resumen.faltante || 0);

    this.shadowRoot.getElementById('total-pagar').textContent = this._fmt(totalPagar);
    this.shadowRoot.getElementById('total-pagado').textContent = this._fmt(totalPagado);
    const cambioWrap = this.shadowRoot.getElementById('cambio-wrap');
    const cambioEl = this.shadowRoot.getElementById('cambio');
    if (faltante > 0) {
      cambioWrap.className = 'faltante';
      cambioEl.textContent = this._fmt(faltante);
      cambioWrap.querySelector('.label').textContent = 'Faltante';
    } else {
      cambioWrap.className = 'cambio';
      cambioEl.textContent = this._fmt(cambio);
      const label = cambioWrap.querySelector('.label');
      if (label) label.textContent = 'Cambio';
    }
    this.shadowRoot.getElementById('total-pagado-final').textContent = this._fmt(totalPagado);
  }

  _msg(text, esError) {
    const el = this.shadowRoot.getElementById('msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'msg ' + (esError ? 'error' : 'ok');
  }

  _fmt(amount) {
    return this.currency + Number(amount || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

customElements.define('dialogo-pago', DialogoPago);

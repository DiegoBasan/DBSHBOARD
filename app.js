'use strict';

const CFG_KEY = 'dbsh.cfg';
const CACHE_KEY = 'dbsh.cache';
const $ = (s) => document.querySelector(s);
const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const monthFmt = new Intl.DateTimeFormat('es-MX', { month: 'long' });
const dayFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// ---------- Catálogos ----------

const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const CATS = {
  Comida:         { color: '#f97316', icon: svg('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>') },
  Super:          { color: '#16a34a', icon: svg('<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 7H5.1"/>') },
  Transporte:     { color: '#0ea5e9', icon: svg('<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>') },
  Servicios:      { color: '#eab308', icon: svg('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>') },
  Suscripciones:  { color: '#a855f7', icon: svg('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>') },
  Compras:        { color: '#ec4899', icon: svg('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>') },
  Salud:          { color: '#ef4444', icon: svg('<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>') },
  Transferencias: { color: '#64748b', icon: svg('<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>') },
  Ingresos:       { color: '#10b981', icon: svg('<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>') },
  Otros:          { color: '#94a3b8', icon: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>') },
};
const cat = (c) => CATS[c] || CATS.Otros;

// Tus tarjetas. Los ids deben coincidir con CUENTAS en backend/Code.gs.
const CARDS = [
  { id: 'bbva-credito', banco: 'BBVA',         nombre: 'Azul',       tipo: 'Crédito', red: 'VISA',       c1: '#0a2a66', c2: '#1464d2', ink: '#ffffff' },
  { id: 'mp-debito',    banco: 'Mercado Pago', nombre: 'Débito',     tipo: 'Débito',  red: 'Mastercard', c1: '#0b0b0b', c2: '#2a2a2a', ink: '#ffffff', tag: '#9ca3af' },
  { id: 'bbva-debito',  banco: 'BBVA',         nombre: 'Azul cielo', tipo: 'Débito',  red: 'VISA',       c1: '#3fa9f5', c2: '#9bd6ff', ink: '#06213f' },
  { id: 'nu-credito',   banco: 'Nu',           nombre: 'Crédito',    tipo: 'Crédito', red: 'Mastercard', c1: '#5b0a9e', c2: '#9a2ee6', ink: '#ffffff' },
];
const cardById = (id) => CARDS.find((c) => c.id === id);

const state = {
  cfg: load(CFG_KEY) || {},
  items: load(CACHE_KEY) || [],
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  filter: 'todos',
  card: null, // id de tarjeta seleccionada o null = todas
};

function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
const isDemo = () => !state.cfg.url;

// ---------- Backend ----------

async function api(body) {
  if (isDemo()) return demoApi(body);
  if (!body) {
    const r = await fetch(`${state.cfg.url}?token=${encodeURIComponent(state.cfg.token)}`);
    return r.json();
  }
  // text/plain evita el preflight CORS que Apps Script no soporta.
  const r = await fetch(state.cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: state.cfg.token, ...body }),
  });
  return r.json();
}

async function refresh() {
  $('#refresh').style.opacity = .4;
  try {
    const res = await api();
    if (!res.ok) throw new Error(res.error || 'Error');
    state.items = res.movimientos;
    save(CACHE_KEY, state.items);
    banner(isDemo() ? 'Modo demo: datos de ejemplo. Toca ⚙︎ para conectar tu backend.' : '');
  } catch (e) {
    banner(`No se pudo actualizar (${e.message}). Mostrando lo último guardado.`);
  }
  $('#refresh').style.opacity = 1;
  render();
}

// ---------- Render ----------

function render() {
  const y = state.month.getFullYear(), m = state.month.getMonth();
  $('#month-label').innerHTML = `${monthFmt.format(state.month)} <span class="yr">${y}</span>`;

  const mesTodo = state.items
    .map((i) => ({ ...i, d: new Date(i.fecha) }))
    .filter((i) => i.d.getFullYear() === y && i.d.getMonth() === m)
    .sort((a, b) => b.d - a.d);
  const delMes = state.card ? mesTodo.filter((i) => i.cuenta === state.card) : mesTodo;

  // Tarjetas
  $('#wallet').innerHTML = CARDS.map((c) => {
    const g = sum(mesTodo.filter((i) => i.cuenta === c.id && i.tipo === 'gasto'));
    const sel = state.card === c.id ? ' sel' : state.card ? ' dim' : '';
    return `<button class="ccard${sel}" data-card="${c.id}" style="--c1:${c.c1};--c2:${c.c2};--ink:${c.ink}">
      <span class="cc-top"><b>${esc(c.banco)}</b><span>${esc(c.tipo)}</span></span>
      <span class="cc-chip"></span>
      <span class="cc-bottom">
        <span><small>${esc(c.nombre)} · gastado</small><strong>${mxn.format(g)}</strong></span>
        <i>${esc(c.red)}</i>
      </span>
    </button>`;
  }).join('');
  $('#wallet-label').textContent = state.card ? `${cardById(state.card).banco} ${cardById(state.card).nombre} · toca de nuevo para ver todas` : 'Toca una tarjeta para filtrar';

  const gastos = sum(delMes.filter((i) => i.tipo === 'gasto'));
  const ingresos = sum(delMes.filter((i) => i.tipo === 'ingreso'));
  const balance = ingresos - gastos;

  $('#k-gastos').textContent = mxn.format(gastos);
  $('#k-ingresos').textContent = mxn.format(ingresos);
  $('#k-balance').textContent = mxn.format(balance);
  $('#k-balance').className = balance < 0 ? 'neg' : 'pos';
  const nG = delMes.filter((i) => i.tipo === 'gasto').length;
  $('#k-sub').textContent = `${delMes.length} movimientos · gasto promedio ${mxn.format(nG ? gastos / nG : 0)}`;

  // Gasto diario
  const dias = new Date(y, m + 1, 0).getDate();
  const hoy = new Date();
  const esMesActual = hoy.getFullYear() === y && hoy.getMonth() === m;
  const diasTranscurridos = esMesActual ? hoy.getDate() : dias;
  const porDia = Array(dias).fill(0);
  delMes.filter((i) => i.tipo === 'gasto').forEach((i) => { porDia[i.d.getDate() - 1] += i.monto; });
  const maxDia = Math.max(...porDia, 1);
  $('#chart').innerHTML = porDia.map((v, i) =>
    `<div class="b${v ? ' has' : ''}${esMesActual && i + 1 === hoy.getDate() ? ' today' : ''}" style="height:${(v / maxDia) * 100}%" title="${i + 1}: ${mxn.format(v)}"></div>`).join('');
  $('#chart-axis').innerHTML = [1, Math.ceil(dias / 2), dias].map((d) => `<span>${d}</span>`).join('');
  $('#daily-max').textContent = gastos ? `máx. ${mxn.format(maxDia)}` : '';
  $('#k-diario').textContent = mxn.format(gastos / diasTranscurridos);

  // Categorías (solo gastos)
  const porCat = {};
  delMes.filter((i) => i.tipo === 'gasto').forEach((i) => { porCat[i.categoria] = (porCat[i.categoria] || 0) + i.monto; });
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const max = cats[0]?.[1] || 1;
  $('#k-top').textContent = cats.length ? `Mayor categoría: ${cats[0][0]}` : '';
  $('#cats').innerHTML = cats.length
    ? cats.map(([c, v]) => `
        <li style="--c:${cat(c).color}"><span class="cat-name"><span class="ci">${cat(c).icon}</span>${esc(c)}</span><span class="amt">${mxn.format(v)} <span class="pct">${Math.round(v / gastos * 100)}%</span></span>
        <div class="track"><div class="fill" style="width:${(v / max) * 100}%"></div></div></li>`).join('')
    : '<li class="empty">Sin gastos este mes.</li>';

  // Lista
  const lista = state.filter === 'todos' ? delMes : delMes.filter((i) => i.tipo === state.filter);
  $('#list').innerHTML = lista.length
    ? lista.map((i) => `
        <li style="--c:${cat(i.categoria).color}">
          <div class="dot">${cat(i.categoria).icon}</div>
          <div class="body">
            <div class="title">${esc(i.concepto || i.texto || 'Sin concepto')}</div>
            <div class="meta">${dayFmt.format(i.d)} · ${esc(i.categoria)}${cardById(i.cuenta) ? ` · <span class="tag" style="--t:${cardById(i.cuenta).tag || cardById(i.cuenta).c2}">${esc(cardById(i.cuenta).banco)} ${esc(cardById(i.cuenta).nombre)}</span>` : ''}</div>
          </div>
          <div class="amt ${i.tipo === 'gasto' ? 'neg' : 'pos'}">${i.tipo === 'gasto' ? '−' : '+'}${mxn.format(i.monto)}</div>
          <button class="del" data-id="${esc(i.id)}" aria-label="Borrar">×</button>
        </li>`).join('')
    : '<li class="empty">Nada por aquí todavía.</li>';
}

const sum = (arr) => arr.reduce((s, i) => s + (Number(i.monto) || 0), 0);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function banner(msg) { const b = $('#banner'); b.textContent = msg; b.hidden = !msg; }

// ---------- Eventos ----------

$('#prev').onclick = () => { state.month.setMonth(state.month.getMonth() - 1); render(); };
$('#next').onclick = () => { state.month.setMonth(state.month.getMonth() + 1); render(); };
$('#refresh').onclick = refresh;

document.querySelectorAll('.card-head .seg button').forEach((b) => b.onclick = () => {
  document.querySelectorAll('.card-head .seg button').forEach((x) => x.classList.toggle('on', x === b));
  state.filter = b.dataset.f;
  render();
});

$('#wallet').onclick = (e) => {
  const id = e.target.closest('.ccard')?.dataset.card;
  if (!id) return;
  state.card = state.card === id ? null : id;
  render();
};

$('#list').onclick = async (e) => {
  const id = e.target.closest('.del')?.dataset.id;
  if (!id || !confirm('¿Borrar este movimiento?')) return;
  const res = await api({ action: 'delete', id });
  if (res.ok) { state.items = state.items.filter((i) => i.id !== id); save(CACHE_KEY, state.items); render(); }
  else alert(res.error);
};

// Tema: sistema -> claro -> oscuro
const THEME_KEY = 'dbsh.theme';
const ICONS = {
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
  light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
};
const LABELS = { auto: 'Tema: sistema', light: 'Tema: claro', dark: 'Tema: oscuro' };
function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  $('#theme').innerHTML = ICONS[t] || ICONS.auto;
  $('#theme').title = LABELS[t] || LABELS.auto;
}
let theme = (() => { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; } })();
applyTheme(theme);
$('#theme').onclick = () => {
  theme = { auto: 'light', light: 'dark', dark: 'auto' }[theme] || 'auto';
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
  applyTheme(theme);
};

$('#open-add-top').onclick = () => $('#open-add').onclick();
$('#open-add').onclick = () => {
  $('#add-form').reset();
  $('#add-form').fecha.value = new Date().toLocaleDateString('en-CA');
  $('#add-form').categoria.value = 'Otros';
  $('#add-form').cuenta.value = state.card || '';
  $('#add-dlg').showModal();
};
$('#add-dlg').addEventListener('close', async () => {
  if ($('#add-dlg').returnValue !== 'ok') return;
  const f = Object.fromEntries(new FormData($('#add-form')));
  if (f.fecha) f.fecha = new Date(`${f.fecha}T12:00:00`).toISOString();
  const res = await api({ action: 'add', ...f });
  if (res.ok) { state.items.push(res.movimiento); save(CACHE_KEY, state.items); render(); }
  else alert(res.error);
});

$('#open-settings').onclick = () => {
  $('#settings-form').url.value = state.cfg.url || '';
  $('#settings-form').token.value = state.cfg.token || '';
  $('#settings-dlg').showModal();
};
$('#settings-dlg').addEventListener('close', () => {
  const v = $('#settings-dlg').returnValue;
  if (v === 'demo') state.cfg = {};
  else if (v === 'ok') {
    const f = $('#settings-form');
    state.cfg = { url: f.url.value.trim(), token: f.token.value.trim() };
  } else return;
  save(CFG_KEY, state.cfg);
  state.items = [];
  refresh();
});

// ---------- Demo ----------

let demoData = null;
function demoApi(body) {
  if (!demoData) {
    const now = new Date();
    const d = (dd, h = 13) => new Date(now.getFullYear(), now.getMonth(), Math.min(dd, now.getDate()), h).toISOString();
    demoData = [
      ['ingreso', 18500, 'Nómina', 'Ingresos', d(1, 9), 'bbva-debito'],
      ['gasto', 6500, 'Renta', 'Servicios', d(1, 10), 'bbva-debito'],
      ['gasto', 249, 'OXXO', 'Comida', d(2), 'mp-debito'],
      ['gasto', 1320.5, 'Walmart', 'Super', d(3, 18), 'bbva-credito'],
      ['gasto', 199, 'Netflix', 'Suscripciones', d(4), 'nu-credito'],
      ['gasto', 115, 'Spotify', 'Suscripciones', d(4), 'nu-credito'],
      ['gasto', 86, 'Uber', 'Transporte', d(5, 22), 'mp-debito'],
      ['gasto', 850, 'Pemex', 'Transporte', d(6), 'bbva-credito'],
      ['ingreso', 1500, 'Juan Pérez', 'Ingresos', d(7, 20), 'mp-debito'],
      ['gasto', 389, 'Amazon', 'Compras', d(8), 'nu-credito'],
      ['gasto', 420, 'CFE', 'Servicios', d(9), 'bbva-debito'],
      ['gasto', 165, 'Starbucks', 'Comida', d(10, 8), 'mp-debito'],
    ].map(([tipo, monto, concepto, categoria, fecha, cuenta], i) => ({ id: `demo${i}`, tipo, monto, concepto, categoria, fecha, cuenta, origen: 'Mercado Pago', texto: '' }));
  }
  if (!body) return { ok: true, movimientos: demoData };
  if (body.action === 'delete') { demoData = demoData.filter((i) => i.id !== body.id); return { ok: true }; }
  if (body.action === 'add') {
    const mov = { id: `demo${Date.now()}`, tipo: body.tipo, monto: Number(body.monto) || 0, concepto: body.concepto, categoria: body.categoria, cuenta: body.cuenta, fecha: body.fecha || new Date().toISOString(), origen: 'Manual', texto: '' };
    demoData.push(mov);
    return { ok: true, movimiento: mov };
  }
  return { ok: false, error: 'no soportado en demo' };
}

// ---------- Arranque ----------

// Selects del formulario a partir de los catálogos.
$('#add-form').categoria.innerHTML = Object.keys(CATS).map((c) => `<option>${c}</option>`).join('');
$('#add-form').cuenta.innerHTML = '<option value="">Sin tarjeta / efectivo</option>' +
  CARDS.map((c) => `<option value="${c.id}">${c.banco} ${c.nombre} (${c.tipo.toLowerCase()})</option>`).join('');

// Sin zoom: se siente como app nativa.
['gesturestart', 'gesturechange'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouch < 300 && !e.target.closest('input, select, textarea')) e.preventDefault();
  lastTouch = now;
}, { passive: false });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
render();
refresh();

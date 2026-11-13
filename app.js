'use strict';

const CFG_KEY = 'dbsh.cfg';
const CACHE_KEY = 'dbsh.cache';
const $ = (s) => document.querySelector(s);
const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const monthFmt = new Intl.DateTimeFormat('es-MX', { month: 'long' });
const dayFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const state = {
  cfg: load(CFG_KEY) || {},
  items: load(CACHE_KEY) || [],
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  filter: 'todos',
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

  const delMes = state.items
    .map((i) => ({ ...i, d: new Date(i.fecha) }))
    .filter((i) => i.d.getFullYear() === y && i.d.getMonth() === m)
    .sort((a, b) => b.d - a.d);

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
        <li><span>${esc(c)}</span><span class="amt">${mxn.format(v)} <span class="pct">${Math.round(v / gastos * 100)}%</span></span>
        <div class="track"><div class="fill" style="width:${(v / max) * 100}%"></div></div></li>`).join('')
    : '<li class="empty">Sin gastos este mes.</li>';

  // Lista
  const lista = state.filter === 'todos' ? delMes : delMes.filter((i) => i.tipo === state.filter);
  $('#list').innerHTML = lista.length
    ? lista.map((i) => `
        <li>
          <div class="dot">${esc((i.categoria || '?').slice(0, 2))}</div>
          <div class="body">
            <div class="title">${esc(i.concepto || i.texto || 'Sin concepto')}</div>
            <div class="meta">${dayFmt.format(i.d)} · ${esc(i.categoria)}${i.origen === 'Manual' ? ' · manual' : ''}</div>
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
      ['ingreso', 18500, 'Nómina', 'Ingresos', d(1, 9)],
      ['gasto', 6500, 'Renta', 'Servicios', d(1, 10)],
      ['gasto', 249, 'OXXO', 'Comida', d(2)],
      ['gasto', 1320.5, 'Walmart', 'Super', d(3, 18)],
      ['gasto', 199, 'Netflix', 'Suscripciones', d(4)],
      ['gasto', 115, 'Spotify', 'Suscripciones', d(4)],
      ['gasto', 86, 'Uber', 'Transporte', d(5, 22)],
      ['gasto', 850, 'Pemex', 'Transporte', d(6)],
      ['ingreso', 1500, 'Juan Pérez', 'Ingresos', d(7, 20)],
      ['gasto', 389, 'Amazon', 'Compras', d(8)],
      ['gasto', 420, 'CFE', 'Servicios', d(9)],
      ['gasto', 165, 'Starbucks', 'Comida', d(10, 8)],
    ].map(([tipo, monto, concepto, categoria, fecha], i) => ({ id: `demo${i}`, tipo, monto, concepto, categoria, fecha, origen: 'Mercado Pago', texto: '' }));
  }
  if (!body) return { ok: true, movimientos: demoData };
  if (body.action === 'delete') { demoData = demoData.filter((i) => i.id !== body.id); return { ok: true }; }
  if (body.action === 'add') {
    const mov = { id: `demo${Date.now()}`, tipo: body.tipo, monto: Number(body.monto) || 0, concepto: body.concepto, categoria: body.categoria, fecha: body.fecha || new Date().toISOString(), origen: 'Manual', texto: '' };
    demoData.push(mov);
    return { ok: true, movimiento: mov };
  }
  return { ok: false, error: 'no soportado en demo' };
}

// ---------- Arranque ----------

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
render();
refresh();

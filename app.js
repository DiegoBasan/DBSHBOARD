'use strict';

// Llave pública VAPID para notificaciones push (la privada vive solo en Netlify).
const VAPID_PUBLIC = 'BL9zWK7YcTkz6tIu6eOB-rNPRI2q_eCUPdk6GatLUr7zemTqFNMrul2h6t2sWeD2rywIAqA3PSQT1iXOl71D1pI';

const CFG_KEY = 'dbsh.cfg', CACHE_KEY = 'dbsh.cache', CONF_KEY = 'dbsh.conf', TAB_KEY = 'dbsh.tab', PRIV_KEY = 'dbsh.priv';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const mxn0 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const monthFmt = new Intl.DateTimeFormat('es-MX', { month: 'long' });
const mShort = new Intl.DateTimeFormat('es-MX', { month: 'short' });
const dayFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
const DAY = 864e5;

// ---------- Catálogos ----------

const svg = (body, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
// k: need (necesidad) · want (gusto) · in (ingreso) · move (entre tus cuentas)
const CATS = {
  Comida:         { c: '#FF8A65', k: 'want', ic: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>' },
  Super:          { c: '#3DD68C', k: 'need', ic: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 7H5.1"/>' },
  Casa:           { c: '#9B7BFF', k: 'need', ic: '<path d="M4 10.5L12 4l8 6.5V20H4z"/>' },
  Auto:           { c: '#4DA3FF', k: 'need', ic: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>' },
  Transporte:     { c: '#FFB020', k: 'need', ic: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 21v-3M16 21v-3"/>' },
  Salud:          { c: '#FF6FA8', k: 'need', ic: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>' },
  Ocio:           { c: '#E879F9', k: 'want', ic: '<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/>' },
  Suscripciones:  { c: '#22C3D6', k: 'want', ic: '<path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4"/>' },
  Compras:        { c: '#F59E0B', k: 'want', ic: '<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/>' },
  Deudas:         { c: '#EF5350', k: 'need', ic: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>' },
  Transferencias: { c: '#8D99AE', k: 'want', ic: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>' },
  Otros:          { c: '#9FA4AE', k: 'want', ic: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>' },
  Ingresos:       { c: '#1F9D55', k: 'in', ic: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>' },
  Apartados:      { c: '#A3C93A', k: 'move', ic: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14v4M3 5v14a2 2 0 0 0 2 2h14v-4"/><path d="M15 13h6v4h-6a2 2 0 0 1 0-4z"/>' },
};
const CAT_ALIAS = { Servicios: 'Casa' }; // categorías de versiones anteriores
const catName = (c) => (CATS[c] ? c : CATS[CAT_ALIAS[c]] ? CAT_ALIAS[c] : 'Otros');
const cat = (c) => CATS[catName(c)];

// Tus tarjetas. Los ids coinciden con CUENTAS en backend/Code.gs.
const CARDS = [
  { id: 'mp-debito',    n: 'Mercado Pago', t: 'deb',  face: 'mp',    last: '',     mini: '#0F0F10' },
  { id: 'bbva-credito', n: 'BBVA Azul',    t: 'cred', face: 'bbva',  last: '3435', mini: 'linear-gradient(160deg,#2F5597,#16336C)' },
  { id: 'nu-credito',   n: 'Nu',           t: 'cred', face: 'nu',    last: '5003', mini: 'linear-gradient(135deg,#5E2B9E,#B15CFF)' },
  { id: 'bbva-debito',  n: 'BBVA Aqua',    t: 'deb',  face: 'bbvaa', last: '',     mini: 'linear-gradient(160deg,#A4E3E8,#4FA8B5)' },
];
// Saldos de tu app anterior (desactualizados): actualízalos con "Editar" en cada tarjeta.
// saldo: lo que tienes (débito) o lo que debes en negativo (crédito), a la fecha indicada.
const DEFAULT_CARDS = {
  'mp-debito':    { saldo: 5288,  fecha: '2026-11-13' },
  'bbva-credito': { saldo: -2749, fecha: '2026-11-13' },
  'nu-credito':   { saldo: -769,  fecha: '2026-11-13' },
  'bbva-debito':  { saldo: 33856, fecha: '2026-11-13' },
};
const OTHER_ACC = { efectivo: { n: 'Efectivo', mini: 'linear-gradient(160deg,#3B4B3E,#24302A)' } };
const cardById = (id) => CARDS.find((c) => c.id === id);
const potOf = (dest) => String(dest).replace(/^apartado[+-]?:/, '');
const accName = (id) => cardById(id)?.n || OTHER_ACC[id]?.n || (String(id || '').startsWith('apartado') ? `Apartado ${potOf(id)}` : '');
const POTC = ['#4DA3FF', '#FF8A65', '#3DD68C', '#9B7BFF', '#FFB020', '#FF6FA8', '#22C3D6', '#E879F9', '#F59E0B', '#2BBF8A', '#EF5350', '#8D99AE', '#A3C93A'];

// ---------- Estado ----------

const state = {
  cfg: load(CFG_KEY) || {},
  items: load(CACHE_KEY) || [],
  conf: load(CONF_KEY) || {},
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  filter: 'todos',
  q: '',
  tab: load(TAB_KEY) || 'inicio',
  card: CARDS[0].id,
  showAll: false,
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
  $('#refresh').classList.add('spin');
  try {
    const res = await api();
    if (!res.ok) throw new Error(res.error || 'Error');
    state.items = res.movimientos;
    state.conf = res.config || {};
    save(CACHE_KEY, state.items);
    save(CONF_KEY, state.conf);
    banner(isDemo() ? 'Estás viendo datos de ejemplo. Toca ⚙︎ para conectar tu backend.' : '');
  } catch (e) {
    banner(`No se pudo actualizar (${e.message}). Mostrando lo último guardado.`);
  }
  $('#refresh').classList.remove('spin');
  render();
}

async function saveConf(partial) {
  Object.assign(state.conf, partial);
  save(CONF_KEY, state.conf);
  render();
  const res = await api({ action: 'config', config: partial });
  if (!res.ok) toast(res.error || 'No se pudo guardar');
}

// ---------- Cálculos ----------

const items = () => state.items.map((i) => ({ ...i, d: new Date(i.fecha), categoria: catName(i.categoria) }));
const sum = (arr, f = (i) => i.monto) => arr.reduce((s, i) => s + (Number(f(i)) || 0), 0);
const sameMonth = (d, ref) => d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const ymd = (d) => d.toLocaleDateString('en-CA');

const cardConf = (id) => ({ ...DEFAULT_CARDS[id], ...((state.conf.cards || {})[id] || {}) });

/** Saldo actual de una tarjeta: el que confirmaste + lo que pasó después de esa fecha */
function cardBalance(id, all = items()) {
  const c = cardConf(id), from = new Date(`${c.fecha}T23:59:59`);
  let b = Number(c.saldo) || 0;
  for (const i of all) {
    if (i.d <= from) continue;
    if (i.tipo === 'ingreso' && i.cuenta === id) b += i.monto;
    else if (i.tipo === 'gasto' && i.cuenta === id) b -= i.monto;
    else if (i.tipo === 'movimiento') {
      const retiro = String(i.destino).startsWith('apartado-:');
      if (i.cuenta === id) b += retiro ? i.monto : -i.monto;
      if (i.destino === id) b += i.monto;
    }
  }
  return b;
}

const pots = () => state.conf.pots || {};
function potBalance(name, all = items()) {
  const p = pots()[name] || {}, from = new Date(`${p.fecha || '2000-01-01'}T23:59:59`);
  let b = Number(p.saldo) || 0;
  for (const i of all) {
    if (i.tipo !== 'movimiento' || i.d <= from || potOf(i.destino) !== name) continue;
    if (String(i.destino).startsWith('apartado+:')) b += i.monto;
    else if (String(i.destino).startsWith('apartado-:')) b -= i.monto;
  }
  return b;
}
const potColor = (name, i) => pots()[name]?.c || POTC[i % POTC.length];

// ---------- Render ----------

function render() {
  const y = state.month.getFullYear();
  $('#month-label').innerHTML = `${monthFmt.format(state.month)} <span class="yr">${y}</span>`;
  $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === state.tab));
  $$('.view').forEach((v) => (v.hidden = v.id !== `v-${state.tab}`));
  const all = items();
  ({ inicio: renderInicio, tarjetas: renderTarjetas, apartados: renderApartados, analisis: renderAnalisis })[state.tab](all);
}

/* --- caras de tarjeta (recreaciones visuales de tu app) --- */
const MC = '<span class="mc"><i></i><i></i></span>';
const NFC = svg('<path d="M8 8a6 6 0 0 1 0 8M12 5a10 10 0 0 1 0 14M16 2.5a13.5 13.5 0 0 1 0 19"/>');
const PEAK = (c) => `<svg class="peak" viewBox="0 0 100 100" fill="none" stroke="${c}" stroke-width="1.6"><path d="M18 96L50 8l32 88M30 96L50 40l20 56"/><path d="M-200 52H38M62 52H300" stroke-width="1"/></svg>`;
function cardFace(c, bal) {
  const last = cardConf(c.id).last ?? c.last;
  const d = `<span class="digits num"><span>••••</span>${esc(last || '····')}</span>`;
  const kind = c.t === 'cred' ? 'crédito' : 'débito';
  const b = bal != null ? `<span class="bal">${c.t === 'cred' ? 'Por pagar' : 'Saldo'}<b class="num">${mxn0.format(c.t === 'cred' ? Math.max(0, -bal) : bal)}</b></span>` : '';
  if (c.face === 'bbva') return `<div class="cc cc-bbva">${PEAK('rgba(140,180,255,.35)')}<span class="brandmark">BBVA</span><span class="kind">${kind}</span>${b}${d}<span class="visa">VISA</span></div>`;
  if (c.face === 'bbvaa') return `<div class="cc cc-bbvaa">${PEAK('rgba(255,255,255,.45)')}<span class="brandmark">BBVA</span><span class="kind">${kind}</span>${b}${d}</div>`;
  if (c.face === 'nu') return `<div class="cc cc-nu"><span class="brandmark">nu</span><span class="kind">${kind} ${NFC}</span>${b}${d}${MC}</div>`;
  return `<div class="cc cc-mp"><span class="words">MER<br>CADO<br>PAGO</span><span class="chipx"></span><span class="kind nfc">${NFC}</span><span class="wal">Wallet</span><span class="kind">debit</span>${b}${MC}</div>`;
}
const mini = (id) => `<i class="mini" style="background:${cardById(id)?.mini || OTHER_ACC[id]?.mini || '#9FA4AE'}"></i>`;

function renderInicio(all) {
  const mes = all.filter((i) => sameMonth(i.d, state.month));
  const libre = cardBalance('mp-debito', all);
  const potNames = Object.keys(pots());
  const apartado = sum(potNames, (n) => potBalance(n, all));
  $('#hero').innerHTML = `
    <button class="hero-main press" data-gocard="mp-debito"><small>Libre en Mercado Pago</small><b class="num">${mxn0.format(libre)}</b></button>
    ${potNames.length ? `<button class="hero-side press" data-tab="apartados"><small>Apartado</small><b class="num">${mxn0.format(apartado)}</b></button>` : ''}`;

  $('#wallet').innerHTML = CARDS.map((c) => {
    const b = cardBalance(c.id, all);
    const lab = c.t === 'cred' ? 'Debes' : 'Saldo', v = c.t === 'cred' ? Math.max(0, -b) : b;
    return `<button class="wcard press" data-gocard="${c.id}">${cardFace(c)}<span class="wl"><small>${lab}</small><b class="num ${c.t === 'cred' && v > 0 ? 'neg' : ''}">${mxn0.format(v)}</b></span></button>`;
  }).join('');

  const gastos = sum(mes.filter((i) => i.tipo === 'gasto'));
  const ingresos = sum(mes.filter((i) => i.tipo === 'ingreso'));
  $('#k-gastos').textContent = mxn.format(gastos);
  $('#k-ingresos').textContent = mxn.format(ingresos);
  $('#k-balance').textContent = mxn.format(ingresos - gastos);
  $('#k-balance').className = `num ${ingresos - gastos < 0 ? 'neg' : 'pos'}`;

  const q = norm(state.q);
  let lista = state.filter === 'todos' ? mes : mes.filter((i) => i.tipo === state.filter);
  if (q) lista = all.filter((i) => norm(`${i.concepto} ${i.categoria} ${accName(i.cuenta)}`).includes(q));
  lista.sort((a, b) => b.d - a.d);
  const total = lista.length;
  if (!state.showAll && !q) lista = lista.slice(0, 15);
  $('#list').innerHTML = txList(lista) + (total > lista.length ? `<li class="more"><button class="pill press" data-more>Ver ${total - lista.length} más</button></li>` : '');
}

function txRow(i) {
  const c = cat(i.categoria);
  const mv = i.tipo === 'movimiento';
  const sign = i.tipo === 'gasto' ? '−' : i.tipo === 'ingreso' ? '+' : '';
  const retiro = mv && String(i.destino).startsWith('apartado-:');
  const [de, a] = retiro ? [i.destino, i.cuenta] : [i.cuenta, i.destino];
  const sub = mv
    ? `${cardById(de) ? mini(de) : ''}${esc(accName(de) || '—')} → ${esc(accName(a) || '—')}`
    : `${i.cuenta ? mini(i.cuenta) : ''}${esc(i.categoria)}${i.cuenta ? ` · ${esc(accName(i.cuenta))}` : ''}`;
  return `<li style="--c:${c.c}"><button class="tx press" ${i.id ? `data-edit="${esc(i.id)}"` : 'disabled'}>
    <span class="dot">${svg(c.ic)}</span>
    <span class="body"><span class="title">${esc(i.concepto || i.texto || 'Sin concepto')}</span><span class="meta">${sub}</span></span>
    <span class="right"><b class="num ${i.tipo === 'gasto' ? 'neg' : i.tipo === 'ingreso' ? 'pos' : ''}">${sign}${mxn.format(i.monto)}</b><small>${dayFmt.format(i.d)}</small></span>
  </button></li>`;
}
const txList = (l) => (l.length ? l.map(txRow).join('') : '<li class="empty">Nada por aquí todavía.</li>');

function renderTarjetas(all) {
  $('#bigwallet').innerHTML = CARDS.map((c) => `<button class="bw press ${c.id === state.card ? 'sel' : ''}" data-card="${c.id}">${cardFace(c, cardBalance(c.id, all))}</button>`).join('');
  const c = cardById(state.card), conf = cardConf(c.id);
  const bal = cardBalance(c.id, all);
  const mes = all.filter((i) => sameMonth(i.d, state.month) && (i.cuenta === c.id || i.destino === c.id));
  const gastado = sum(mes.filter((i) => i.tipo === 'gasto' && i.cuenta === c.id));
  const entro = sum(mes.filter((i) => (i.tipo === 'ingreso' && i.cuenta === c.id) || (i.tipo === 'movimiento' && i.destino === c.id)));
  const last = conf.last ?? c.last;
  $('#card-detail').innerHTML = `
    <div class="ch"><div><div class="ey">${c.t === 'cred' ? 'Crédito' : 'Débito'}${last ? ` · ••${esc(last)}` : ''}</div><h2>${esc(c.n)}</h2></div>
      <button class="pill press" data-editcard="${c.id}">${svg('<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/>')}Editar</button></div>
    <div class="stats">
      <div><small>${c.t === 'cred' ? 'Por pagar' : 'Saldo'}</small><b class="num ${c.t === 'cred' && bal < 0 ? 'neg' : ''}">${mxn.format(c.t === 'cred' ? Math.max(0, -bal) : bal)}</b></div>
      <div><small>Gastado en ${monthFmt.format(state.month)}</small><b class="num">${mxn.format(gastado)}</b></div>
      <div><small>${c.t === 'cred' ? 'Pagos' : 'Entró'}</small><b class="num pos">${mxn.format(entro)}</b></div>
    </div>
    <p class="hint">Saldo confirmado el ${dayFmt.format(new Date(`${conf.fecha}T12:00`))} + movimientos posteriores.</p>
    <ul class="list">${txList(mes.sort((a, b) => b.d - a.d))}</ul>`;
}

function renderApartados(all) {
  const names = Object.keys(pots()).sort((a, b) => potBalance(b, all) - potBalance(a, all));
  const bals = names.map((n) => potBalance(n, all));
  const total = sum(bals, (v) => v), libre = cardBalance('mp-debito', all);
  const mes = all.filter((i) => sameMonth(i.d, state.month) && i.tipo === 'movimiento' && String(i.destino).startsWith('apartado'));
  $('#pots-head').innerHTML = `
    <div class="ey">Mercado Pago</div><h2 class="big num">${mxn.format(total)}</h2><small class="muted">en ${names.length} ${names.length === 1 ? 'apartado' : 'apartados'}</small>
    ${total > 0 ? `<div class="stack">${names.map((n, i) => (bals[i] > 0 ? `<i style="width:${(bals[i] / total) * 100}%;background:${potColor(n, i)}"></i>` : '')).join('')}</div>` : ''}
    <div class="foot"><span>Apartados + libre en Mercado Pago</span><b class="num">${mxn.format(total + libre)}</b></div>`;
  $('#pots').innerHTML = names.length ? names.map((n, i) => {
    const dep = sum(mes.filter((x) => x.destino === `apartado+:${n}`)), wd = sum(mes.filter((x) => x.destino === `apartado-:${n}`));
    return `<li><button class="pot press" data-editpot="${esc(n)}" style="--c:${potColor(n, i)}">
      <span class="pdot"></span><span class="body"><span class="title">${esc(n)}</span>
      <span class="meta">${dep || wd ? `${monthFmt.format(state.month)}: +${mxn0.format(dep)} · −${mxn0.format(wd)}` : 'Sin movimientos este mes'}</span></span>
      <b class="num">${mxn.format(bals[i])}</b></button></li>`;
  }).join('') : '<li class="empty">Aún no tienes apartados. Agrégalos a mano o importa tu estado de cuenta de Mercado Pago y se crean solos.</li>';
}

function renderAnalisis(all) {
  const ref = sameMonth(new Date(), state.month) ? new Date() : new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0);
  const gastos = all.filter((i) => i.tipo === 'gasto');
  const hoy0 = startOfDay(ref);
  const rango = (a, b) => sum(gastos.filter((i) => i.d >= a && i.d < b));
  const pct = (a, b) => (b ? ((a - b) / b) * 100 : null);
  const hoy = rango(hoy0, new Date(+hoy0 + DAY)), ayer = rango(new Date(+hoy0 - DAY), hoy0);
  const sem = rango(new Date(+hoy0 - 6 * DAY), new Date(+hoy0 + DAY)), semAnt = rango(new Date(+hoy0 - 13 * DAY), new Date(+hoy0 - 6 * DAY));
  const mIni = new Date(ref.getFullYear(), ref.getMonth(), 1), pIni = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const pFin = new Date(pIni.getFullYear(), pIni.getMonth(), Math.min(ref.getDate(), new Date(ref.getFullYear(), ref.getMonth(), 0).getDate()) + 1);
  const mes = rango(mIni, new Date(+hoy0 + DAY)), mesAnt = rango(pIni, pFin);
  const chg = (v) => (v == null || !isFinite(v) ? '<span class="chg">—</span>' : `<span class="chg ${v <= 0 ? 'up' : 'down'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(0)}%</span>`);
  $('#budget-tiles').innerHTML = [['Hoy', hoy, pct(hoy, ayer), 'vs ayer'], ['7 días', sem, pct(sem, semAnt), 'vs semana pasada'], ['Mes', mes, pct(mes, mesAnt), 'vs mes pasado al día']]
    .map(([l, v, p, t]) => `<div class="tile"><small>${l}</small><b class="num">${mxn0.format(v)}</b>${chg(p)}<small class="muted">${t}</small></div>`).join('');

  // Categorías del mes vs mes pasado
  const delMes = gastos.filter((i) => sameMonth(i.d, state.month));
  const prev = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
  const delPrev = gastos.filter((i) => sameMonth(i.d, prev));
  const tot = sum(delMes);
  const porCat = {};
  delMes.forEach((i) => (porCat[i.categoria] = (porCat[i.categoria] || 0) + i.monto));
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  $('#cats').innerHTML = cats.length ? cats.map(([c, v]) => {
    const p = sum(delPrev.filter((i) => i.categoria === c)), d = pct(v, p);
    return `<li style="--c:${cat(c).c}"><span class="dot">${svg(cat(c).ic)}</span>
      <span class="body"><span class="title">${esc(c)}</span><span class="meta">${Math.round((v / tot) * 100)}% del mes</span>
      <span class="track"><span class="fill" style="width:${(v / cats[0][1]) * 100}%"></span></span></span>
      <span class="right"><b class="num">${mxn0.format(v)}</b><small class="${d > 0 ? 'neg' : 'pos'}">${d == null ? 'nuevo' : Math.abs(d) < 0.5 ? 'igual que el mes pasado' : `${d > 0 ? '+' : ''}${d.toFixed(0)}% vs mes pasado`}</small></span></li>`;
  }).join('') : '<li class="empty">Sin gastos este mes.</li>';

  // Gasto diario
  const y = state.month.getFullYear(), m = state.month.getMonth();
  const dias = new Date(y, m + 1, 0).getDate(), now = new Date();
  const esMesActual = sameMonth(now, state.month);
  const porDia = Array(dias).fill(0);
  delMes.forEach((i) => (porDia[i.d.getDate() - 1] += i.monto));
  const maxDia = Math.max(...porDia, 1);
  $('#chart').innerHTML = porDia.map((v, i) => `<div class="b${v ? ' has' : ''}${esMesActual && i + 1 === now.getDate() ? ' today' : ''}" style="height:${(v / maxDia) * 100}%" title="${i + 1}: ${mxn.format(v)}"></div>`).join('');
  $('#chart-axis').innerHTML = [1, Math.ceil(dias / 2), dias].map((d) => `<span>${d}</span>`).join('');
  $('#daily-max').textContent = tot ? `promedio ${mxn0.format(tot / (esMesActual ? now.getDate() : dias))}/día` : '';

  // Ingresos / gastos últimos 6 meses
  const meses = [...Array(6)].map((_, k) => new Date(y, m - 5 + k, 1));
  const serie = meses.map((d) => ({ d, i: sum(all.filter((x) => x.tipo === 'ingreso' && sameMonth(x.d, d))), g: sum(all.filter((x) => x.tipo === 'gasto' && sameMonth(x.d, d))) }));
  const mx = Math.max(1, ...serie.flatMap((s) => [s.i, s.g]));
  $('#six').innerHTML = serie.map((s) => `<div class="col" title="${monthFmt.format(s.d)}: +${mxn0.format(s.i)} / −${mxn0.format(s.g)}">
    <div class="bars"><i class="in" style="height:${(s.i / mx) * 100}%"></i><i class="out" style="height:${(s.g / mx) * 100}%"></i></div><small>${mShort.format(s.d).replace('.', '')}</small></div>`).join('');
  const net = serie[5].i - serie[5].g;
  $('#six-net').innerHTML = `Neto de ${monthFmt.format(state.month)} <b class="num ${net < 0 ? 'neg' : 'pos'}">${mxn0.format(net)}</b>`;

  // Regla 50/30/20 (últimos 3 meses)
  const tres = all.filter((i) => i.d >= new Date(y, m - 2, 1) && i.d < new Date(y, m + 1, 1));
  const ing = sum(tres.filter((i) => i.tipo === 'ingreso'));
  const need = sum(tres.filter((i) => i.tipo === 'gasto' && cat(i.categoria).k === 'need'));
  const want = sum(tres.filter((i) => i.tipo === 'gasto' && cat(i.categoria).k !== 'need'));
  const base = ing || need + want || 1;
  const parts = [['Necesidades', need / base, 50, '#4DA3FF'], ['Gustos', want / base, 30, '#E879F9'], ['Ahorro', Math.max(0, (ing - need - want) / base), 20, '#3DD68C']];
  $('#rule').innerHTML = `<div class="stack">${parts.map(([, v, , c]) => `<i style="width:${Math.min(100, v * 100)}%;background:${c}"></i>`).join('')}</div>
    <div class="rule-legend">${parts.map(([n, v, goal, c]) => `<div><span><i style="background:${c}"></i>${n}</span><b class="num">${Math.round(v * 100)}%</b><small class="muted">meta ${goal}%</small></div>`).join('')}</div>
    <p class="hint">${!ing ? 'Aún no hay ingresos registrados en estos 3 meses.' : parts[2][1] >= 0.2 ? 'Vas bien con tu ahorro.' : 'Estás ahorrando menos del 20% de lo que entra.'}</p>`;
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function banner(msg) { const b = $('#banner'); b.textContent = msg; b.hidden = !msg; }
let tt;
function toast(t, ms = 2200) { const e = $('#toast'); e.textContent = t; e.classList.toggle('on', !!t); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('on'), ms); }

// ---------- Eventos ----------

$('#prev').onclick = () => { state.month.setMonth(state.month.getMonth() - 1); render(); };
$('#next').onclick = () => { state.month.setMonth(state.month.getMonth() + 1); render(); };
$('#refresh').onclick = refresh;
$('#search').oninput = (e) => { state.q = e.target.value; render(); };

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab],[data-gocard],[data-card],[data-edit],[data-editcard],[data-editpot],[data-more],[data-f]');
  if (!t) return;
  const d = t.dataset;
  if (d.tab) { state.tab = d.tab; save(TAB_KEY, d.tab); window.scrollTo({ top: 0 }); render(); }
  else if (d.gocard) { state.card = d.gocard; state.tab = 'tarjetas'; save(TAB_KEY, 'tarjetas'); window.scrollTo({ top: 0 }); render(); }
  else if (d.card) { state.card = d.card; render(); }
  else if (d.edit) openTx(state.items.find((i) => i.id === d.edit));
  else if (d.editcard) openCard(d.editcard);
  else if (d.editpot !== undefined) openPot(d.editpot);
  else if (d.more !== undefined) { state.showAll = true; render(); }
  else if (d.f) { state.filter = d.f; $$('[data-f]').forEach((x) => x.classList.toggle('on', x === t)); render(); }
});

/* --- Movimiento: agregar / editar --- */
function fillSelects() {
  const f = $('#tx-form');
  f.categoria.innerHTML = Object.keys(CATS).map((c) => `<option>${c}</option>`).join('');
  const accOpts = CARDS.map((c) => `<option value="${c.id}">${c.n} (${c.t === 'cred' ? 'crédito' : 'débito'})</option>`).join('');
  f.cuenta.innerHTML = '<option value="">Efectivo / sin tarjeta</option>' + accOpts;
  f.destino.innerHTML = accOpts + '<option value="efectivo">Efectivo</option>' +
    Object.keys(pots()).map((n) => `<option value="apartado+:${esc(n)}">A apartado: ${esc(n)}</option><option value="apartado-:${esc(n)}">Sacar de apartado: ${esc(n)}</option>`).join('');
}
function syncTipo() {
  const f = $('#tx-form');
  $('#dest-field').hidden = f.tipo.value !== 'movimiento';
  $('#cat-field').hidden = f.tipo.value === 'movimiento';
}
$('#tx-form').addEventListener('change', (e) => { if (e.target.name === 'tipo') syncTipo(); });

function openTx(tx) {
  fillSelects();
  const f = $('#tx-form');
  f.reset();
  f.dataset.id = tx?.id || '';
  $('#tx-title').textContent = tx ? 'Editar movimiento' : 'Nuevo movimiento';
  $('#tx-del').hidden = !tx;
  f.tipo.value = tx?.tipo || 'gasto';
  f.monto.value = tx ? tx.monto : '';
  f.concepto.value = tx?.concepto || '';
  f.categoria.value = tx ? catName(tx.categoria) : 'Otros';
  f.cuenta.value = tx?.cuenta || (state.tab === 'tarjetas' ? state.card : '');
  if (tx?.destino && ![...f.destino.options].some((o) => o.value === tx.destino)) f.destino.insertAdjacentHTML('beforeend', `<option value="${esc(tx.destino)}">${esc(accName(tx.destino) || tx.destino)}</option>`);
  f.destino.value = tx?.destino || 'mp-debito';
  f.fecha.value = ymd(tx ? new Date(tx.fecha) : new Date());
  $('#tx-raw').textContent = tx?.texto ? `Notificación: “${tx.texto}”` : tx?.origen ? `Origen: ${tx.origen}` : '';
  syncTipo();
  $('#tx-dlg').showModal();
}
$('#open-add').onclick = () => openTx(null);
$('#open-add-top').onclick = () => openTx(null);
$('#tx-del').onclick = async () => {
  const id = $('#tx-form').dataset.id;
  if (!id || !confirm('¿Borrar este movimiento?')) return;
  $('#tx-dlg').close();
  const res = await api({ action: 'delete', id });
  if (res.ok) { state.items = state.items.filter((i) => i.id !== id); save(CACHE_KEY, state.items); render(); toast('Borrado'); }
  else toast(res.error);
};
$('#tx-dlg').addEventListener('close', async () => {
  if ($('#tx-dlg').returnValue !== 'ok') return;
  const f = $('#tx-form');
  const data = Object.fromEntries(new FormData(f));
  const orig = state.items.find((i) => i.id === f.dataset.id);
  const keepTime = orig && ymd(new Date(orig.fecha)) === data.fecha;
  data.fecha = keepTime ? orig.fecha : new Date(`${data.fecha}T12:00:00`).toISOString();
  if (data.tipo === 'movimiento') data.categoria = String(data.destino).startsWith('apartado') ? 'Apartados' : 'Transferencias';
  else data.destino = '';
  data.monto = Number(String(data.monto).replace(/[^\d.]/g, ''));
  const res = await api(f.dataset.id ? { action: 'update', id: f.dataset.id, ...data } : { action: 'add', ...data });
  if (!res.ok) return toast(res.error || 'Error');
  state.items = state.items.filter((i) => i.id !== res.movimiento.id).concat(res.movimiento);
  save(CACHE_KEY, state.items);
  render();
  toast('Guardado');
});

/* --- Tarjeta: editar saldo --- */
function openCard(id) {
  const c = cardById(id), conf = cardConf(id), f = $('#card-form');
  f.dataset.id = id;
  $('#card-title').textContent = `Editar ${c.n}`;
  $('#card-saldo-label').textContent = c.t === 'cred' ? 'Lo que debes hoy' : 'Saldo de hoy';
  const now = cardBalance(id);
  f.saldo.value = (c.t === 'cred' ? Math.max(0, -now) : now).toFixed(2);
  f.last.value = conf.last ?? c.last ?? '';
  $('#card-dlg').showModal();
}
$('#card-dlg').addEventListener('close', () => {
  if ($('#card-dlg').returnValue !== 'ok') return;
  const f = $('#card-form'), id = f.dataset.id, c = cardById(id);
  const v = Number(String(f.saldo.value).replace(/[^\d.-]/g, '')) || 0;
  // Se guarda el saldo de HOY: los movimientos de hoy ya están incluidos, cuentan solo los posteriores.
  saveConf({ cards: { ...(state.conf.cards || {}), [id]: { saldo: c.t === 'cred' ? -Math.abs(v) : v, fecha: ymd(new Date()), last: f.last.value.trim() } } });
  toast('Saldo actualizado');
});

/* --- Apartado: agregar / editar --- */
function openPot(name) {
  const f = $('#pot-form');
  f.dataset.name = name || '';
  $('#pot-title').textContent = name ? 'Editar apartado' : 'Nuevo apartado';
  $('#pot-del').hidden = !name;
  f.nombre.value = name || '';
  f.saldo.value = name ? potBalance(name).toFixed(2) : '';
  f.color.value = (name && pots()[name]?.c) || POTC[Object.keys(pots()).length % POTC.length];
  $('#pot-dlg').showModal();
}
$('#add-pot').onclick = () => openPot('');
$('#pot-del').onclick = () => {
  const name = $('#pot-form').dataset.name;
  if (!confirm(`¿Quitar el apartado “${name}”? (Los movimientos se quedan)`)) return;
  const p = { ...pots() }; delete p[name];
  $('#pot-dlg').close(); saveConf({ pots: p });
};
$('#pot-dlg').addEventListener('close', () => {
  if ($('#pot-dlg').returnValue !== 'ok') return;
  const f = $('#pot-form'), old = f.dataset.name, name = f.nombre.value.trim();
  if (!name) return;
  const p = { ...pots() };
  if (old && old !== name) delete p[old];
  p[name] = { saldo: Number(String(f.saldo.value).replace(/[^\d.-]/g, '')) || 0, fecha: ymd(new Date()), c: f.color.value };
  saveConf({ pots: p });
});

/* --- Importar estados de cuenta --- */
let pending = null;
$$('[data-import]').forEach((b) => (b.onclick = () => $('#file').click()));
$('#file').onchange = async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length) return;
  toast('Leyendo…', 20000);
  try {
    const { leerArchivo } = await import('./importers.js');
    const res = [];
    for (const f of files) res.push({ name: f.name, ...(await leerArchivo(f)) });
    pending = res;
    $('#imp-body').innerHTML = res.map((r) => {
      const g = r.rows.filter((x) => x.tipo === 'gasto'), i = r.rows.filter((x) => x.tipo === 'ingreso'), mv = r.rows.filter((x) => x.tipo === 'movimiento');
      return `<div class="imp-file"><b>${esc(r.banco)}</b> <small class="muted">${esc(r.name)}</small>
        <p>${r.periodo.de ? `${dayFmt.format(new Date(r.periodo.de))} – ${dayFmt.format(new Date(r.periodo.a))} · ` : ''}${r.rows.length} movimientos</p>
        <p class="muted">${g.length} gastos (${mxn0.format(sum(g))}) · ${i.length} ingresos (${mxn0.format(sum(i))}) · ${mv.length} entre tus cuentas o apartados</p>
        ${r.saldoFinal != null ? `<p class="muted">Saldo final ${mxn.format(r.saldoFinal)} → se usará como saldo de ${esc(accName(r.cuenta))}</p>` : ''}
        ${r.aviso ? `<p class="neg">${esc(r.aviso)}</p>` : ''}
        <ul class="list mini-list">${r.rows.slice(-5).reverse().map((x) => txRow({ ...x, id: '', d: new Date(x.fecha) })).join('')}</ul></div>`;
    }).join('') + '<p class="hint">Lo que ya tengas registrado (por notificación o importado antes) no se duplica.</p>';
    toast('', 1);
    $('#imp-dlg').showModal();
  } catch (err) {
    toast(`No se pudo leer: ${err.message}`, 5000);
  }
};
$('#imp-dlg').addEventListener('close', async () => {
  if ($('#imp-dlg').returnValue !== 'ok' || !pending) return;
  const res = pending; pending = null;
  toast('Importando…', 120000);
  let agregados = 0, duplicados = 0;
  try {
    const rows = res.flatMap((r) => r.rows);
    for (let k = 0; k < rows.length; k += 400) {
      const r = await api({ action: 'import', rows: rows.slice(k, k + 400) });
      if (!r.ok) throw new Error(r.error);
      agregados += r.agregados; duplicados += r.duplicados;
      state.items = state.items.concat(r.movimientos);
    }
    save(CACHE_KEY, state.items);
    // Saldos finales del estado de cuenta + apartados nuevos
    const cards = { ...(state.conf.cards || {}) }, p = { ...pots() };
    let ci = Object.keys(p).length;
    for (const r of res) {
      if (r.saldoFinal != null && r.fechaSaldo) cards[r.cuenta] = { ...(cards[r.cuenta] || {}), saldo: r.saldoFinal, fecha: ymd(new Date(r.fechaSaldo)) };
      for (const x of r.rows) {
        const n = String(x.destino || '').startsWith('apartado') && potOf(x.destino);
        if (n && !p[n]) p[n] = { saldo: 0, fecha: '2000-01-01', c: POTC[ci++ % POTC.length] };
      }
    }
    await saveConf({ cards, pots: p });
    toast(`Listo: ${agregados} nuevos, ${duplicados} ya estaban`, 4000);
  } catch (err) {
    toast(`Error al importar: ${err.message}`, 5000);
  }
  render();
});

/* --- Ajustes --- */
$('#open-settings').onclick = () => {
  $('#settings-form').url.value = state.cfg.url || '';
  $('#settings-form').token.value = state.cfg.token || '';
  pushStatus();
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
  state.items = []; state.conf = {};
  refresh();
});

/* --- Notificaciones push --- */
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
async function pushStatus() {
  const el = $('#push-status'), btn = $('#push-btn');
  btn.hidden = false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    el.textContent = /iPhone|iPad/.test(navigator.userAgent) && !standalone()
      ? 'En iPhone primero agrega la app a tu pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí.'
      : 'Este navegador no soporta notificaciones push.';
    btn.hidden = true;
    return;
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  el.textContent = sub && Notification.permission === 'granted' ? 'Activadas en este dispositivo ✓'
    : Notification.permission === 'denied' ? 'Bloqueadas. Actívalas en Ajustes del iPhone → Notificaciones → Gastos.'
    : 'Recibe un aviso de la app cada vez que entra un movimiento.';
  btn.textContent = sub ? 'Enviar prueba' : 'Activar notificaciones';
}
$('#push-btn').onclick = async () => {
  if (isDemo()) return toast('Primero conecta tu backend');
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      if ((await Notification.requestPermission()) !== 'granted') return pushStatus();
      const key = Uint8Array.from(atob(VAPID_PUBLIC.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    }
    const r = await api({ action: 'subscribe', sub: sub.toJSON() });
    if (!r.ok) throw new Error(r.error);
    const t = await api({ action: 'testpush' });
    toast(t.ok ? 'Te mandé una notificación de prueba' : `Suscrito, pero la prueba falló: ${t.error || (t.errores || []).join(', ')}`, 5000);
  } catch (err) {
    toast(`No se pudo: ${err.message}`, 5000);
  }
  pushStatus();
};

/* --- Privacidad y tema --- */
const EYE = svg('<path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"/><circle cx="12" cy="12" r="3"/>');
const EYE_OFF = svg('<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.9 3.7M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 19 12 19c1.6 0 3-.4 4.3-1"/>');
let priv = !!load(PRIV_KEY);
function applyPriv() { document.body.classList.toggle('priv', priv); $('#priv').innerHTML = priv ? EYE_OFF : EYE; }
applyPriv();
$('#priv').onclick = () => { priv = !priv; save(PRIV_KEY, priv); applyPriv(); };

const THEME_KEY = 'dbsh.theme';
const TICONS = {
  auto: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>'),
  light: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  dark: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
};
function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  $('#theme').innerHTML = TICONS[t] || TICONS.auto;
}
let theme = (() => { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; } })();
applyTheme(theme);
$('#theme').onclick = () => {
  theme = { auto: 'light', light: 'dark', dark: 'auto' }[theme] || 'auto';
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
  applyTheme(theme);
};

// ---------- Demo ----------

let demoData = null, demoConf = {};
function demoApi(body) {
  if (!demoData) {
    const now = new Date();
    const d = (dd, h = 13, mo = 0) => new Date(now.getFullYear(), now.getMonth() - mo, mo ? dd : Math.min(dd, now.getDate()), h).toISOString();
    const rows = [];
    for (let mo = 5; mo >= 0; mo--) {
      rows.push(['ingreso', 16500, 'Nómina', 'Ingresos', d(1, 9, mo), 'bbva-debito'], ['ingreso', 16500, 'Nómina', 'Ingresos', d(15, 9, mo), 'bbva-debito'],
        ['gasto', 7500, 'Renta', 'Casa', d(1, 10, mo), 'bbva-debito'], ['gasto', 219, 'Netflix', 'Suscripciones', d(12, 9, mo), 'nu-credito'],
        ['gasto', 900 + mo * 70, 'Walmart', 'Super', d(6, 18, mo), 'bbva-credito'], ['gasto', 760, 'Gasolina Jetta', 'Auto', d(9, 8, mo), 'bbva-credito'],
        ['gasto', 180 + mo * 20, 'Tacos', 'Comida', d(3, 21, mo), 'mp-debito'], ['gasto', 420 + mo * 15, 'CFE', 'Casa', d(5, 12, mo), 'bbva-debito'],
        ['gasto', 650, 'Salida con amigos', 'Ocio', d(10, 22, mo), 'nu-credito'], ['movimiento', 1500, 'A Mercado Pago', 'Transferencias', d(2, 11, mo), 'bbva-debito', 'mp-debito'],
        ['movimiento', 500, 'A Viaje', 'Apartados', d(2, 12, mo), 'mp-debito', 'apartado+:Viaje']);
    }
    rows.push(['gasto', 249, 'OXXO', 'Super', d(11, 14), 'mp-debito'], ['gasto', 165, 'Starbucks', 'Comida', d(12, 8), 'mp-debito'], ['gasto', 389, 'Amazon', 'Compras', d(8), 'nu-credito']);
    demoData = rows.map(([tipo, monto, concepto, categoria, fecha, cuenta, destino = ''], i) => ({ id: `demo${i}`, tipo, monto, concepto, categoria, fecha, cuenta, destino, origen: 'Demo', texto: '' }));
    demoConf = { pots: { Viaje: { saldo: 4000, fecha: '2000-01-01', c: '#4DA3FF' }, Emergencias: { saldo: 12000, fecha: '2000-01-01', c: '#3DD68C' } } };
  }
  if (!body) return { ok: true, movimientos: demoData, config: demoConf };
  const a = body.action;
  if (a === 'delete') { demoData = demoData.filter((i) => i.id !== body.id); return { ok: true }; }
  if (a === 'config') { Object.assign(demoConf, body.config); return { ok: true, config: demoConf }; }
  if (a === 'add' || a === 'update') {
    const { action, token, ...rest } = body;
    const mov = { ...(demoData.find((i) => i.id === body.id) || { id: `demo${Date.now()}`, origen: 'Manual', texto: '' }), ...rest };
    demoData = demoData.filter((i) => i.id !== mov.id).concat(mov);
    return { ok: true, movimiento: mov };
  }
  if (a === 'import') {
    const movs = body.rows.map((r, i) => ({ ...r, id: `imp${Date.now()}${i}` }));
    demoData = demoData.concat(movs);
    return { ok: true, agregados: movs.length, duplicados: 0, movimientos: movs };
  }
  return { ok: false, error: 'no disponible en modo demo' };
}

// ---------- Arranque ----------

// Sin zoom: se siente como app nativa.
['gesturestart', 'gesturechange'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouch < 300 && !e.target.closest('input, select, textarea')) e.preventDefault();
  lastTouch = now;
}, { passive: false });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data === 'refresh') refresh(); });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
const qtab = new URLSearchParams(location.search).get('tab');
if (qtab) state.tab = qtab;
render();
refresh();

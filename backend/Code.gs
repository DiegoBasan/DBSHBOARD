/**
 * DBSHBOARD — backend en Google Apps Script + Google Sheets.
 *
 * Una sola URL de "Web App":
 *   GET   ?token=...                                   -> { movimientos, config }
 *   POST  { token, texto | titulo + cuerpo, app?, cuenta? }      -> notificación (Atajos)
 *   POST  { token, action:"add", tipo, monto, concepto, categoria, cuenta?, destino?, fecha? }
 *   POST  { token, action:"update", id, ...campos }    -> corrige un movimiento
 *   POST  { token, action:"delete", id }
 *   POST  { token, action:"import", rows:[...] }       -> estados de cuenta (sin duplicados)
 *   POST  { token, action:"config", config:{...} }     -> saldos de tarjetas, apartados…
 *   POST  { token, action:"subscribe", sub }           -> notificaciones push de este dispositivo
 *
 * tipo: "gasto" | "ingreso" | "movimiento" (entre tus cuentas o apartados; no cuenta como gasto)
 *
 * Propiedades del script (Project Settings → Script Properties):
 *   TOKEN (obligatoria) · PUSH_URL + PUSH_SECRET (push vía Netlify) · NTFY_TOPIC + DASHBOARD_URL (opcional)
 */

const SHEET_NAME = 'Movimientos';
const HEADERS = ['id', 'fecha', 'tipo', 'monto', 'concepto', 'categoria', 'origen', 'texto', 'cuenta', 'destino', 'ref'];

// Tarjetas válidas (deben coincidir con CARDS en app.js).
const CUENTAS = ['mp-debito', 'bbva-credito', 'nu-credito', 'bbva-debito'];

// Palabras clave -> categoría (minúsculas, sin acentos). Edítalas a tu gusto.
const CATEGORIAS = {
  'Comida': ['starbucks', 'restaurante', 'taco', 'rappi', 'uber eats', 'didi food', 'mcdonald', 'burger', 'pizza', 'cafe', 'comida', 'kfc', 'carls', 'domino', 'sushi', 'subway', 'wings', 'torta'],
  'Super': ['oxxo', 'seven', '7-eleven', 'walmart', 'soriana', 'chedraui', 'costco', 'sams', 'heb', 'la comer', 'bodega aurrera', 'super'],
  'Auto': ['gasolina', 'pemex', 'shell', 'petro 7', 'petro7', 'oxxo gas', 'bp ', 'caseta', 'estacionamiento', 'autozone', 'llanta', 'jetta'],
  'Transporte': ['uber', 'didi', 'cabify', 'metro', 'taxi', 'lime'],
  'Casa': ['renta', 'cfe', 'telmex', 'izzi', 'totalplay', 'megacable', 'telcel', 'at&t', 'movistar', 'agua', 'gas lp', 'internet', 'recarga', 'predial'],
  'Suscripciones': ['netflix', 'spotify', 'disney', 'hbo', 'max', 'prime', 'apple', 'icloud', 'youtube', 'chatgpt', 'claude', 'xbox', 'playstation'],
  'Compras': ['amazon', 'mercado libre', 'mercadolibre', 'liverpool', 'shein', 'temu', 'coppel', 'tienda', 'home depot', 'steren', 'paypal'],
  'Salud': ['farmacia', 'similares', 'benavides', 'doctor', 'hospital', 'dentista', 'gym', 'gimnasio'],
  'Ocio': ['cine', 'cinepolis', 'cinemex', 'bar ', 'antro', 'concierto', 'boletos', 'ticket', 'boliche'],
  'Deudas': ['pago de tarjeta', 'pago tarjeta', 'mensualidad', 'credito', 'prestamo'],
};

const PALABRAS_INGRESO = ['recibiste', 'te envio', 'te enviaron', 'te transfirio', 'ingresaste', 'ingreso', 'ya esta disponible', 'acredit', 'reembolso', 'devolucion', 'cobraste', 'depositaron', 'depositaste', 'cashback'];

// ---------- HTTP ----------

function doGet(e) {
  if (!autorizado_(e.parameter.token)) return json_({ ok: false, error: 'token inválido' });
  return json_({ ok: true, movimientos: leerTodo_(), config: config_() });
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData && e.postData.contents || '{}');
  } catch (err) {
    body = e.parameter || {}; // Atajos a veces manda form-data
  }
  const token = body.token || (e.parameter && e.parameter.token);
  if (!autorizado_(token)) return json_({ ok: false, error: 'token inválido' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    switch (body.action) {
      case 'delete': return json_(borrar_(body.id));
      case 'add': return json_(agregarManual_(body));
      case 'update': return json_(actualizar_(body));
      case 'import': return json_(importar_(body.rows || []));
      case 'config': return json_({ ok: true, config: guardarConfig_(body.config || {}) });
      case 'subscribe': return json_(suscribir_(body.sub, body.quitar));
      case 'testpush': return json_(probarPush_());
      default: return json_(agregarNotificacion_(body));
    }
  } finally {
    lock.releaseLock();
  }
}

// ---------- Movimientos ----------

function agregarNotificacion_(body) {
  const texto = [body.titulo, body.cuerpo, body.texto].filter(Boolean).map(String).join(' · ').trim();
  if (!texto) return { ok: false, error: 'sin texto' };

  // Evita duplicados: la misma notificación en los últimos 5 minutos.
  const cache = CacheService.getScriptCache();
  const huella = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, texto));
  if (cache.get(huella)) return { ok: true, duplicado: true, mensaje: 'Duplicado, ya estaba registrado' };
  cache.put(huella, '1', 300);

  const p = parsear(texto);
  const cuenta = cuenta_(body);
  const fila = {
    id: Utilities.getUuid(),
    fecha: body.fecha ? new Date(body.fecha) : new Date(),
    tipo: p.tipo,
    monto: p.monto,
    concepto: p.concepto,
    categoria: p.categoria,
    origen: body.app || 'Mercado Pago',
    texto: texto,
    cuenta: p.desde || cuenta,
    destino: p.tipo === 'movimiento' ? (p.desde ? cuenta : p.hacia || '') : '',
    ref: '',
  };
  guardar_([fila]);
  const mensaje = resumen_(fila);
  avisar_(fila, mensaje);
  return { ok: true, mensaje: mensaje, movimiento: serializar_(fila) };
}

function agregarManual_(body) {
  const monto = Math.abs(Number(String(body.monto).replace(/[^\d.]/g, '')));
  if (!monto) return { ok: false, error: 'monto inválido' };
  const fila = {
    id: Utilities.getUuid(),
    fecha: body.fecha ? new Date(body.fecha) : new Date(),
    tipo: ['ingreso', 'movimiento'].indexOf(body.tipo) !== -1 ? body.tipo : 'gasto',
    monto: monto,
    concepto: String(body.concepto || '').slice(0, 120),
    categoria: String(body.categoria || 'Otros').slice(0, 40),
    origen: 'Manual',
    texto: '',
    cuenta: cuenta_(body),
    destino: String(body.destino || '').slice(0, 60),
    ref: '',
  };
  guardar_([fila]);
  return { ok: true, movimiento: serializar_(fila) };
}

const EDITABLES = ['fecha', 'tipo', 'monto', 'concepto', 'categoria', 'cuenta', 'destino'];

function actualizar_(body) {
  const hoja = hoja_();
  const fila = buscarFila_(hoja, body.id);
  if (!fila) return { ok: false, error: 'no encontrado' };
  const rango = hoja.getRange(fila, 1, 1, HEADERS.length);
  const vals = rango.getValues()[0];
  EDITABLES.forEach(function (k) {
    if (body[k] === undefined) return;
    let v = body[k];
    if (k === 'monto') v = Math.abs(Number(v)) || 0;
    if (k === 'fecha') v = new Date(v);
    vals[HEADERS.indexOf(k)] = v;
  });
  rango.setValues([vals]);
  const o = {};
  HEADERS.forEach(function (h, i) { o[h] = vals[i]; });
  return { ok: true, movimiento: serializar_(o) };
}

function borrar_(id) {
  const hoja = hoja_();
  const fila = buscarFila_(hoja, id);
  if (!fila) return { ok: false, error: 'no encontrado' };
  hoja.deleteRow(fila);
  return { ok: true };
}

function buscarFila_(hoja, id) {
  const n = hoja.getLastRow() - 1;
  if (n < 1) return 0;
  const ids = hoja.getRange(2, 1, n, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (ids[i][0] === id) return i + 2;
  return 0;
}

/**
 * Importa filas de un estado de cuenta (las arma el dashboard).
 * Se saltan las que ya estaban: misma ref, o un movimiento sin ref (notificación / manual)
 * de la misma cuenta, tipo y monto con ±1.5 días de diferencia.
 */
function importar_(rows) {
  const refs = {};
  const sinRef = [];
  const movs = []; // transferencias entre tus cuentas: aparecen en los dos estados de cuenta
  leerTodo_().forEach(function (m) {
    if (m.ref) refs[m.ref] = true;
    else sinRef.push({ cuenta: m.cuenta, tipo: m.tipo, monto: m.monto, t: new Date(m.fecha).getTime(), usado: false });
    if (m.tipo === 'movimiento') movs.push({ cuenta: m.cuenta, destino: m.destino, monto: m.monto, origen: m.origen, t: new Date(m.fecha).getTime(), usado: false });
  });
  const nuevas = [];
  let dup = 0;
  rows.forEach(function (r) {
    if (!r || !r.monto || !r.fecha) return;
    if (r.ref && refs[r.ref]) { dup++; return; }
    const t = new Date(r.fecha).getTime();
    const gemelo = sinRef.find(function (m) {
      return !m.usado && m.cuenta === r.cuenta && m.tipo === r.tipo && Math.abs(m.monto - r.monto) < 0.01 && Math.abs(m.t - t) <= 36 * 3600e3;
    });
    if (gemelo) { gemelo.usado = true; dup++; return; }
    if (r.tipo === 'movimiento') {
      const par = movs.find(function (m) {
        return !m.usado && m.origen !== r.origen && m.cuenta === r.cuenta && m.destino === r.destino && Math.abs(m.monto - r.monto) < 0.01 && Math.abs(m.t - t) <= 3 * 86400e3;
      });
      if (par) { par.usado = true; dup++; return; }
      movs.push({ cuenta: r.cuenta, destino: r.destino, monto: Number(r.monto), origen: r.origen, t: t, usado: false });
    }
    if (r.ref) refs[r.ref] = true;
    nuevas.push({
      id: Utilities.getUuid(),
      fecha: new Date(r.fecha),
      tipo: ['ingreso', 'movimiento'].indexOf(r.tipo) !== -1 ? r.tipo : 'gasto',
      monto: Math.abs(Number(r.monto)) || 0,
      concepto: String(r.concepto || '').slice(0, 120),
      categoria: String(r.categoria || 'Otros').slice(0, 40),
      origen: String(r.origen || 'Importado').slice(0, 40),
      texto: '',
      cuenta: CUENTAS.indexOf(r.cuenta) !== -1 ? r.cuenta : '',
      destino: String(r.destino || '').slice(0, 60),
      ref: String(r.ref || '').slice(0, 200),
    });
  });
  guardar_(nuevas);
  return { ok: true, agregados: nuevas.length, duplicados: dup, movimientos: nuevas.map(serializar_) };
}

/**
 * Convierte el texto de una notificación de Mercado Pago en {tipo, monto, concepto, categoria}.
 *   "Pagaste $249.00 a OXXO"                                     -> gasto
 *   "Recibiste $1,500 de Juan Pérez"                              -> ingreso
 *   "Ingresaste $ 5.00 desde tu cuenta de BBVA MEXICO."           -> movimiento BBVA débito → Mercado Pago
 */
function parsear(texto) {
  const t = normalizar_(texto);

  let monto = 0;
  const m = texto.match(/\$\s?([\d.,]+)/) || texto.match(/(?:MXN|mxn)\s?([\d.,]+)/);
  if (m) monto = aNumero_(m[1]);

  let tipo = PALABRAS_INGRESO.some(function (p) { return t.indexOf(p) !== -1; }) ? 'ingreso' : 'gasto';

  let concepto = '';
  const tras = m ? texto.slice(texto.indexOf(m[0]) + m[0].length) : texto;
  const c = tras.match(/\s(?:a|en|de|para|desde)\s+(.+?)(?:\s+(?:fue|ha sido|con|el|desde)\b|[.·\n]|$)/i);
  if (c) concepto = c[1].trim().replace(/^(?:tu|su) cuenta (?:de|en)\s+/i, '');
  if (!concepto) concepto = texto.slice(0, 60);

  // Dinero entre tus propias cuentas: no es ingreso ni gasto.
  let desde = '', hacia = '';
  if (/(desde|a|hacia) tu cuenta/.test(t)) {
    const banco = /\bnu\b/.test(t) ? 'nu-credito' : /bbva/.test(t) ? 'bbva-debito' : '';
    if (tipo === 'ingreso') { tipo = 'movimiento'; desde = banco; }
    else { tipo = 'movimiento'; hacia = banco; }
  }

  let categoria = tipo === 'ingreso' ? 'Ingresos' : tipo === 'movimiento' ? 'Transferencias' : 'Otros';
  if (tipo === 'gasto') {
    for (const cat in CATEGORIAS) {
      if (CATEGORIAS[cat].some(function (k) { return t.indexOf(k) !== -1; })) { categoria = cat; break; }
    }
  }
  return { tipo: tipo, monto: monto, concepto: concepto.slice(0, 120), categoria: categoria, desde: desde, hacia: hacia };
}

function cuenta_(body) {
  if (CUENTAS.indexOf(body.cuenta) !== -1) return body.cuenta;
  const app = normalizar_(body.app || '');
  if (app.indexOf('mercado') !== -1) return 'mp-debito';
  if (/^nu\b/.test(app)) return 'nu-credito';
  return '';
}

// ---------- Configuración (saldos de tarjetas, apartados) ----------

function config_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('CONFIG') || '{}'); }
  catch (e) { return {}; }
}

function guardarConfig_(parcial) {
  const c = config_();
  Object.keys(parcial).forEach(function (k) { c[k] = parcial[k]; });
  PropertiesService.getScriptProperties().setProperty('CONFIG', JSON.stringify(c));
  return c;
}

// ---------- Notificaciones ----------

/** "Gasto $249.00 · OXXO (Comida)\nNoviembre: gastos $1,234.00 · balance $5,678.00" */
function resumen_(f) {
  const ahora = f.fecha;
  let gastos = 0, ingresos = 0;
  leerTodo_().forEach(function (m) {
    const d = new Date(m.fecha);
    if (d.getFullYear() !== ahora.getFullYear() || d.getMonth() !== ahora.getMonth()) return;
    if (m.tipo === 'ingreso') ingresos += m.monto; else if (m.tipo === 'gasto') gastos += m.monto;
  });
  const mes = Utilities.formatDate(ahora, Session.getScriptTimeZone(), 'MMMM');
  const etiqueta = { gasto: 'Gasto ', ingreso: 'Ingreso ', movimiento: 'Movimiento ' }[f.tipo];
  return etiqueta + dinero_(f.monto) + ' · ' + f.concepto + ' (' + f.categoria + ')\n' +
    mes.charAt(0).toUpperCase() + mes.slice(1) + ': gastos ' + dinero_(gastos) + ' · balance ' + dinero_(ingresos - gastos);
}

function dinero_(n) {
  return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function avisar_(f, mensaje) {
  const props = PropertiesService.getScriptProperties();
  const titulo = (f.tipo === 'ingreso' ? '+' : f.tipo === 'gasto' ? '−' : '') + dinero_(f.monto) + ' ' + f.concepto;
  const cuerpo = mensaje.split('\n')[1] || mensaje;

  // 1) Push nativo a la app instalada (vía función de Netlify)
  enviarPush_(titulo, cuerpo);

  // 2) ntfy.sh (opcional)
  const topic = props.getProperty('NTFY_TOPIC');
  if (topic) {
    const headers = { Title: titulo, Tags: f.tipo === 'ingreso' ? 'chart_with_upwards_trend' : 'money_with_wings' };
    const url = props.getProperty('DASHBOARD_URL');
    if (url) headers.Click = url;
    try {
      UrlFetchApp.fetch('https://ntfy.sh/' + encodeURIComponent(topic), { method: 'post', payload: cuerpo, headers: headers, muteHttpExceptions: true });
    } catch (err) { /* el movimiento ya quedó guardado */ }
  }
}

function subs_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('SUBS') || '[]'); }
  catch (e) { return []; }
}

function suscribir_(sub, quitar) {
  if (!sub || !sub.endpoint) return { ok: false, error: 'suscripción inválida' };
  let subs = subs_().filter(function (s) { return s.endpoint !== sub.endpoint; });
  if (!quitar) subs.push(sub);
  subs = subs.slice(-10); // máximo 10 dispositivos
  PropertiesService.getScriptProperties().setProperty('SUBS', JSON.stringify(subs));
  return { ok: true, dispositivos: subs.length };
}

function enviarPush_(titulo, cuerpo) {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('PUSH_URL');
  const subs = subs_();
  if (!url || !subs.length) return { ok: false, error: !url ? 'falta PUSH_URL' : 'ningún dispositivo suscrito' };
  try {
    const r = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ secret: props.getProperty('PUSH_SECRET'), subs: subs, title: titulo, body: cuerpo, url: props.getProperty('DASHBOARD_URL') || '' }),
      muteHttpExceptions: true,
    });
    const res = JSON.parse(r.getContentText() || '{}');
    // Quita dispositivos que ya no existen (la app se borró, se revocó el permiso…)
    if (res.expirados && res.expirados.length) {
      PropertiesService.getScriptProperties().setProperty('SUBS', JSON.stringify(subs.filter(function (s) { return res.expirados.indexOf(s.endpoint) === -1; })));
    }
    return res;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function probarPush_() {
  return enviarPush_('DBSHBOARD', 'Notificaciones activadas ✓');
}

// ---------- Utilidades ----------

function aNumero_(s) {
  // "1,234.56" -> 1234.56 ; "1.234,56" -> 1234.56 ; "1,500" -> 1500
  s = String(s).replace(/[.,]$/, '');
  if (/,\d{2}$/.test(s) && s.indexOf('.') !== -1) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  return Number(s) || 0;
}

function normalizar_(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function autorizado_(token) {
  const real = PropertiesService.getScriptProperties().getProperty('TOKEN');
  return real && token && String(token) === real;
}

function hoja_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(SHEET_NAME);
  if (!hoja) {
    hoja = ss.insertSheet(SHEET_NAME);
    hoja.appendRow(HEADERS);
    hoja.setFrozenRows(1);
  } else if (hoja.getRange(1, HEADERS.length).getValue() !== HEADERS[HEADERS.length - 1]) {
    // Hoja creada con una versión anterior: agrega los encabezados nuevos.
    hoja.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return hoja;
}

function guardar_(filas) {
  if (!filas.length) return;
  const hoja = hoja_();
  hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, HEADERS.length)
    .setValues(filas.map(function (f) { return HEADERS.map(function (h) { return f[h] === undefined ? '' : f[h]; }); }));
}

function leerTodo_() {
  const hoja = hoja_();
  const n = hoja.getLastRow() - 1;
  if (n < 1) return [];
  return hoja.getRange(2, 1, n, HEADERS.length).getValues().map(function (r) {
    const o = {};
    HEADERS.forEach(function (h, i) { o[h] = r[i]; });
    return serializar_(o);
  });
}

function serializar_(o) {
  const out = Object.assign({}, o);
  out.fecha = o.fecha instanceof Date ? o.fecha.toISOString() : String(o.fecha);
  out.monto = Number(o.monto) || 0;
  return out;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Para correr desde el editor ----------

/** Ejecuta esto una vez: crea la hoja y genera un token aleatorio (míralo en Registros). */
function configurar() {
  hoja_();
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('TOKEN');
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('TOKEN', token);
  }
  Logger.log('TOKEN: ' + token);
}

/** Manda un push de prueba a todos los dispositivos suscritos. */
function probarNotificacion() {
  Logger.log(JSON.stringify(probarPush_()));
}

function probarParser() {
  [
    'Pagaste $249.00 a OXXO',
    'Recibiste $1,500 de Juan Pérez',
    'Transferiste $500.50 a Ana López',
    'Tu pago de $199 en Netflix fue aprobado',
    'Tu dinero ya está disponible · Ingresaste $ 5.00 desde tu cuenta de BBVA MEXICO.',
  ].forEach(function (t) { Logger.log(t + ' -> ' + JSON.stringify(parsear(t))); });
}

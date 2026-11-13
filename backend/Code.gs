/**
 * DBSHBOARD — backend en Google Apps Script + Google Sheets.
 *
 * Endpoints (una sola URL de "Web App"):
 *   POST  { token, texto | titulo + cuerpo, app? }          -> parsea notificación y guarda
 *   POST  { token, action:"add", tipo, monto, concepto, categoria, fecha? }  -> alta manual
 *   POST  { token, action:"delete", id }                   -> borra un movimiento
 *   GET   ?token=...                                        -> lista JSON de movimientos
 *
 * El token se guarda en Propiedades del script (clave TOKEN). Ver README.
 */

const SHEET_NAME = 'Movimientos';
const HEADERS = ['id', 'fecha', 'tipo', 'monto', 'concepto', 'categoria', 'origen', 'texto'];

// Palabras clave -> categoría (minúsculas, sin acentos). Edítalas a tu gusto.
const CATEGORIAS = {
  'Comida': ['oxxo', 'seven', '7-eleven', 'starbucks', 'restaurante', 'tacos', 'rappi', 'uber eats', 'didi food', 'mcdonald', 'burger', 'pizza', 'cafe', 'comida'],
  'Super': ['walmart', 'soriana', 'chedraui', 'costco', 'sams', 'heb', 'la comer', 'bodega aurrera', 'super'],
  'Transporte': ['uber', 'didi', 'cabify', 'gasolina', 'pemex', 'shell', 'bp ', 'metro', 'caseta', 'estacionamiento'],
  'Servicios': ['cfe', 'telmex', 'izzi', 'totalplay', 'megacable', 'telcel', 'at&t', 'movistar', 'agua', 'gas ', 'internet', 'recarga'],
  'Suscripciones': ['netflix', 'spotify', 'disney', 'hbo', 'max', 'prime', 'apple', 'icloud', 'youtube', 'chatgpt', 'claude', 'xbox', 'playstation'],
  'Compras': ['amazon', 'mercado libre', 'mercadolibre', 'liverpool', 'shein', 'temu', 'coppel', 'tienda'],
  'Salud': ['farmacia', 'similares', 'guadalajara', 'benavides', 'doctor', 'hospital', 'dentista'],
  'Transferencias': ['transferiste', 'transferencia', 'enviaste', 'spei'],
};

const PALABRAS_INGRESO = ['recibiste', 'te envio', 'te enviaron', 'te transfirio', 'ingreso', 'acredit', 'reembolso', 'devolucion', 'cobraste', 'depositaron', 'rendimiento'];

// ---------- HTTP ----------

function doGet(e) {
  if (!autorizado_(e.parameter.token)) return json_({ ok: false, error: 'token inválido' });
  return json_({ ok: true, movimientos: leerTodo_() });
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData && e.postData.contents || '{}');
  } catch (err) {
    // Atajos a veces manda form-data; lo aceptamos también.
    body = e.parameter || {};
  }
  const token = body.token || (e.parameter && e.parameter.token);
  if (!autorizado_(token)) return json_({ ok: false, error: 'token inválido' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (body.action === 'delete') return json_(borrar_(body.id));
    if (body.action === 'add') return json_(agregarManual_(body));
    return json_(agregarNotificacion_(body));
  } finally {
    lock.releaseLock();
  }
}

// ---------- Lógica ----------

function agregarNotificacion_(body) {
  const texto = [body.titulo, body.cuerpo, body.texto].filter(Boolean).map(String).join(' · ').trim();
  if (!texto) return { ok: false, error: 'sin texto' };

  // Evita duplicados: la misma notificación en los últimos 5 minutos.
  const cache = CacheService.getScriptCache();
  const huella = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, texto));
  if (cache.get(huella)) return { ok: true, duplicado: true };
  cache.put(huella, '1', 300);

  const p = parsear(texto);
  const fila = {
    id: Utilities.getUuid(),
    fecha: body.fecha ? new Date(body.fecha) : new Date(),
    tipo: p.tipo,
    monto: p.monto,
    concepto: p.concepto,
    categoria: p.categoria,
    origen: body.app || 'Mercado Pago',
    texto: texto,
  };
  guardar_(fila);
  return { ok: true, movimiento: serializar_(fila) };
}

function agregarManual_(body) {
  const monto = Math.abs(Number(String(body.monto).replace(/[^\d.]/g, '')));
  if (!monto) return { ok: false, error: 'monto inválido' };
  const fila = {
    id: Utilities.getUuid(),
    fecha: body.fecha ? new Date(body.fecha) : new Date(),
    tipo: body.tipo === 'ingreso' ? 'ingreso' : 'gasto',
    monto: monto,
    concepto: String(body.concepto || '').slice(0, 120),
    categoria: String(body.categoria || 'Otros').slice(0, 40),
    origen: 'Manual',
    texto: '',
  };
  guardar_(fila);
  return { ok: true, movimiento: serializar_(fila) };
}

function borrar_(id) {
  const hoja = hoja_();
  const ids = hoja.getRange(2, 1, Math.max(hoja.getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) {
      hoja.deleteRow(i + 2);
      return { ok: true };
    }
  }
  return { ok: false, error: 'no encontrado' };
}

/**
 * Convierte el texto de una notificación de Mercado Pago en {tipo, monto, concepto, categoria}.
 * Ejemplos que entiende:
 *   "Pagaste $249.00 a OXXO"
 *   "Recibiste $1,500 de Juan Pérez"
 *   "Transferiste $500.50 a Ana López"
 *   "Tu pago de $199 en Netflix fue aprobado"
 */
function parsear(texto) {
  const t = normalizar_(texto);

  // Monto: primer "$1,234.56" (o "MXN 1234")
  let monto = 0;
  const m = texto.match(/\$\s?([\d.,]+)/) || texto.match(/(?:MXN|mxn)\s?([\d.,]+)/);
  if (m) monto = aNumero_(m[1]);

  const tipo = PALABRAS_INGRESO.some(function (p) { return t.indexOf(p) !== -1; }) ? 'ingreso' : 'gasto';

  // Concepto: lo que va después de " a ", " en " o " de " tras el monto.
  let concepto = '';
  const tras = m ? texto.slice(texto.indexOf(m[0]) + m[0].length) : texto;
  const c = tras.match(/\s(?:a|en|de|para)\s+(.+?)(?:\s+(?:fue|ha sido|con|el|desde)\b|[.·\n]|$)/i);
  if (c) concepto = c[1].trim();
  if (!concepto) concepto = texto.slice(0, 60);

  let categoria = tipo === 'ingreso' ? 'Ingresos' : 'Otros';
  if (tipo === 'gasto') {
    for (const cat in CATEGORIAS) {
      if (CATEGORIAS[cat].some(function (k) { return t.indexOf(k) !== -1; })) { categoria = cat; break; }
    }
  }
  return { tipo: tipo, monto: monto, concepto: concepto.slice(0, 120), categoria: categoria };
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
  }
  return hoja;
}

function guardar_(f) {
  hoja_().appendRow(HEADERS.map(function (h) { return f[h]; }));
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

// ---------- Para probar desde el editor ----------

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

function probarParser() {
  [
    'Pagaste $249.00 a OXXO',
    'Recibiste $1,500 de Juan Pérez',
    'Transferiste $500.50 a Ana López',
    'Tu pago de $199 en Netflix fue aprobado',
  ].forEach(function (t) { Logger.log(t + ' -> ' + JSON.stringify(parsear(t))); });
}

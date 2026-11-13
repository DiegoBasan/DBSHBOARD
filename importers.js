// Importadores de estados de cuenta — adaptados de Diapps-BS/finanzas.
// Todo se lee dentro del dispositivo; al backend solo llegan los movimientos ya armados.
//   Mercado Pago: Tu perfil → Estados de cuenta → descargar Excel (.xlsx) o CSV
//   BBVA (débito): PDF del estado de cuenta mensual

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const nice = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const fechaISO = (y, m, d) => new Date(y, m - 1, d, 12).toISOString();
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍]/gu;
const potName = (n) => String(n).replace(EMOJI, '').replace(/\s+/g, ' ').trim().replace(/\s+\d[\d,.]*$/, '').trim();

// Palabras clave -> categoría (mismas categorías que app.js)
const CAT_RE = [
  [/petro ?7|gasol|oxxo gas|pemex|shell|\bbp\b|caseta|autozone|llanta/, 'Auto'],
  [/kfc|carls|domino|chili|pizz|taco|krispy|dairy|starbucks|burger|mcdonald|sushi|cafe|restaur|comida|montados|wings|subway|little caesar|nayax|snack|comedor|wendy|macaron|bakery|fritanga|ganbare|torta/, 'Comida'],
  [/farmacia|botica|similar|bio ?health|doctor|hospital|dental|gym|gimnasio/, 'Salud'],
  [/oxxo|7.?eleven|walmart|soriana|heb|costco|chedraui|bodega|super/, 'Super'],
  [/uber|didi|cabify|metro|taxi|\blime\b/, 'Transporte'],
  [/netflix|spotify|apple|icloud|youtube|disney|hbo|prime|chatgpt|claude/, 'Suscripciones'],
  [/cine|cinepolis|cinemex|shows|concierto|boletos|ticket|lives|bowl|boliche|\bbar\b|antro/, 'Ocio'],
  [/renta|cfe|telmex|izzi|totalplay|megacable|telcel|internet|recarga|predial/, 'Casa'],
  [/credito|deuda|mensualidad|tarjeta/, 'Deudas'],
  [/home depot|steren|telec|playera|souvenir|amazon|mercado ?libre|liverpool|coppel|paypal|cuponopolis|shein|ropa/, 'Compras'],
];
export const categoria = (t) => { const n = norm(t); for (const [re, c] of CAT_RE) if (re.test(n)) return c; return 'Otros'; };

/** Lee un archivo y devuelve { banco, periodo, rows, saldoFinal, cuenta, aviso } */
export async function leerArchivo(file) {
  const buf = await file.arrayBuffer();
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') return bbvaDesdePdf(buf);
  const rows = /\.csv$/i.test(file.name) ? readCsv(new TextDecoder().decode(buf)) : await readXlsx(buf);
  return mercadoPago(rows);
}

/* ---------------- Mercado Pago ---------------- */

function mercadoPago(rows) {
  const h = rows.findIndex((r) => r && r.some((c) => /RELEASE_DATE/i.test(c || '')));
  if (h < 0) throw new Error('no parece un estado de cuenta de Mercado Pago');
  const H = rows[h].map((c) => String(c || '').toUpperCase()), ix = (n) => H.indexOf(n);
  const num = (v) => parseFloat(String(v || '0').replace(/[,$\s]/g, '')) || 0;
  const hr = rows.findIndex((r) => r && r.some((c) => /FINAL_BALANCE/i.test(c || '')));
  const fi = hr >= 0 ? rows[hr].findIndex((c) => /FINAL_BALANCE/i.test(c || '')) : -1;
  const final = fi >= 0 ? num((rows[hr + 1] || [])[fi]) : null;

  const list = rows.slice(h + 1).filter((r) => r && r[ix('RELEASE_DATE')]).map((r) => {
    const [d, m, y] = String(r[ix('RELEASE_DATE')]).split(/[-/]/).map(Number);
    return { y, m, d, t: String(r[ix('TRANSACTION_TYPE')] || '').trim(), ref: String(r[ix('REFERENCE_ID')] || ''), a: num(r[ix('TRANSACTION_NET_AMOUNT')]) };
  });

  // Tus propias cuentas: los nombres de quien te manda dinero desde tus bancos
  const own = new Set(list.filter((x) => /^Transferencia recibida /i.test(x.t)).map((x) => norm(x.t.replace(/^Transferencia recibida /i, '')).split(' ')[0]));
  const out = [], seen = new Map();
  let ultima = null;
  for (const x of list) {
    // Mercado Pago repite la referencia en movimientos distintos: la llave incluye tipo, monto y fecha
    const key0 = `mp|${x.ref}|${x.y}-${x.m}-${x.d}|${x.t}|${x.a}`;
    seen.set(key0, (seen.get(key0) || 0) + 1);
    const ref = `${key0}#${seen.get(key0)}`;
    const T = x.t, a = Math.abs(x.a), fecha = fechaISO(x.y, x.m, x.d);
    ultima = fecha;
    const add = (o) => out.push({ fecha, monto: a, ref, cuenta: 'mp-debito', origen: 'Estado MP', ...o });
    let m;
    if (/^ganancia|^rendimiento/i.test(T)) continue; // rendimientos de la inversión: se ignoran
    if ((m = T.match(/^(Monto apartado|Apartado programado|Apartado por gastos)\s+(.+)$/i))) {
      add({ tipo: 'movimiento', categoria: 'Apartados', concepto: `A ${potName(m[2])}`, destino: `apartado+:${potName(m[2])}` }); continue;
    }
    if ((m = T.match(/^Monto retirado\s+(.+)$/i))) {
      add({ tipo: 'movimiento', categoria: 'Apartados', concepto: `De ${potName(m[1])}`, destino: `apartado-:${potName(m[1])}` }); continue;
    }
    if ((m = T.match(/^Transferencia enviada\s+(.+)$/i))) {
      const who = m[1].trim();
      if (own.has(norm(who).split(' ')[0])) {
        const nu = /\bnu\b/i.test(who);
        add({ tipo: 'movimiento', categoria: 'Transferencias', concepto: nu ? 'A Nu' : 'A BBVA', destino: nu ? 'nu-credito' : 'bbva-debito' });
      } else add({ tipo: 'gasto', categoria: 'Transferencias', concepto: `Transferencia a ${nice(who)}` });
      continue;
    }
    if ((m = T.match(/^Devoluci[oó]n de transferencia enviada\s+(.+)$/i))) {
      add({ tipo: 'ingreso', categoria: 'Ingresos', concepto: 'Devolución de transferencia' }); continue;
    }
    // Lo que te mandas desde BBVA es una transferencia entre tus cuentas
    if (/^Transferencia recibida\s+/i.test(T)) {
      out.push({ fecha, monto: a, ref, cuenta: 'bbva-debito', destino: 'mp-debito', tipo: 'movimiento', categoria: 'Transferencias', concepto: 'De BBVA', origen: 'Estado MP' });
      continue;
    }
    if (x.a > 0) {
      add({ tipo: 'ingreso', categoria: 'Ingresos', concepto: /cashback/i.test(T) ? 'Cashback' : /devoluci/i.test(T) ? T.replace(/^Devoluci[oó]n de pago\s*/i, 'Devolución ') : T });
      continue;
    }
    const note = T.replace(/^Pago\s*/i, '').replace(/^Mercadopago \*/i, '').replace(/^(Dlo|Bzi)\*/i, '').replace(/^Paypal \*/i, 'PayPal ').trim() || 'Pago';
    add({ tipo: 'gasto', categoria: categoria(T), concepto: nice(note) });
  }
  const fechas = out.map((r) => r.fecha).sort();
  return { banco: 'Mercado Pago', cuenta: 'mp-debito', rows: out, saldoFinal: final, fechaSaldo: ultima, periodo: { de: fechas[0], a: fechas[fechas.length - 1] } };
}

/* ---------------- BBVA (PDF) ---------------- */

const MES = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12 };
const AMT = /^\d{1,3}(?:,\d{3})*\.\d{2}$/;
const n2 = (s) => parseFloat(String(s).replace(/,/g, '')) || 0;
const NOISE = /^(BBVA MEXICO|Av\. Paseo|Estado de Cuenta|Libret|PAGINA|No\. de|La GAT|Total de Movimientos|FECHA|OPER|\d{20,}|[A-Z0-9]{25,}$)/;

let pdfjs = null;
async function bbvaDesdePdf(buf) {
  if (!pdfjs) {
    pdfjs = await import(PDFJS + 'pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs';
  }
  const res = parseBBVA(await pdfRows(new Uint8Array(buf)));
  return { banco: 'BBVA', cuenta: 'bbva-debito', rows: bbvaRows(res), saldoFinal: res.saldoFinal, fechaSaldo: res.periodo.a,
    periodo: res.periodo, aviso: res.ok ? '' : 'Los totales del PDF no cuadraron del todo; revisa los movimientos.' };
}

/* Renglones de texto por página, con la posición de cada palabra */
async function pdfRows(data) {
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise, out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent(), rows = [];
    for (const it of tc.items) {
      const s = (it.str || '').trim(); if (!s) continue;
      const y = it.transform[5], x = it.transform[4];
      let r = rows.find((r) => Math.abs(r.y - y) <= 2.5);
      if (!r) { r = { page: p, y, items: [] }; rows.push(r); }
      r.items.push({ x, w: it.width || 0, s });
    }
    rows.sort((a, b) => b.y - a.y).forEach((r) => { r.items.sort((a, b) => a.x - b.x); r.text = r.items.map((i) => i.s).join(' ').replace(/\s+/g, ' '); });
    out.push(...rows);
  }
  return out;
}

/* La columna (cargo o abono) se decide por la posición del monto respecto a los encabezados y se valida con los totales del PDF */
function parseBBVA(rows) {
  const all = rows.map((r) => r.text).join('\n');
  if (!/BBVA/i.test(all)) throw new Error('no parece un estado de cuenta de BBVA');
  const per = all.match(/DEL\s+(\d{2})\/(\d{2})\/(\d{4})\s+AL\s+(\d{2})\/(\d{2})\/(\d{4})/);
  if (!per) throw new Error('no encontré el periodo del estado de cuenta');
  const de = { d: +per[1], m: +per[2], y: +per[3] }, a = { d: +per[4], m: +per[5], y: +per[6] };
  const pick = (re) => { const m = all.match(re); return m ? n2(m[1]) : null; };
  const res = {
    periodo: { de: fechaISO(de.y, de.m, de.d), a: fechaISO(a.y, a.m, a.d) },
    saldoFinal: pick(/Saldo Final\s+([\d,]+\.\d{2})/),
    totales: { cargos: pick(/TOTAL IMPORTE CARGOS\s+([\d,]+\.\d{2})/), abonos: pick(/TOTAL IMPORTE ABONOS\s+([\d,]+\.\d{2})/) },
    list: [],
  };
  let col = null, cur = null;
  const yearFor = (m) => (m < de.m ? a.y : de.y);
  for (const r of rows) {
    if (/TOTAL IMPORTE CARGOS|Total de Movimientos/.test(r.text)) break;
    const edge = (it, word) => { const k = it.s.indexOf(word); return it.x + it.w * (k + word.length) / it.s.length; };
    const hc = r.items.find((i) => /(^|\s)CARGOS(\s|$)/.test(i.s)), ha = r.items.find((i) => /(^|\s)ABONOS(\s|$)/.test(i.s));
    if (hc && ha) { col = { c: edge(hc, 'CARGOS'), a: edge(ha, 'ABONOS') }; continue; }
    const m = r.text.match(/^(\d{2})\/([A-Z]{3})\s+(\d{2})\/([A-Z]{3})\s*(.*)$/);
    if (m && MES[m[2]]) {
      const amts = r.items.filter((i) => AMT.test(i.s));
      let cargo = 0, abono = 0;
      if (amts.length) {
        const first = amts[0], right = first.x + first.w;
        if (col) { if (Math.abs(right - col.c) <= Math.abs(right - col.a)) cargo = n2(first.s); else abono = n2(first.s); }
        else cargo = n2(first.s);
      }
      const desc = r.items.filter((i) => !AMT.test(i.s)).map((i) => i.s).join(' ').replace(/^\d{2}\/[A-Z]{3}\s+\d{2}\/[A-Z]{3}\s*/, '').replace(/\s+/g, ' ').trim();
      cur = { y: yearFor(MES[m[2]]), m: MES[m[2]], d: +m[1], desc, extra: [], cargo, abono };
      res.list.push(cur); continue;
    }
    if (cur && !NOISE.test(r.text) && !/^RFC:/.test(r.text) && cur.extra.length < 5) cur.extra.push(r.text);
  }
  const sc = res.list.reduce((s, t) => s + t.cargo, 0), sa = res.list.reduce((s, t) => s + t.abono, 0);
  res.ok = res.totales.cargos == null || (Math.abs(sc - res.totales.cargos) < 0.05 && Math.abs(sa - res.totales.abonos) < 0.05);
  return res;
}

function bbvaRows(res) {
  const L = res.list.map((x) => ({ ...x })), out = [], seen = new Map();
  // envío y devolución del mismo monto se cancelan
  L.forEach((x, i) => {
    if (!/DEVUELTO/i.test(x.desc)) return;
    const j = L.findIndex((y, k) => k < i && !y.skip && /ENVIADO/i.test(y.desc) && Math.abs(y.cargo - x.abono) < 0.01);
    if (j >= 0) { L[j].skip = true; x.skip = true; }
  });
  for (const x of L) {
    const key0 = `bbva|${x.y}-${x.m}-${x.d}|${x.desc}|${x.cargo}|${x.abono}|${(x.extra[0] || '').slice(0, 30)}`;
    seen.set(key0, (seen.get(key0) || 0) + 1);
    if (x.skip) continue;
    const ref = `${key0}#${seen.get(key0)}`, a = x.cargo || x.abono, T = x.desc, E = x.extra.join(' ');
    const add = (o) => out.push({ fecha: fechaISO(x.y, x.m, x.d), monto: a, ref, cuenta: 'bbva-debito', origen: 'Estado BBVA', ...o });
    if (/SPEI RECIBIDO/i.test(T) && /MERCADO ?\*?PAGO/i.test(T + ' ' + E)) { add({ tipo: 'movimiento', categoria: 'Transferencias', concepto: 'De Mercado Pago', cuenta: 'mp-debito', destino: 'bbva-debito' }); continue; }
    if (/SPEI ENVIADO/i.test(T) && /MERCADO ?PAGO/i.test(T)) { add({ tipo: 'movimiento', categoria: 'Transferencias', concepto: 'A Mercado Pago', destino: 'mp-debito' }); continue; }
    if (x.abono) { const nom = /NOMINA/i.test(E + T); add({ tipo: 'ingreso', categoria: 'Ingresos', concepto: nom ? 'Nómina' : nice(T.replace(/^SPEI RECIBIDO/i, 'Depósito ')) }); continue; }
    if (/RETIRO/i.test(T)) { add({ tipo: 'movimiento', categoria: 'Transferencias', concepto: 'Retiro de efectivo', destino: 'efectivo' }); continue; }
    if (/PAGO TARJETA|PAGO TDC|PAGO A TARJETA/i.test(T)) { const nu = /\bNU\b/i.test(T + ' ' + E); add({ tipo: 'movimiento', categoria: 'Transferencias', concepto: nu ? 'Pago tarjeta Nu' : 'Pago tarjeta BBVA', destino: nu ? 'nu-credito' : 'bbva-credito' }); continue; }
    if (/SPEI ENVIADO|PAGO CUENTA DE TERCERO|TRASPASO/i.test(T)) {
      const concept = (x.extra[0] || '').replace(/Referencia.*$/i, '').replace(/^BNET\s+\d+\s*/i, '').replace(/^\d+/, '').trim();
      const who = x.extra.find((l) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ ]{5,}$/.test(l) && !/mercado pago|libret/i.test(l)) || '';
      const c = categoria(concept);
      add({ tipo: 'gasto', categoria: c === 'Otros' ? 'Transferencias' : c, concepto: [concept, who].filter(Boolean).map(nice).join(' · ') || 'Transferencia' });
      continue;
    }
    const note = T.replace(/^(MERPAGO|STR|NAYAXX1|DLO|BZI|PAYPAL)\*/i, '').replace(/^NAYAX\b.*/i, 'Snack Nayax').trim();
    add({ tipo: 'gasto', categoria: categoria(T), concepto: nice(note) });
  }
  return out;
}

/* ---------------- Lectores de archivos ---------------- */

/* .xlsx sin librerías (zip + XML) */
async function readXlsx(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf), files = {};
  let e = u8.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('no es un .xlsx');
  let p = dv.getUint32(e + 16, true);
  const n = dv.getUint16(e + 10, true), td = new TextDecoder();
  for (let i = 0; i < n; i++) {
    const method = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    const st = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    files[name] = { method, data: u8.subarray(st, st + cs) };
  }
  const txt = async (f) => {
    if (!f) return '';
    if (f.method === 0) return td.decode(f.data);
    const st = new Blob([f.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return td.decode(await new Response(st).arrayBuffer());
  };
  const X = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const ss = [...X(await txt(files['xl/sharedStrings.xml'])).getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent).join(''));
  const sheet = Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort()[0];
  const col = (r) => { let c = 0; for (const ch of r.replace(/\d+/g, '')) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };
  return [...X(await txt(files[sheet])).getElementsByTagName('row')].map((row) => {
    const out = [];
    for (const c of row.getElementsByTagName('c')) {
      const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      out[col(c.getAttribute('r') || 'A')] = t === 's' ? ss[+v] : t === 'inlineStr' ? [...c.getElementsByTagName('t')].map((x) => x.textContent).join('') : v;
    }
    return out;
  });
}

function readCsv(text) {
  return text.replace(/^﻿/, '').split(/\r?\n/).map((l) => {
    const o = []; let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if ((ch === ',' || ch === ';') && !q) { o.push(cur); cur = ''; } else cur += ch; }
    o.push(cur); return o;
  });
}

/* Kreditablösung – Tab-Modul für das Finanzplanungs-Tool.
   Alle Zahlen liegen in state.kredit (Daten-Datei), nicht im Code. */
(function () {
'use strict';

const MON = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
const SCEN = [['Mies', -10], ['Schlecht', -2], ['Null', 0], ['Basis', 5], ['Stark', 10]];
const ymi = s => { const p = String(s).split('-').map(Number); return p[0] * 12 + p[1] - 1; };
const iym = i => Math.floor(i / 12) + '-' + String(i % 12 + 1).padStart(2, '0');
const lab = i => MON[i % 12] + ' ' + Math.floor(i / 12);
const mmY = i => String(i % 12 + 1).padStart(2, '0') + '/' + Math.floor(i / 12);
const eur = v => Math.round(v).toLocaleString('de-DE') + ' €';
const dec = v => (v === null || v === undefined || v === '') ? '' : Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2 });
const pct = r => (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r) + ' %';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isYm = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s));
function num(t) {
  let s = String(t === null || t === undefined ? '' : t).replace(/\s|€|%/g, '').replace(/−/g, '-');
  if (s === '') return null;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const v = parseFloat(s);
  return isFinite(v) ? v : null;
}

/* ───────── Rechenkern ───────── */
function sim(P, S, o) {
  const b0 = ymi(S[0].monat), last = ymi(S[S.length - 1].monat), ist = {};
  S.forEach(s => { ist[ymi(s.monat)] = s; });
  const eK = ymi(P.kleinEnde), eG = ymi(P.grossEnde), eMax = Math.max(eK, eG), end = eMax + 6;
  const bM = o.baus && P.bausparerBetrag > 0 && isYm(P.bausparerMonat) ? ymi(P.bausparerMonat) : -1;
  const iK = P.kleinZins / 1200, iG = P.grossZins / 1200, iC = (P.cashZins || 0) / 1200, tx = (P.steuer || 0) / 100;
  const spar = (P.trSparplan || 0) + (P.ingSparplan || 0);
  const bw = {}; BW().forEach(b => { if (isYm(b.monat)) bw[ymi(b.monat)] = (bw[ymi(b.monat)] || 0) + b.betrag; });
  let cash = S[0].cash, wp = S[0].tr + S[0].ing, ein = P.einstand, bk = P.kleinSaldo, bg = P.grossSaldo, kum = 0, pK = false, pG = false;
  const kor = {}; KOR().forEach(c => { if (isYm(c.monat)) kor[c.kredit + ymi(c.monat)] = c.saldo; });
  if (kor['klein' + b0] !== undefined) bk = kor['klein' + b0];
  if (kor['gross' + b0] !== undefined) bg = kor['gross' + b0];
  const tax = () => tx * Math.max(0, wp - ein);
  const R = { b0: b0, last: last, eK: eK, eG: eG, bM: bM, net: [cash + wp - tax()], rest: [bk + bg], cash: [cash],
    firstK: null, firstB: null, endK: 0, endG: 0, netK: 0, netG: 0, ueber: 0, netNow: cash + wp - tax(), cashNow: cash, kNow: bk, gNow: bg };
  for (let m = b0 + 1; m <= end; m++) {
    const mo = m % 12 + 1, fut = m > last;
    cash = cash * (1 + iC) + ([2, 5, 8, 11].indexOf(mo) >= 0 ? (P.trQuartal || 0) : 0) - (P.trSparplan || 0);
    if (m === bM) cash += P.bausparerBetrag;
    if (bw[m]) cash += bw[m];
    const add = spar + (fut ? o.extra : 0);
    wp = wp * Math.pow(1 + o.r, 1 / 12) + add; ein += add;
    if (ist[m]) { cash = ist[m].cash; wp = ist[m].tr + ist[m].ing; ein += (ist[m].kaufTr || 0) + (ist[m].kaufIng || 0); }
    if (!pK) bk = bk * (1 + iK) - P.kleinRate;
    if (!pG) bg = bg * (1 + iG) - P.grossRate;
    if (!pK && kor['klein' + m] !== undefined) bk = kor['klein' + m];
    if (!pG && kor['gross' + m] !== undefined) bg = kor['gross' + m];
    const before = cash + wp - tax() - kum;
    if (m === last) { R.netNow = before; R.cashNow = cash; R.kNow = bk; R.gNow = bg; }
    if (fut && R.firstK === null && !pK && before >= bk) R.firstK = m;
    if (m === eK) { R.endK = bk * (1 + iK) - P.kleinRate; R.netK = before; kum += R.endK; pK = true; bk = 0; }
    if (m === eG) { R.endG = bg * (1 + iG) - P.grossRate; R.netG = before; kum += R.endG; pG = true; bg = 0; }
    const net = cash + wp - tax() - kum;
    if (m === eMax) R.ueber = net;
    const er = (pK ? 0 : bk * (1 + iK) - P.kleinRate) + (pG ? 0 : bg * (1 + iG) - P.grossRate);
    if (fut && R.firstB === null && net >= er) R.firstB = m;
    R.net.push(net); R.rest.push(bk + bg); R.cash.push(cash);
  }
  return R;
}

function breakEven(P, S, o) {
  let lo = -0.7, hi = 0.5;
  for (let n = 0; n < 40; n++) {
    const mid = (lo + hi) / 2;
    if (sim(P, S, { r: mid, extra: o.extra, baus: o.baus }).ueber >= 0) hi = mid; else lo = mid;
  }
  return hi;
}

function bausKlein(P, R, on) {
  return on && P.bausparerBetrag > 0 && isYm(P.bausparerMonat) && ymi(P.bausparerMonat) <= R.eK ? Math.min(P.bausparerBetrag, R.endK) : 0;
}

function glide(P, R0, on) {
  const v = P.vorlauf || 24, gK = R0.eK - v, gG = R0.eG - v, bK = bausKlein(P, R0, on);
  const cAt = m => R0.cash[Math.max(0, Math.min(R0.cash.length - 1, m - R0.b0))];
  const nK = Math.max(0, R0.endK - cAt(gK) - (R0.bM > gK ? bK : 0));
  const nG = Math.max(0, R0.endG + R0.endK - (R0.bM > gG ? bK : 0) - cAt(gG));
  return { gK: gK, gG: gG, mK: nK / v, mG: nG / v };
}

function ingPerf(P, S) {
  if (!isYm(P.ingStart) || !(P.ingEingezahlt > 0)) return null;
  const b0 = ymi(S[0].monat), s0 = ymi(P.ingStart), n0 = b0 - s0;
  if (n0 <= 0) return null;
  const a0 = P.ingEingezahlt / n0, a1 = P.ingSparplan || 0;
  return S.map(s => {
    const m = ymi(s.monat), ks = S.filter(k => k.kaufIng > 0 && ymi(k.monat) > b0 && ymi(k.monat) <= m);
    const paid = P.ingEingezahlt + (m - b0) * a1 + ks.reduce((a, k) => a + k.kaufIng, 0);
    const f = r => { let v = 0; for (let i = s0; i < m; i++) v += (i < b0 ? a0 : a1) * Math.pow(1 + r, (m - i) / 12); ks.forEach(k => { v += k.kaufIng * Math.pow(1 + r, (m - ymi(k.monat) + 1) / 12); }); return v; };
    let lo = -0.95, hi = 5;
    for (let n = 0; n < 60; n++) { const mid = (lo + hi) / 2; if (f(mid) < s.ing) lo = mid; else hi = mid; }
    return { m: m, paid: paid, wert: s.ing, gesamt: s.ing / paid - 1, pa: (lo + hi) / 2 };
  });
}

/* ───────── Zustand des Tabs (nicht gespeichert) ───────── */
let wi = { r: 0, extra: 0, baus: null };
let view = null;

function K() { return (typeof state !== 'undefined' && state && state.kredit) || null; }
function BW() { const k = K(); return k && Array.isArray(k.bewegungen) ? k.bewegungen : []; }
function KOR() { const k = K(); return k && Array.isArray(k.korrekturen) ? k.korrekturen : []; }
function ready() { const k = K(); return !!(k && k.params && Array.isArray(k.staende) && k.staende.length); }
function bausOn(P) { return wi.baus === null ? false : wi.baus; }
function toast(m) { if (typeof showToast === 'function') showToast(m); }
function commit() {
  if (typeof saveState === 'function') saveState();
  if (typeof render === 'function') render();
  renderKredit();
}

/* ───────── Ausgabe ───────── */
const CSS = `
.kr-wrap{display:flex;flex-direction:column;gap:1.25rem}
.kr-row{display:flex;flex-wrap:wrap;gap:1rem}
.kr-card{background:var(--bg-elevated);border:1px solid var(--line);border-radius:var(--radius-lg);padding:1.1rem 1.25rem;box-shadow:var(--shadow-sm)}
.kr-kpi{flex:1 1 210px;display:flex;flex-direction:column;gap:.3rem}
.kr-eyebrow{font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-muted)}
.kr-big{font-family:'JetBrains Mono',monospace;font-size:1.9rem;font-weight:500}
.kr-sub{font-size:.82rem;color:var(--ink-muted)}
.kr-h{font-family:'Fraunces',serif;font-size:1.2rem;font-weight:600;margin:0 0 .6rem}
.kr-num{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;white-space:nowrap}
.kr-kv{display:flex;justify-content:space-between;align-items:baseline;gap:.75rem;padding:.2rem 0}
.kr-kv span:first-child{color:var(--ink-muted)}
.kr-ok{color:var(--accent)}.kr-bad{color:var(--warning)}
.kr-banner{background:var(--warning);color:#fff;font-weight:700;padding:.7rem 1rem;border-radius:var(--radius)}
.kr-table{width:100%;border-collapse:collapse;font-size:.88rem}
.kr-table th{text-align:right;font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-muted);padding:.4rem .5rem;border-bottom:1px solid var(--line-strong)}
.kr-table th:first-child,.kr-table td:first-child{text-align:left}
.kr-table td{text-align:right;padding:.5rem;border-bottom:1px solid var(--line)}
.kr-table tr.kr-cur td{background:var(--accent-soft)}
.kr-table tr.kr-cur td:first-child{box-shadow:inset 3px 0 0 var(--accent)}
.kr-pill{display:inline-block;padding:.15rem .6rem;border-radius:999px;font-weight:700;font-size:.78rem}
.kr-pill.ok{background:var(--accent-soft);color:var(--accent)}.kr-pill.bad{background:var(--warning-soft);color:var(--warning)}
.kr-ctl label{display:flex;justify-content:space-between;font-weight:600;font-size:.9rem;gap:.75rem}
.kr-ctl input[type=range]{width:100%;accent-color:var(--accent);height:2rem}
.kr-ctl input[type=checkbox]{accent-color:var(--accent);width:1.1rem;height:1.1rem}
.kr-form{display:flex;flex-wrap:wrap;gap:.9rem;align-items:flex-end}
.kr-f{flex:1 1 190px;display:flex;flex-direction:column;gap:.3rem;font-size:.85rem;font-weight:600}
.kr-f input{font:inherit;font-family:'JetBrains Mono',monospace;font-weight:400;padding:.55rem .7rem;border:1px solid var(--line-strong);border-radius:var(--radius);background:var(--bg);color:var(--ink);min-height:2.6rem;box-sizing:border-box;width:100%}
.kr-todo div{padding:.25rem 0}
.kr-scroll{overflow-x:auto}
.kr-x{border:0;background:none;color:var(--warning);cursor:pointer;font-size:1rem;padding:.2rem .5rem}
details.kr-card>summary{cursor:pointer;font-family:'Fraunces',serif;font-size:1.1rem;font-weight:600}
details.kr-card[open]>summary{margin-bottom:.9rem}
`;

const FIELDS = [
  ['kleinSaldo', 'Kredit klein – Restschuld im Monat des ersten Stands (€)'], ['kleinRate', 'Kredit klein – Monatsrate (€)'],
  ['kleinZins', 'Kredit klein – Sollzins % p.a.'], ['kleinEnde', 'Kredit klein – Zinsbindungsende', 'month'],
  ['grossSaldo', 'Kredit groß – Restschuld im Monat des ersten Stands (€)'], ['grossRate', 'Kredit groß – Monatsrate (€)'],
  ['grossZins', 'Kredit groß – Sollzins % p.a.'], ['grossEnde', 'Kredit groß – Zinsbindungsende', 'month'],
  ['einstand', 'Wertpapiere – Einstand im Monat des ersten Stands (€)'], ['trQuartal', 'TR – Einzahlung pro Quartal, Feb/Mai/Aug/Nov (€)'],
  ['trSparplan', 'TR – Sparpläne pro Monat aus Cash (€)'], ['ingSparplan', 'ING – Sparpläne pro Monat (€)'],
  ['ingStart', 'ING – Sparplanstart', 'month'], ['ingEingezahlt', 'ING – eingezahlt bis zum Monat des ersten Stands (€)'],
  ['trStart', 'TR – Sparplanstart', 'month'], ['trEingezahlt', 'TR – in Wertpapiere eingezahlt bis zum Monat des ersten Stands (€)'],
  ['cashZins', 'Zins auf Cash % p.a.'], ['steuer', 'Steuerabschlag auf Kursgewinne %'],
  ['bausparerBetrag', 'Bausparer – Auszahlungsbetrag (€, 0 = ohne)'], ['bausparerMonat', 'Bausparer – Auszahlungsmonat', 'month'],
  ['bausparerFrist', 'Bausparer – Kündigungsfrist (Monate)'], ['tag', 'Stände eintragen ab dem (Tag im Monat)'],
  ['vorlauf', 'Vorlauf fürs Umschichten in Cash (Monate)']
];
const REQUIRED = ['kleinSaldo', 'kleinRate', 'kleinZins', 'kleinEnde', 'grossSaldo', 'grossRate', 'grossZins', 'grossEnde', 'einstand'];

function paramsForm(P) {
  P = P || {};
  return '<div class="kr-form">' + FIELDS.map(f => {
    const v = f[2] === 'month' ? (P[f[0]] || '') : dec(P[f[0]]);
    return '<label class="kr-f">' + f[1] + '<input ' + (f[2] === 'month' ? 'type="month"' : 'type="text" inputmode="decimal"') + ' data-p="' + f[0] + '" value="' + esc(v) + '"></label>';
  }).join('') + '<button class="btn" type="button" data-kr="params">Einstellungen speichern</button></div>';
}

function standForm(defMonth) {
  return '<div class="kr-form">' +
    '<label class="kr-f">Monat<input type="month" id="kr-s-m" value="' + esc(defMonth) + '"></label>' +
    '<label class="kr-f">TR Cash für die Ablösung (€)<input type="text" inputmode="decimal" id="kr-s-c"></label>' +
    '<label class="kr-f">TR Portfolio ohne Geldmarkt (€)<input type="text" inputmode="decimal" id="kr-s-t"></label>' +
    '<label class="kr-f">ING Depot (€)<input type="text" inputmode="decimal" id="kr-s-i"></label>' +
    '<label class="kr-f">Depotkauf TR, einmalig (€)<input type="text" inputmode="decimal" id="kr-s-kt"></label>' +
    '<label class="kr-f">Depotkauf ING, einmalig (€)<input type="text" inputmode="decimal" id="kr-s-ki"></label>' +
    '<button class="btn" type="button" data-kr="stand">Stand übernehmen</button></div>' +
    '<div class="kr-sub" style="margin-top:.6rem">Depotkauf nur ausfüllen, wenn seit dem letzten Stand zusätzlich zu den Sparplänen gekauft wurde. Der Betrag erhöht den Einstand ab diesem Monat.</div>';
}

function chart(cur, ref, S) {
  const n = cur.net.length, W = 800, H = 310, L = 58, RR = 16, T = 16, B = 280;
  const max = Math.max.apply(null, cur.net.concat(cur.rest, ref.net));
  const step = [10000, 25000, 50000, 100000, 250000, 500000].find(s => max / s <= 5) || 1000000;
  const yMax = Math.max(step, Math.ceil(max / step) * step);
  const dx = (W - L - RR) / (n - 1), X = i => L + i * dx, Y = v => B - Math.max(0, Math.min(yMax, v)) / yMax * (B - T);
  const path = a => a.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  let g = '';
  for (let v = 0; v <= yMax; v += step) g += '<line x1="' + L + '" x2="' + (W - RR) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="var(--line)"/><text x="' + (L - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + (v / 1000) + ' T€</text>';
  for (let m = cur.b0; m < cur.b0 + n; m++) if (m % 12 === 0) g += '<text x="' + X(m - cur.b0).toFixed(1) + '" y="' + (B + 18) + '" text-anchor="middle">' + (m / 12) + '</text>';
  [[cur.eK, 'klein fällig'], [cur.eG, 'groß fällig']].forEach(e => {
    const x = X(e[0] - cur.b0).toFixed(1);
    g += '<line x1="' + x + '" x2="' + x + '" y1="' + T + '" y2="' + B + '" stroke="var(--gold)" stroke-dasharray="2 4"/><text x="' + (x - 5) + '" y="' + (T + 12) + '" text-anchor="end">' + e[1] + ' ' + mmY(e[0]) + '</text>';
  });
  const dots = S.map(s => { const i = ymi(s.monat) - cur.b0; return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(cur.net[i]).toFixed(1) + '" r="4.5" fill="var(--accent)" stroke="#fff" stroke-width="1.5"/>'; }).join('');
  view = { n: n, L: L, dx: dx, W: W, cur: cur };
  return '<svg id="kr-svg" viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;font-size:11px;fill:var(--ink-muted)" role="img" aria-label="Verlauf von Vermögen netto und offener Restschuld">' + g +
    '<path d="' + path(cur.rest) + '" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="7 5"/>' +
    '<path d="' + path(ref.net) + '" fill="none" stroke="var(--ink-muted)" stroke-width="1.5" stroke-dasharray="2 4"/>' +
    '<path d="' + path(cur.net) + '" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round"/>' + dots +
    '<line id="kr-hl" x1="0" x2="0" y1="' + T + '" y2="' + B + '" stroke="var(--ink-soft)" visibility="hidden"/></svg>';
}

function kv(a, b, cls) { return '<div class="kr-kv"><span>' + a + '</span><span class="kr-num ' + (cls || '') + '">' + b + '</span></div>'; }
function mOr(m) { return m === null ? 'nicht absehbar' : lab(m); }

function korBox(kredit, nowM) {
  const L = KOR().filter(c => c.kredit === kredit).sort((a, b) => ymi(a.monat) - ymi(b.monat));
  return '<details' + (L.length ? ' open' : '') + ' style="margin-top:.7rem;border-top:1px solid var(--line);padding-top:.6rem"><summary style="cursor:pointer;font-weight:600;font-size:.88rem">Restschuld korrigieren</summary>' +
    '<div class="kr-form" style="margin-top:.6rem"><label class="kr-f">Stand am 1. des Monats<input type="month" data-km="' + kredit + '" value="' + iym(nowM) + '"></label>' +
    '<label class="kr-f">Restschuld laut Bank (€)<input type="text" inputmode="decimal" data-kv="' + kredit + '"></label>' +
    '<button class="btn btn-secondary" type="button" data-kr="kor" data-k="' + kredit + '">Übernehmen</button></div>' +
    '<div class="kr-sub" style="margin-top:.5rem">Ab diesem Monat rechnet der Tab mit Zins und Rate weiter, jeweils zum Monatsersten.</div>' +
    L.map(c => '<div class="kr-kv" style="margin-top:.3rem"><span>Korrigiert zum 01.' + mmY(ymi(c.monat)).replace('/', '.') + '</span><span class="kr-num">' + eur(c.saldo) + ' <button type="button" class="kr-x" data-kr="kordel" data-k="' + kredit + '" data-m="' + esc(c.monat) + '" aria-label="Korrektur löschen">×</button></span></div>').join('') + '</details>';
}

function istRendite(P, S) {
  if (S.length < 2) return null;
  const b0 = ymi(S[0].monat), last = ymi(S[S.length - 1].monat), ist = {};
  S.forEach(s => { ist[ymi(s.monat)] = s; });
  const spar = (P.trSparplan || 0) + (P.ingSparplan || 0), target = S[S.length - 1].tr + S[S.length - 1].ing;
  const f = r => { let wp = S[0].tr + S[0].ing; for (let m = b0 + 1; m <= last; m++) wp = wp * Math.pow(1 + r, 1 / 12) + spar + (ist[m] ? (ist[m].kaufTr || 0) + (ist[m].kaufIng || 0) : 0); return wp; };
  let lo = -0.99, hi = 10;
  for (let n = 0; n < 60; n++) { const mid = (lo + hi) / 2; if (f(mid) < target) lo = mid; else hi = mid; }
  return { r: (lo + hi) / 2, n: last - b0, b0: b0 };
}

function kursRendite(P, S) {
  const b0 = ymi(S[0].monat), last = ymi(S[S.length - 1].monat), L = S[S.length - 1], fl = [];
  const hist = (start, paid, val) => {
    const ok = isYm(start) && paid > 0 && ymi(start) < b0;
    if (ok) { const s0 = ymi(start); for (let i = s0; i < b0; i++) fl.push([i, paid / (b0 - s0)]); } else fl.push([b0, val]);
    return ok;
  };
  const ingHist = hist(P.ingStart, P.ingEingezahlt, S[0].ing), trHist = hist(P.trStart, P.trEingezahlt, S[0].tr);
  const spar = (P.trSparplan || 0) + (P.ingSparplan || 0);
  for (let i = b0; i < last; i++) fl.push([i, spar]);
  S.forEach(s => { const k = (s.kaufTr || 0) + (s.kaufIng || 0), m = ymi(s.monat); if (k > 0 && m > b0) fl.push([m - 1, k]); });
  const first = fl.reduce((a, x) => Math.min(a, x[0]), last);
  if (first >= last) return null;
  const f = r => fl.reduce((a, x) => a + x[1] * Math.pow(1 + r, (last - x[0]) / 12), 0);
  let lo = -0.99, hi = 10;
  for (let n = 0; n < 60; n++) { const mid = (lo + hi) / 2; if (f(mid) < L.tr + L.ing) lo = mid; else hi = mid; }
  return { r: (lo + hi) / 2, first: first, n: last - first, b0: b0, ingHist: ingHist, trHist: trHist };
}

function update() {
  const k = K(), P = k.params, S = k.staende, on = bausOn(P);
  const o = { r: wi.r / 100, extra: wi.extra, baus: on };
  const cur = sim(P, S, o), ref = sim(P, S, { r: 0, extra: 0, baus: on }), be = breakEven(P, S, o);
  const bK = bausKlein(P, cur, on), ziel = cur.endK - bK + cur.endG, gl = glide(P, ref, on);
  const ahead = cur.firstB === null ? 0 : Math.max(0, Math.max(cur.eK, cur.eG) - cur.firstB);
  const $ = id => document.getElementById(id);
  const d = new Date(), nowM = d.getFullYear() * 12 + d.getMonth(), tag = P.tag || 1;
  const exp = d.getDate() >= tag ? nowM : nowM - 1, ok = cur.last >= exp, nextM = cur.last >= nowM ? nowM + 1 : nowM;
  const nextTxt = String(tag).padStart(2, '0') + '.' + String(nextM % 12 + 1).padStart(2, '0') + '.';

  $('kr-status').textContent = 'Stand ' + mmY(cur.last) + ' · Kredit klein bis ' + mmY(cur.eK) + ' · Kredit groß bis ' + mmY(cur.eG) + (ok ? ' · Stände aktuell, nächste Aktualisierung am ' + nextTxt : '');
  $('kr-banner').innerHTML = ok ? '' : '<div class="kr-banner">Werte für ' + mmY(exp) + ' fehlen. Bitte unten TR Cash, TR Portfolio und ING eintragen, bis dahin rechnet der Tab mit der Hochrechnung.</div>';

  $('kr-kpis').innerHTML =
    '<div class="kr-card kr-kpi"><div class="kr-eyebrow">Zielerreichung</div><div class="kr-big">' + Math.round(cur.netNow / ziel * 100) + ' %</div><div class="kr-sub">Ziel aus dem Topf ' + eur(ziel) + (bK ? ' (nach Bausparer)' : (P.bausparerBetrag > 0 ? ' (ohne Bausparer)' : '')) + '</div></div>' +
    '<div class="kr-card kr-kpi"><div class="kr-eyebrow">' + (be <= 0 ? 'Puffer: Depot darf fallen um p.a.' : 'Nötige Depotrendite p.a.') + '</div><div class="kr-big ' + (be <= 0 ? 'kr-ok' : 'kr-bad') + '">' + (Math.abs(be) * 100).toFixed(1).replace('.', ',') + ' %</div><div class="kr-sub">' + (be <= 0 ? 'So viel darf das Depot ab heute pro Jahr verlieren, und es reicht trotzdem. Cash und Einzahlungen laufen dabei wie geplant weiter.' : 'So viel muss das Depot pro Jahr bringen, damit es reicht.') + '</div></div>' +
    '<div class="kr-card kr-kpi"><div class="kr-eyebrow">Fertig vor Stichtag</div><div class="kr-big">' + ahead + ' Mon.</div><div class="kr-sub">bei ' + pct(wi.r) + ' Rendite, beide ablösbar ab ' + mOr(cur.firstB) + '</div></div>' +
    '<div class="kr-card kr-kpi"><div class="kr-eyebrow">Vermögen netto</div><div class="kr-big">' + eur(cur.netNow) + '</div><div class="kr-sub">davon Cash ' + eur(cur.cashNow) + '</div></div>';

  $('kr-chart').innerHTML = chart(cur, ref, S);
  $('kr-hover').textContent = 'Grün: Vermögen netto bei ' + pct(wi.r) + ' · gepunktet: Vergleich bei 0 % · gestrichelt: offene Restschuld. Mit der Maus über den Chart fahren zeigt die Monatswerte.';
  $('kr-r-l').textContent = pct(wi.r);
  $('kr-x-l').textContent = wi.extra ? '+' + wi.extra + ' €' : '0 €';
  $('kr-wi').innerHTML = kv('Klein ablösbar ab', mOr(cur.firstK)) + kv('Beide ablösbar ab', mOr(cur.firstB)) + kv('Überschuss nach beiden Ablösungen', (cur.ueber >= 0 ? '+' : '−') + eur(Math.abs(cur.ueber)), cur.ueber >= 0 ? 'kr-ok' : 'kr-bad');

  const tj = kursRendite(P, S); let near = -1;
  if (tj) { let dmin = 1e9; SCEN.forEach((s, i) => { const x = Math.abs(s[1] / 100 - tj.r); if (x < dmin) { dmin = x; near = i; } }); }
  const sc = $('kr-scen-cur');
  if (sc) sc.textContent = tj ? 'Hervorgehoben: „' + SCEN[near][0] + '“ liegt am nächsten an eurem bisherigen Kurs. Das ist ein Rückblick, keine Prognose: Die Depots haben seit ' + mmY(tj.first) + ' (' + tj.n + (tj.n === 1 ? ' Monat' : ' Monate') + ') umgerechnet ' + (tj.r >= 0 ? '+' : '−') + (Math.abs(tj.r) * 100).toFixed(1).replace('.', ',') + ' % pro Jahr gebracht.' + (tj.ingHist && !tj.trHist ? ' ING zählt über die ganze Sparplan-Laufzeit, TR erst ab ' + mmY(tj.b0) + ', weil Sparplanstart und Einzahlungen für TR in den Einstellungen fehlen.' : !tj.ingHist && !tj.trHist ? ' Gemessen ab dem ersten Stand im Tool, weil Sparplanstart und Einzahlungen in den Einstellungen fehlen.' : !tj.ingHist ? ' TR zählt über die ganze Sparplan-Laufzeit, ING erst ab ' + mmY(tj.b0) + '.' : '') + (tj.n < 12 ? ' Über so kurze Zeit schwankt dieser Wert stark.' : '') : 'Sobald zwei Stände eingetragen sind, wird hier das Szenario markiert, das eurem bisherigen Kurs am nächsten kommt.';
  $('kr-scen').innerHTML = '<table class="kr-table"><thead><tr><th>Szenario</th><th>Rendite</th><th>Netto ' + mmY(cur.eK) + '</th><th>Netto ' + mmY(cur.eG) + '</th><th>Überschuss</th><th>Ampel</th></tr></thead><tbody>' +
    SCEN.map((s, i) => { const x = sim(P, S, { r: s[1] / 100, extra: wi.extra, baus: on }), good = x.ueber >= 0;
      return '<tr' + (i === near ? ' class="kr-cur"' : '') + '><td><strong>' + s[0] + '</strong>' + (i === near ? ' <span class="kr-pill" style="background:var(--accent);color:#fff;margin-left:.4rem">aktueller Kurs</span>' : '') + '</td><td class="kr-num">' + pct(s[1]) + '</td><td class="kr-num">' + eur(x.netK) + '</td><td class="kr-num">' + eur(x.netG) + '</td><td class="kr-num">' + (good ? '+' : '−') + eur(Math.abs(x.ueber)) + '</td><td><span class="kr-pill ' + (good ? 'ok">reicht' : 'bad">Lücke') + '</span></td></tr>'; }).join('') + '</tbody></table>';

  const frist = P.bausparerFrist || 0, hasB = P.bausparerBetrag > 0 && isYm(P.bausparerMonat), kb = hasB ? ymi(P.bausparerMonat) - frist : 0;
  const todo = ['Am ' + tag + '. des Monats: TR Cash, TR Portfolio und ING eintragen.',
    'Kredit klein sichern, sobald Vermögen netto die aktuelle Restschuld erreicht (' + eur(cur.kNow) + '). Es fehlen noch ' + eur(Math.max(0, cur.kNow - cur.netNow)) + '.',
    'Dann parken: klein ' + eur(cur.endK - bK) + (bK ? ' nur mit Bausparer (ohne ihn ' + eur(cur.endK) + ')' : '') + ', danach groß ' + eur(cur.endG) + '.'];
  if (hasB) todo.push('Bausparer: Zuteilung und Bonuszins prüfen. Bei Einsatz bis ' + mmY(kb) + ' kündigen (noch ' + Math.max(0, kb - nowM) + ' Monate).');
  todo.push('Dezember: Verlustbescheinigung prüfen (bis 15.12.), FSA-Verteilung fürs Folgejahr.');
  $('kr-cards').innerHTML =
    '<div class="kr-card" style="flex:1 1 260px"><h3 class="kr-h">Kredit klein</h3>' + kv('Restschuld heute', eur(cur.kNow)) + kv('Restschuld am Stichtag', eur(cur.endK)) + kv('Zinsbindungsende', mmY(cur.eK)) + kv('Ablösbar ab', mOr(cur.firstK)) + kv('Spätestens sichern ab', mmY(gl.gK)) + korBox('klein', nowM) + '</div>' +
    '<div class="kr-card" style="flex:1 1 260px"><h3 class="kr-h">Kredit groß</h3>' + kv('Restschuld heute', eur(cur.gNow)) + kv('Restschuld am Stichtag', eur(cur.endG)) + kv('Zinsbindungsende', mmY(cur.eG)) + kv('Beide ablösbar ab', mOr(cur.firstB)) + kv('Spätestens sichern ab', mmY(gl.gG)) + korBox('gross', nowM) + '</div>' +
    '<div class="kr-card kr-todo" style="flex:2 1 400px;background:var(--bg-subtle)"><h3 class="kr-h">Was jetzt zu tun ist</h3>' + todo.map(t => '<div>' + t + '</div>').join('') + '</div>';

  const ip = ingPerf(P, S), ie = $('kr-ing'), pc = v => (v >= 0 ? '+' : '−') + (Math.abs(v) * 100).toFixed(1).replace('.', ',') + ' %';
  if (ie && !ip) ie.innerHTML = '<div class="kr-sub">Für die Rendite in den Einstellungen den ING-Sparplanstart und den bis zum ersten Stand eingezahlten Betrag eintragen.</div>';
  if (ie && ip) { const l = ip[ip.length - 1];
    ie.innerHTML = '<div style="font-weight:700;margin-bottom:.6rem">Gesamtrendite ' + pc(l.gesamt) + ' · Rendite p.a. ' + pc(l.pa) + ' · eingezahlt ' + eur(l.paid) + ', Depotwert ' + eur(l.wert) + ' (Stand ' + mmY(l.m) + ')</div>' +
      '<div class="kr-scroll"><table class="kr-table"><thead><tr><th>Monat</th><th>Eingezahlt</th><th>Depotwert</th><th>Gewinn</th><th>Gesamtrendite</th><th>Rendite p.a.</th></tr></thead><tbody>' +
      ip.slice(-12).reverse().map(x => '<tr><td>' + mmY(x.m) + '</td><td class="kr-num">' + eur(x.paid) + '</td><td class="kr-num">' + eur(x.wert) + '</td><td class="kr-num">' + (x.wert >= x.paid ? '+' : '−') + eur(Math.abs(x.wert - x.paid)) + '</td><td class="kr-num">' + pc(x.gesamt) + '</td><td class="kr-num">' + pc(x.pa) + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div class="kr-sub" style="margin-top:.6rem">Rendite p.a. berücksichtigt, wann jede Sparrate eingezahlt wurde: der Zinssatz, den ein Sparkonto mit denselben Einzahlungen gebraucht hätte, um auf den Depotwert zu kommen. Gesamtrendite = Depotwert ÷ Einzahlungen − 1. Gerechnet mit gleichmäßigen Monatsraten ab Sparplanstart; Umschichtungen im Depot zählen nicht als Einzahlung.</div>'; }

  $('kr-rules').innerHTML = ['<strong>Sichern, sobald gedeckt – spätestens ' + (P.vorlauf || 24) + ' Monate vor Stichtag.</strong>',
    '1 · Trigger: Ihr könntet den Kredit heute ablösen (Vermögen netto ≥ aktuelle Restschuld). Aktion: Restschuld zum Stichtag aus Aktien in Cash oder Geldmarkt drehen. Cash ' + dec(P.cashZins || 0) + ' % gegen Kredit ' + dec(P.kleinZins) + ' %: Gesichertes Geld verdient mehr, als der Kredit kostet.',
    '2 · Nicht alles an einem Tag: Tranchen über Dezember und Januar (zwei Pauschbeträge), gewinnarme Positionen zuerst.',
    '3 · Gesichertes Geld zählt als Cash. Geldmarkt-ETF ist Cash, nicht Portfolio.',
    '4 · Notbremse: Falls bis ' + mmY(gl.gK) + ' (klein) bzw. ' + mmY(gl.gG) + ' (groß) nicht gedeckt, monatlich ' + eur(gl.mK) + ' bzw. ' + eur(gl.mG) + ' umschichten. Cash und Bausparer sind dabei angerechnet.',
    '5 · Zweiter Airbag: Bei Crash und günstigem Anschlusszins nicht ablösen, sondern Anschlussfinanzierung nehmen und Erholung abwarten.',
    hasB ? '6 · Bausparer: Der niedrigere Parkbetrag gilt nur, wenn der Bausparer für den kleinen Kredit eingesetzt wird. Vorher klären, ob er dann zuteilungsreif ist und ob die Schwelle für den rückwirkend höheren Zins erreicht ist. Wenn Warten mehr bringt: vollen Betrag parken und den Bausparer in den Einstellungen auf 0 setzen.' : ''
  ].filter(Boolean).map(t => '<div style="padding:.25rem 0">' + t + '</div>').join('');
}

function bwTable(last) {
  const L = BW().slice().sort((a, b) => ymi(a.monat) - ymi(b.monat));
  if (!L.length) return '';
  return '<div class="kr-scroll" style="margin-top:1rem"><table class="kr-table"><thead><tr><th>Monat</th><th>Betrag</th><th style="text-align:left">Notiz</th><th>Status</th><th></th></tr></thead><tbody>' + L.map(b => {
    const done = ymi(b.monat) <= last;
    return '<tr' + (done ? ' style="opacity:.55"' : '') + '><td>' + mmY(ymi(b.monat)) + '</td><td class="kr-num ' + (b.betrag >= 0 ? 'kr-ok' : 'kr-bad') + '">' + (b.betrag >= 0 ? '+' : '−') + eur(Math.abs(b.betrag)) + '</td><td style="text-align:left">' + esc(b.notiz || '') + '</td><td>' + (done ? 'im Stand enthalten' : '<span class="kr-pill ok">geplant</span>') + '</td><td><button type="button" class="kr-x" data-kr="bwdel" data-id="' + esc(b.id) + '" aria-label="Eintrag löschen">×</button></td></tr>';
  }).join('') + '</tbody></table></div>';
}

function renderKredit() {
  const root = document.getElementById('kredit-root');
  if (!root) return;
  if (!document.getElementById('kr-style')) { const st = document.createElement('style'); st.id = 'kr-style'; st.textContent = CSS; document.head.appendChild(st); }
  const k = K(), d = new Date(), curYm = iym(d.getFullYear() * 12 + d.getMonth());
  if (!ready()) {
    root.innerHTML = '<div class="kr-wrap"><div class="kr-card"><h3 class="kr-h">Kreditablösung einrichten</h3><p class="kr-sub">Erst die Einstellungen speichern, dann den ersten Stand eintragen. Restschulden und Einstand beziehen sich auf den Monat des ersten Stands. Alle Werte landen in eurer Daten-Datei, nicht im Programmcode.</p></div>' +
      '<div class="kr-card"><h3 class="kr-h">1 · Einstellungen' + (k && k.params ? ' (gespeichert)' : '') + '</h3>' + paramsForm(k && k.params) + '</div>' +
      '<div class="kr-card"><h3 class="kr-h">2 · Erster Stand</h3>' + standForm(curYm) + '</div></div>';
    return;
  }
  const P = k.params, S = k.staende, last = ymi(S[S.length - 1].monat);
  const rows = S.slice(-8).reverse().map(s => '<tr><td>' + mmY(ymi(s.monat)) + '</td><td class="kr-num">' + eur(s.cash) + '</td><td class="kr-num">' + eur(s.tr) + '</td><td class="kr-num">' + eur(s.ing) + '</td><td class="kr-num">' + eur(s.cash + s.tr + s.ing) + '</td><td class="kr-num">' + ((s.kaufTr || s.kaufIng) ? eur((s.kaufTr || 0) + (s.kaufIng || 0)) : '–') + '</td><td>' +
    (s.monat === S[0].monat ? '<span class="kr-sub">Basis</span>' : '<button type="button" class="kr-x" data-kr="del" data-m="' + esc(s.monat) + '" aria-label="Stand ' + mmY(ymi(s.monat)) + ' löschen">×</button>') + '</td></tr>').join('');
  root.innerHTML = '<div class="kr-wrap">' +
    '<div class="section-desc" style="margin:0" id="kr-status"></div><div id="kr-banner"></div>' +
    '<div class="kr-row" id="kr-kpis"></div>' +
    '<div class="kr-row"><div class="kr-card" style="flex:999 1 520px;min-width:0"><h3 class="kr-h">Reicht es?</h3><div id="kr-chart"></div><div class="kr-sub" id="kr-hover" style="margin-top:.5rem;min-height:2.4em"></div></div>' +
    '<div class="kr-card kr-ctl" style="flex:1 1 280px;display:flex;flex-direction:column;gap:.9rem"><h3 class="kr-h" style="margin:0">Was wäre, wenn</h3>' +
    '<div><label for="kr-r">Depotrendite pro Jahr <span class="kr-num" id="kr-r-l"></span></label><input type="range" id="kr-r" min="-10" max="10" step="1" value="' + wi.r + '"></div>' +
    '<div><label for="kr-x">Zusätzlich sparen pro Monat <span class="kr-num" id="kr-x-l"></span></label><input type="range" id="kr-x" min="0" max="1000" step="50" value="' + wi.extra + '"></div>' +
    (P.bausparerBetrag > 0 ? '<label style="justify-content:flex-start;align-items:center;cursor:pointer"><input type="checkbox" id="kr-b"' + (bausOn(P) ? ' checked' : '') + '> Bausparer einsetzen (' + eur(P.bausparerBetrag) + ' in ' + (isYm(P.bausparerMonat) ? mmY(ymi(P.bausparerMonat)) : '?') + ')</label>' : '') +
    '<div id="kr-wi" style="border-top:1px solid var(--line);padding-top:.7rem"></div><button class="btn btn-secondary" type="button" data-kr="reset">Zurück zum Plan</button></div></div>' +
    '<div class="kr-card"><h3 class="kr-h">Fünf Renditeszenarien</h3><div class="kr-scroll" id="kr-scen"></div><div class="kr-sub" style="margin-top:.6rem">Netto jeweils vor der Ablösung des im Monat fälligen Kredits, Steuerabschlag auf Kursgewinne abgezogen. Die Szenarien übernehmen Zusatz-Sparrate und Bausparer aus „Was wäre, wenn“.</div><div class="kr-sub" id="kr-scen-cur" style="margin-top:.4rem"></div></div>' +
    '<div class="kr-row" id="kr-cards"></div>' +
    '<div class="kr-card"><h3 class="kr-h">Stände eintragen</h3>' + standForm(iym(last + 1)) + '<div class="kr-scroll" style="margin-top:1rem"><table class="kr-table"><thead><tr><th>Monat</th><th>TR Cash</th><th>TR Portfolio</th><th>ING Depot</th><th>Summe</th><th>Depotkauf</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
    '<div class="kr-card"><h3 class="kr-h">Geplante Ein- und Auszahlungen Trade Republic Tagesgeld</h3><div class="kr-form">' +
    '<label class="kr-f">Monat<input type="month" id="kr-b-m" value="' + iym(last + 1) + '"></label>' +
    '<label class="kr-f">Betrag (€, Auszahlung mit Minus)<input type="text" inputmode="text" id="kr-b-v"></label>' +
    '<label class="kr-f" style="flex:2 1 260px">Notiz<input type="text" id="kr-b-n" maxlength="80" style="font-family:inherit"></label>' +
    '<button class="btn" type="button" data-kr="bw">Vormerken</button></div>' + bwTable(last) +
    '<div class="kr-sub" style="margin-top:.6rem">Einmalige Bewegungen neben den regelmäßigen Sparraten, zum Beispiel Bonus, Steuererstattung oder eine größere Ausgabe. Sie zählen in der Hochrechnung, bis für den Monat ein Stand eingetragen ist; danach steckt der Betrag im echten Cash-Wert. Passiert die Bewegung erst nach dem Eintragen des Monats, den Folgemonat wählen.</div></div>' +
    '<div class="kr-card"><h3 class="kr-h">ING-Depot – Rendite seit Start</h3><div id="kr-ing"></div></div>' +
    '<details class="kr-card"><summary>Regel fürs Sichern</summary><div id="kr-rules"></div></details>' +
    '<details class="kr-card"><summary>Einstellungen</summary>' + paramsForm(P) + '</details></div>';
  update();
}

/* ───────── Eingaben ───────── */
function saveParams(root) {
  const P = {}; let bad = null;
  FIELDS.forEach(f => {
    const el = root.querySelector('[data-p="' + f[0] + '"]'), raw = el ? el.value.trim() : '';
    if (f[2] === 'month') { if (raw && !isYm(raw)) bad = f[1]; P[f[0]] = raw; }
    else { const v = num(raw); if (raw !== '' && v === null) bad = f[1]; P[f[0]] = v === null ? 0 : v; }
    if (REQUIRED.indexOf(f[0]) >= 0 && raw === '') bad = f[1];
  });
  if (bad) { toast('Bitte prüfen: ' + bad); return; }
  if (ymi(P.kleinEnde) > ymi(P.grossEnde)) { toast('Kredit klein muss zuerst fällig sein'); return; }
  if (typeof pushHistory === 'function') pushHistory();
  if (!state.kredit) state.kredit = { params: null, staende: [] };
  state.kredit.params = P;
  commit(); toast('Einstellungen gespeichert');
}

function saveStand(root) {
  const g = id => root.querySelector('#' + id), m = g('kr-s-m').value, c = num(g('kr-s-c').value), t = num(g('kr-s-t').value), i = num(g('kr-s-i').value);
  if (!isYm(m) || c === null || t === null || i === null || c < 0 || t < 0 || i < 0) { toast('Bitte Monat und alle drei Beträge eintragen'); return; }
  if (!state.kredit) state.kredit = { params: null, staende: [] };
  const S = state.kredit.staende || (state.kredit.staende = []);
  if (S.length && ymi(m) < ymi(S[0].monat)) { toast('Der Monat liegt vor dem ersten Stand'); return; }
  const kt = num(g('kr-s-kt').value) || 0, ki = num(g('kr-s-ki').value) || 0, base = !S.length || m === S[0].monat;
  if (kt < 0 || ki < 0) { toast('Depotkäufe bitte als positive Beträge eintragen'); return; }
  if (typeof pushHistory === 'function') pushHistory();
  const at = S.findIndex(s => s.monat === m), rec = { monat: m, cash: c, tr: t, ing: i };
  if (!base && kt > 0) rec.kaufTr = kt;
  if (!base && ki > 0) rec.kaufIng = ki;
  if (at >= 0) S[at] = rec; else S.push(rec);
  S.sort((a, b) => ymi(a.monat) - ymi(b.monat));
  commit(); toast('Stand ' + mmY(ymi(m)) + ' gespeichert');
}

function saveKor(root, kredit) {
  const m = root.querySelector('[data-km="' + kredit + '"]').value, v = num(root.querySelector('[data-kv="' + kredit + '"]').value);
  const k = state.kredit, b0 = ymi(k.staende[0].monat), e = ymi(kredit === 'klein' ? k.params.kleinEnde : k.params.grossEnde);
  if (!isYm(m) || v === null || v < 0) { toast('Bitte Monat und Restschuld eintragen'); return; }
  if (ymi(m) < b0 || ymi(m) > e) { toast('Der Monat muss zwischen erstem Stand und Zinsbindungsende liegen'); return; }
  if (typeof pushHistory === 'function') pushHistory();
  if (!Array.isArray(k.korrekturen)) k.korrekturen = [];
  const at = k.korrekturen.findIndex(c => c.kredit === kredit && c.monat === m), rec = { kredit: kredit, monat: m, saldo: v };
  if (at >= 0) k.korrekturen[at] = rec; else k.korrekturen.push(rec);
  commit(); toast('Restschuld ' + (kredit === 'klein' ? 'klein' : 'groß') + ' zum 01.' + mmY(ymi(m)).replace('/', '.') + ' korrigiert');
}

function saveBw(root) {
  const m = root.querySelector('#kr-b-m').value, v = num(root.querySelector('#kr-b-v').value), n = root.querySelector('#kr-b-n').value.trim();
  if (!isYm(m) || v === null || v === 0) { toast('Bitte Monat und Betrag eintragen (Auszahlung mit Minus)'); return; }
  if (typeof pushHistory === 'function') pushHistory();
  if (!Array.isArray(state.kredit.bewegungen)) state.kredit.bewegungen = [];
  state.kredit.bewegungen.push({ id: Date.now().toString(36), monat: m, betrag: v, notiz: n });
  commit(); toast((v > 0 ? 'Einzahlung' : 'Auszahlung') + ' für ' + mmY(ymi(m)) + ' vorgemerkt');
}

function init() {
  const root = document.getElementById('kredit-root');
  if (!root) return;
  root.addEventListener('input', e => {
    if (!ready()) return;
    if (e.target.id === 'kr-r') { wi.r = Number(e.target.value); update(); }
    else if (e.target.id === 'kr-x') { wi.extra = Number(e.target.value); update(); }
  });
  root.addEventListener('change', e => { if (e.target.id === 'kr-b' && ready()) { wi.baus = e.target.checked; update(); } });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-kr]'); if (!b) return;
    const a = b.dataset.kr;
    if (a === 'reset') { wi = { r: 0, extra: 0, baus: null }; renderKredit(); }
    else if (a === 'params') saveParams(root);
    else if (a === 'stand') saveStand(root);
    else if (a === 'bw') saveBw(root);
    else if (a === 'kor') saveKor(root, b.dataset.k);
    else if (a === 'kordel') {
      const L = KOR(), at = L.findIndex(c => c.kredit === b.dataset.k && c.monat === b.dataset.m);
      if (at >= 0) { if (typeof pushHistory === 'function') pushHistory(); L.splice(at, 1); commit(); }
    }
    else if (a === 'bwdel') {
      const L = BW(), at = L.findIndex(x => String(x.id) === b.dataset.id);
      if (at >= 0) { if (typeof pushHistory === 'function') pushHistory(); L.splice(at, 1); commit(); }
    }
    else if (a === 'del') {
      const S = state.kredit.staende, at = S.findIndex(s => s.monat === b.dataset.m);
      if (at > 0 && confirm('Stand ' + mmY(ymi(b.dataset.m)) + ' löschen?')) { if (typeof pushHistory === 'function') pushHistory(); S.splice(at, 1); commit(); }
    }
  });
  root.addEventListener('mousemove', e => {
    const svg = e.target.closest && e.target.closest('#kr-svg'); if (!svg || !view) return;
    const r = svg.getBoundingClientRect(), i = Math.max(0, Math.min(view.n - 1, Math.round(((e.clientX - r.left) / r.width * view.W - view.L) / view.dx)));
    const hl = document.getElementById('kr-hl'), x = view.L + i * view.dx;
    hl.setAttribute('x1', x); hl.setAttribute('x2', x); hl.setAttribute('visibility', 'visible');
    document.getElementById('kr-hover').textContent = lab(view.cur.b0 + i) + ' · Vermögen netto ' + eur(view.cur.net[i]) + ' · offene Restschuld ' + eur(view.cur.rest[i]);
  });
  renderKredit();
}

if (typeof window !== 'undefined') { window.renderKredit = renderKredit; window.__krModel = { sim: sim, breakEven: breakEven, glide: glide, ingPerf: ingPerf, istRendite: istRendite, kursRendite: kursRendite }; }
if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }
})();

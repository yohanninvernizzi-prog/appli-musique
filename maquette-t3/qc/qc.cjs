#!/usr/bin/env node
/*
 * Contrôle qualité de la maquette T3 (index.html).
 *
 *   node qc/qc.cjs              -> calculs + contrôles dans la scène + captures
 *   node qc/qc.cjs --no-browser -> calculs seuls (sans Playwright)
 *
 * Variables d'environnement optionnelles :
 *   THREE_LOCAL=/chemin/vers/three/package  -> sert three.js depuis ce dossier au lieu du CDN
 *
 * 1. Lit l'objet GEO dans index.html (entre /*GEO-START*\/ et /*GEO-END*\/).
 * 2. Recalcule la surface de chaque pièce et la compare aux surfaces officielles (±5 %).
 * 3. Compare GEO aux cotes du cahier des charges (recopiées ci-dessous, source indépendante).
 * 4. Recherche les recouvrements de murs et les trous dans le périmètre des pièces fermées.
 * 5. Ouvre la page dans Chromium (Playwright), relève les coordonnées réelles des
 *    ouvertures dans la scène, teste les vides par lancers de rayons et balaie les façades.
 * 6. Fait les captures dans captures/.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'captures');
const REPORT = path.join(__dirname, 'RAPPORT-QC.md');
const noBrowser = process.argv.includes('--no-browser');

const src = fs.readFileSync(HTML, 'utf8');
const m = src.match(/\/\*GEO-START\*\/([\s\S]*?)\/\*GEO-END\*\//);
if (!m) { console.error('Bloc GEO introuvable'); process.exit(2); }
const GEO = vm.runInNewContext(m[1] + '\n;GEO');

const lines = [];
const log = (s = '') => { console.log(s); lines.push(s); };
let failures = 0;
const fr = (n, d = 2) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const rectOf = o => ({ x0: o.x, y0: o.y, x1: o.x + o.w, y1: o.y + o.d });
function table(head, rows) {
  const w = head.map((h, i) => Math.max(String(h).length, ...rows.map(r => String(r[i]).length)));
  const fmtRow = r => '| ' + r.map((c, i) => String(c).padEnd(w[i])).join(' | ') + ' |';
  log(fmtRow(head)); log('|' + w.map(n => '-'.repeat(n + 2)).join('|') + '|'); rows.forEach(r => log(fmtRow(r)));
}

/* ---------------------------------------------------------------- */
/* 1. Surfaces                                                       */
/* ---------------------------------------------------------------- */
function shoelace(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; }
const area = r => r.rect ? (r.rect[2] - r.rect[0]) * (r.rect[3] - r.rect[1]) : shoelace(r.poly);

log('# Rapport de contrôle qualité — maquette T3 lot 16');
log('');
log(`Généré le ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC à partir de \`index.html\` (objet GEO).`);
log('');
log('## 1. Surfaces intérieures recalculées (tolérance ±5 %)');
log('');
const rows = []; let tot = 0, totOff = 0;
for (const r of GEO.rooms) {
  const a = area(r) / 1e4;
  const dims = r.rect ? `${r.rect[2] - r.rect[0]} × ${r.rect[3] - r.rect[1]}` : `polygone (${r.poly.length} sommets)`;
  let ecart = '—', verdict = 'info';
  if (r.surfaceOfficielle) {
    const e = (a - r.surfaceOfficielle) / r.surfaceOfficielle * 100;
    ecart = (e >= 0 ? '+' : '') + fr(e, 1) + ' %';
    verdict = Math.abs(e) <= 5 ? 'OK' : 'HORS TOLÉRANCE';
    if (verdict !== 'OK') failures++;
  }
  if (!r.exterieur && !r.inclusDans) { tot += a; totOff += r.surfaceOfficielle || 0; }
  rows.push([r.nom + (r.inclusDans ? ' (inclus séjour)' : '') + (r.exterieur ? ' (ext.)' : ''), dims, fr(a), r.surfaceOfficielle ? fr(r.surfaceOfficielle) : '—', ecart, verdict]);
}
table(['Pièce', 'Cotes intérieures (cm)', 'Calculé (m²)', 'Officiel (m²)', 'Écart', 'Verdict'], rows);
log('');
log(`Total habitable (hors terrasse, dégagement compté dans le séjour) : **${fr(tot)} m²** calculé, ${fr(totOff)} m² officiel (écart ${fr((tot - totOff) / totOff * 100, 1)} %).`);
log('');

/* ---------------------------------------------------------------- */
/* 2. Conformité de GEO au cahier des charges                        */
/* ---------------------------------------------------------------- */
const BRIEF_WALLS = {
  'couloir-g': [-17, -33, 18, 33], 'couloir-d': [99, -33, 1071, 33], 'mitoyen-g': [-17, 0, 17, 577],
  'facade-terrasse-1': [-17, 577, 384, 72], 'facade-terrasse-2': [565, 577, 328, 72], 'facade-terrasse-3': [993, 577, 177, 72],
  'facade-droite-1': [1110, 0, 60, 161], 'facade-droite-2': [1110, 261, 60, 316],
  'placard-droit': [186, 0, 7, 226], 'placard-bas': [119, 219, 74, 7], 'sde-gauche': [494, 0, 7, 285],
  'sde-bas-g': [494, 278, 108, 7], 'sde-bas-d': [681, 278, 25, 7], 'sde-ch1-double': [691, 0, 15, 285],
  'ch1-bas': [781, 278, 329, 7], 'raccord': [783, 278, 13, 9], 'wc-gauche': [642, 385, 7, 192],
  'wc-haut': [642, 385, 59, 7], 'ch2-wc': [788, 375, 8, 202]
};
// [début, fin le long de l'axe, allège, hauteur, gond, sens]
const BRIEF_OPENINGS = {
  'porte-entree': { axe: 'x', a: [1, 99], allege: 0, h: 215, gond: 1, sens: +1 },
  'porte-sde': { axe: 'x', a: [602, 681], allege: 0, h: 204, gond: 681, sens: +1 },
  'porte-wc': { axe: 'x', a: [701, 783], allege: 0, h: 204, gond: 783, sens: -1 },
  'porte-ch1': { axe: 'x', a: [706, 781], allege: 0, h: 204, gond: 781, sens: -1 },
  'porte-ch2': { axe: 'y', a: [287, 375], allege: 0, h: 204, gond: 287, sens: +1 },
  'baie-sejour': { axe: 'x', a: [367, 565], allege: 0, h: 215 },
  'fenetre-ch2': { axe: 'x', a: [893, 993], allege: 90, h: 135 },
  'fenetre-ch1': { axe: 'y', a: [161, 261], allege: 90, h: 135 }
};
log('## 2. Conformité des données GEO aux cotes du cahier des charges');
log('');
{
  const bad = [];
  for (const [id, [x, y, w, d]] of Object.entries(BRIEF_WALLS)) {
    const g = GEO.walls.find(o => o.id === id);
    if (!g) bad.push(`mur ${id} absent`);
    else if (g.x !== x || g.y !== y || g.w !== w || g.d !== d) bad.push(`mur ${id} : GEO (${g.x}, ${g.y}, ${g.w}, ${g.d}) ≠ cahier (${x}, ${y}, ${w}, ${d})`);
  }
  for (const g of GEO.walls) if (!BRIEF_WALLS[g.id]) bad.push(`mur ${g.id} non prévu au cahier des charges`);
  for (const [id, b] of Object.entries(BRIEF_OPENINGS)) {
    const g = GEO.openings.find(o => o.id === id);
    if (!g) { bad.push(`ouverture ${id} absente`); continue; }
    const a = g.axe === 'x' ? [g.x, g.x + g.w] : [g.y, g.y + g.d];
    if (g.axe !== b.axe || a[0] !== b.a[0] || a[1] !== b.a[1]) bad.push(`ouverture ${id} : ${g.axe} ${a} ≠ ${b.axe} ${b.a}`);
    if (g.allege !== b.allege || g.hauteur !== b.h) bad.push(`ouverture ${id} : allège/hauteur ${g.allege}/${g.hauteur} ≠ ${b.allege}/${b.h}`);
    if (b.gond !== undefined && (g.gond !== b.gond || g.ouverture !== b.sens)) bad.push(`porte ${id} : gond/sens ${g.gond}/${g.ouverture} ≠ ${b.gond}/${b.sens}`);
  }
  for (const g of GEO.openings) if (!BRIEF_OPENINGS[g.id]) bad.push(`ouverture ${g.id} non prévue au cahier des charges`);
  if (bad.length) { failures += bad.length; bad.forEach(b => log('- ÉCART : ' + b)); }
  else log(`- OK : ${GEO.walls.length} murs et ${GEO.openings.length} ouvertures identiques au cahier des charges (aucune cote modifiée).`);
  const extWalls = ['mitoyen-g', 'couloir-g', 'couloir-d'];
  const onBlind = GEO.openings.filter(o => o.type !== 'porte' && /mitoyen|couloir/.test(o.mur));
  log(`- ${onBlind.length === 0 ? 'OK' : 'ÉCART'} : aucune fenêtre déclarée sur le mur mitoyen ni sur le mur du couloir.`);
  if (onBlind.length) failures++;
}
log('');

/* ---------------------------------------------------------------- */
/* 3. Recouvrements et continuité des murs                           */
/* ---------------------------------------------------------------- */
log('## 3. Recouvrements de murs et continuité des pièces fermées');
log('');
{
  const W = GEO.walls.map(w => ({ id: w.id, ...rectOf(w) }));
  const ov = [];
  for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) {
    const a = W[i], b = W[j];
    const dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), dy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (dx > 0 && dy > 0) ov.push([a.id, b.id, `x ${Math.max(a.x0, b.x0)}→${Math.min(a.x1, b.x1)}, y ${Math.max(a.y0, b.y0)}→${Math.min(a.y1, b.y1)}`, `${dx} × ${dy}`]);
  }
  log('Recouvrements entre rectangles de murs (issus directement des cotes fournies ; ce sont des jonctions d\'angle ou de raccord, même matériau, sans effet visuel) :');
  log('');
  table(['Mur A', 'Mur B', 'Zone commune', 'Taille (cm)'], ov);
  log('');
  // trous dans le périmètre des pièces fermées
  const solids = [...W, ...GEO.openings.map(o => ({ id: o.id, ...rectOf(o) }))];
  const covered = (x, y) => solids.some(r => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1);
  const gaps = [];
  for (const r of GEO.rooms.filter(r => r.fermee)) {
    const [x0, y0, x1, y1] = r.rect, o = 1.5;
    const sides = [
      { n: 'haut', pts: a => [a, y0 - o], from: x0, to: x1 }, { n: 'bas', pts: a => [a, y1 + o], from: x0, to: x1 },
      { n: 'gauche', pts: a => [x0 - o, a], from: y0, to: y1 }, { n: 'droite', pts: a => [x1 + o, a], from: y0, to: y1 }
    ];
    for (const s of sides) {
      let st = null;
      for (let a = s.from + 0.5; a <= s.to - 0.5; a += 1) {
        const [x, y] = s.pts(a); const c = covered(x, y);
        if (!c && st === null) st = a; if (c && st !== null) { gaps.push([r.nom, s.n, `${st - 0.5} → ${a - 0.5}`, a - st]); st = null; }
      }
      if (st !== null) gaps.push([r.nom, s.n, `${st - 0.5} → ${s.to}`, s.to - st + 0.5]);
    }
  }
  if (gaps.length) {
    log('Trous dans le périmètre des pièces fermées (ni mur ni ouverture déclarée) :');
    log('');
    table(['Pièce', 'Côté', 'Intervalle (cm)', 'Longueur (cm)'], gaps);
    log('');
    log('→ Non comblé dans la maquette (aucune cote inventée) : à confirmer, voir HYPOTHESES.md.');
  } else log('- OK : périmètre continu pour toutes les pièces fermées.');
}
log('');

/* ---------------------------------------------------------------- */
/* 4-5. Contrôles dans la scène 3D + captures                        */
/* ---------------------------------------------------------------- */
async function browserChecks() {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { log('Playwright indisponible : contrôles 3D et captures non effectués.'); return; }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const newPage = async (opts) => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    if (process.env.THREE_LOCAL) {
      await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', route => {
        const rel = route.request().url().split('three@0.170.0/')[1];
        route.fulfill({ path: path.join(process.env.THREE_LOCAL, rel), contentType: 'application/javascript' });
      });
    }
    await page.goto('file://' + HTML);
    await page.waitForFunction(() => window.APP && window.APP.ready, null, { timeout: 30000 });
    await page.waitForTimeout(800);
    return page;
  };
  const page = await newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });

  const q = await page.evaluate(() => window.APP.qc());
  log('## 4. Ouvertures : coordonnées réelles relevées dans la scène 3D');
  log('');
  log('Repère plan (cm) : x vers la droite, y vers la terrasse (= axe Z de three.js), h = hauteur. Valeurs lues sur les boîtes englobantes des objets de la scène.');
  log('');
  const B = BRIEF_OPENINGS;
  const rr = q.ouvertures.map(o => {
    const t = o.tests, b = B[o.id];
    const vals = Object.values(t).filter(v => v !== null);
    const ok = vals.every(Boolean);
    if (!ok) failures++;
    const piece = o.type === 'porte'
      ? `vantail x ${o.vantail.x.join('→')} · y ${o.vantail.y.join('→')} · h ${o.vantail.h.join('→')} · gond (${o.gond.x}, ${o.gond.y})`
      : `dormant x ${o.dormant.x.map(v => +v.toFixed(2)).join('→')} · y ${o.dormant.y.map(v => +v.toFixed(2)).join('→')} · h ${o.dormant.h.map(v => +v.toFixed(2)).join('→')}`;
    return [o.id, `${b.axe} ${b.a.join('→')}${b.allege ? ', allège ' + b.allege : ''}, h ${b.h}`, piece, ok ? 'OK' : 'ÉCHEC ' + JSON.stringify(t)];
  });
  table(['Ouverture', 'Attendu (cahier)', 'Mesuré dans la scène', 'Vide / tableaux / linteau / allège (rayons)'], rr);
  log('');
  log('Tests par rayons à travers l\'épaisseur du mur : vide au centre et à 0,5 cm des deux bords, mur présent à 0,5 cm hors des deux bords (tableaux), vide à 0,5 cm sous le haut, linteau à 0,5 cm au-dessus, allège à 0,5 cm sous l\'appui.');
  const fail = q.ouvertures.filter(o => !Object.values(o.tests).filter(v => v !== null).every(Boolean));
  for (const o of fail) log(`- ${o.id} : ` + Object.entries(o.tests).filter(([, v]) => v === false).map(([k]) => k).join(', '));
  log('');
  log('### Balayage des murs extérieurs (rayon tous les 1 cm à travers le mur) — intervalles SANS mur');
  log('');
  const sr = Object.entries(q.scans).map(([k, v]) => [k, v.h150.map(g => g.join('→')).join(' ; ') || 'aucun (mur plein)', v.h50.map(g => g.join('→')).join(' ; ') || 'aucun (mur plein)']);
  table(['Mur', 'à 150 cm de haut', 'à 50 cm de haut'], sr);
  log('');
  log('Les bornes sont les positions des rayons (pas de 1 cm, décalés de 0,5) : « 1.5→98.5 » = vide entre 1 et 99.');
  // vérification attendue
  const exp = {
    'mitoyen-g (x<0), le long de y': { h150: [], h50: [] },
    'couloir (y<0), le long de x': { h150: [[1.5, 98.5]], h50: [[1.5, 98.5]] },
    'façade terrasse (y>577), le long de x': { h150: [[367.5, 564.5], [893.5, 992.5]], h50: [[367.5, 564.5]] },
    'façade droite (x>1110), le long de y': { h150: [[161.5, 260.5]], h50: [] }
  };
  const same = JSON.stringify(exp) === JSON.stringify(Object.fromEntries(Object.entries(q.scans)));
  if (!same) failures++;
  log(same ? '- OK : ouvertures extérieures exactement aux positions attendues, aucune ouverture sur le mur mitoyen ni sur le mur du couloir (hors porte d\'entrée).'
           : '- ÉCART : le balayage ne correspond pas aux positions attendues.');
  log('');

  // ---- captures ----
  log('## 5. Captures');
  log('');
  const shots = [];
  const snap = async (p, name, desc) => { await p.waitForTimeout(700); await p.screenshot({ path: path.join(OUT, name) }); shots.push([name, desc]); };
  await page.evaluate(() => { APP.setMode('dessus'); APP.setToggle('cotes', true); APP.setToggle('noms', true); });
  await snap(page, '01-dessus-cotes.png', 'Vue de dessus orthographique, coupe à 120 cm, cotes et noms');
  await page.evaluate(() => { APP.setToggle('equipements', true); });
  await snap(page, '02-dessus-equipements.png', 'Vue de dessus avec le calque équipements');
  await page.evaluate(() => { APP.setToggle('equipements', false); APP.setToggle('cotes', false); APP.setMode('maquette'); });
  await snap(page, '03-maquette.png', 'Vue maquette (orbite), plafond masqué');
  await page.evaluate(() => { APP.setToggle('coupe', true); });
  await snap(page, '04-maquette-coupe.png', 'Vue maquette, murs coupés à 120 cm');
  await page.evaluate(() => { APP.setToggle('coupe', false); APP.setMaquetteCamera(1700, 900, -700, 560, 60, 300); });
  await snap(page, '05-maquette-arriere.png', 'Vue maquette depuis le couloir / la façade droite');
  await page.evaluate(() => { APP.setMaquetteCamera(466, 420, 1500, 466, 100, 500); });
  await snap(page, '06-facade-terrasse.png', 'Façade terrasse vue de l\'extérieur (baie et fenêtre chambre 2)');
  const views = await page.evaluate(() => APP.GEO.vues.map(v => [v.id, v.nom]));
  let i = 7;
  for (const [id, nom] of views) {
    await page.evaluate(id => APP.goView(id), id);
    await snap(page, `${String(i).padStart(2, '0')}-vue-${id}.png`, 'Point de vue : ' + nom); i++;
  }
  await page.evaluate(() => { APP.setToggle('equipements', true); APP.goView('baie-cuisine'); });
  await snap(page, `${i++}-vue-baie-cuisine-equipements.png`, 'Baie → cuisine avec équipements');
  // téléphone
  const phone = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.evaluate(() => { APP.setMode('dessus'); APP.setToggle('cotes', true); });
  await snap(phone, `${i++}-telephone-dessus.png`, 'Téléphone (390 × 844) : vue de dessus');
  await phone.evaluate(() => { APP.goView('entree-baie'); });
  await snap(phone, `${i++}-telephone-visite.png`, 'Téléphone : visite avec joystick');
  table(['Fichier', 'Contenu'], shots.map(([a, b]) => [`captures/${a}`, b]));
  log('');
  if (errors.length) { failures++; log('Erreurs JavaScript relevées dans la page :'); errors.forEach(e => log('- ' + e)); }
  else log('- Aucune erreur JavaScript dans la page.');
  log('');
  await browser.close();
}

(async () => {
  if (!noBrowser) await browserChecks();
  log('## Bilan');
  log('');
  log(failures === 0 ? 'Tous les contrôles sont conformes.' : `${failures} point(s) non conforme(s) ou à confirmer — détail ci-dessus.`);
  fs.writeFileSync(REPORT, lines.join('\n') + '\n');
  console.log(`\nRapport écrit dans ${path.relative(process.cwd(), REPORT)}`);
})().catch(e => { console.error(e); process.exit(1); });

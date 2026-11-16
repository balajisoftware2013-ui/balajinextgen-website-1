/* ═══ RECIPE COSTING · FOOD COST · CONSUMPTION · WASTAGE (2026-11-16) ══════════════════════════════════════════
   Needs bar-costing.gs (table helpers + name matcher) and store-registers.gs (bnxSrDate_) in the same project.

   UNIT ENGINE   every store item → how many ml / g / pieces one store unit holds (UOM + pack size in the name:
                 KG = 1000 g · LT = 1000 ml · B750 = 750 ml · "KASMIRI CHILLI POWDER 100 GM PKT" = 100 g ·
                 "500 ML X 24" case = 12,000 ml / 24 pcs · DZ = 12 pcs) and its rate (COST_PRICE, else the last
                 receipt rate in STOCK_MOVEMENT). Written to STORE_UNIT_CONVERSION (MASTER); fix a row there and set
                 STATUS = MANUAL to keep it. Recipe lines in ML / L / GM / KG / PC / DZ / DASH / TSP / TBSP / PEG are
                 costed from it (1 ml ≈ 1 g when the units cross; noted on the line).
   RECIPES       RECIPE_MASTER + RECIPE_ITEMS (MASTER) for food, beverages, cocktails and mocktails; bar recipes are
                 also kept in BAR_B10_COCKTAIL_RECIPE / BAR_B11_MOCKTAIL_RECIPE for the Bar Module.
   FOOD COST     actual = store issues to the kitchen departments; theoretical = items sold × recipe; wastage =
                 WASTAGE_MASTER; variance = issued − theoretical − wastage, per raw material, per month.

   Router lines (Code.gs, next to BAR_MAPPING_SAVE):
     case 'RECIPE_COSTING_LIST': result = bnxRecipeCostingList_(session, payload); break;
     case 'RECIPE_SAVE':         result = bnxRecipeSave_(session, payload); break;
     case 'RECIPE_DELETE':       result = bnxRecipeDelete_(session, payload); break;
     case 'FOOD_COST_REPORT':    result = bnxFoodCostReport_(session, payload); break;
     case 'WASTAGE_SAVE':        result = bnxWastageSave_(session, payload); break;
     case 'RECIPE_COSTING_REFRESH': result = bnxRecipeCostingRefresh_(session, payload); break;           */

function RUN_RECIPE_COSTING_Refresh() {   /* food + beverage recipes, then bar mapping / cocktails / mocktails */
  var r = bnxRecipeCostingRun_(BNX_BC_CID, {}); Logger.log('Recipes: ' + JSON.stringify(r.summary || r));
  var b = bnxBarCostingRun_(BNX_BC_CID, { write: true }); Logger.log('Bar: ' + JSON.stringify(b.summary || b));
}
function bnxRecipeCostingRefresh_(session, payload) {
  var r = bnxRecipeCostingRun_(session.CLIENT_ID, {});
  if (r.success === false) return r;
  var b = bnxBarCostingRun_(session.CLIENT_ID, { write: true });
  return { success: true, data: { summary: r.summary, bar: b.summary } };
}

/* ── units ── */
var BNX_RC_UNIT = { ML: ['V', 1], L: ['V', 1000], LT: ['V', 1000], LTR: ['V', 1000], LIT: ['V', 1000], LITRE: ['V', 1000], GAL: ['V', 3785], CL: ['V', 10],
  DASH: ['V', 1], TSP: ['V', 5], TBSP: ['V', 15], CUP: ['V', 240], PEG: ['V', 30], SHOT: ['V', 30], OZ: ['V', 30],
  G: ['M', 1], GM: ['M', 1], GMS: ['M', 1], GRM: ['M', 1], GRAM: ['M', 1], KG: ['M', 1000], KGS: ['M', 1000], MG: ['M', 0.001],
  PC: ['C', 1], PCS: ['C', 1], NO: ['C', 1], NOS: ['C', 1], EA: ['C', 1], EACH: ['C', 1], PIECE: ['C', 1], SLICE: ['C', 1], LEAF: ['C', 1], SPRIG: ['C', 1],
  DZ: ['C', 12], DOZ: ['C', 12], DOZEN: ['C', 12] };
function bnxRcUnit_(u) { var k = String(u || '').toUpperCase().replace(/[^A-Z]/g, ''); return BNX_RC_UNIT[k] ? { d: BNX_RC_UNIT[k][0], f: BNX_RC_UNIT[k][1], u: k } : null; }

/* how much one store unit holds: {V: ml, M: g, C: pcs, note} */
function bnxRcPack_(name, uom) {
  var n = String(name || '').toUpperCase(), u = String(uom || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), m, p = { note: '' };
  var size = null;
  if ((m = n.match(/(\d+(?:\.\d+)?)\s*(KGS?|GMS?|GRM|G|LTRS?|LTR|LT|L|ML)\b/))) { var su = bnxRcUnit_(m[2]); if (su) size = { d: su.d, q: Number(m[1]) * su.f }; }
  var cnt = (m = n.match(/\b(\d{1,3})\s*[X*]\s*\d+(?:\.\d+)?\s*(?:KGS?|GMS?|GRM|G|LTRS?|LTR|LT|L|ML)\b/) || n.match(/(?:\bX|\*)\s*(\d{1,3})\b(?!\s*(?:\.\d|KGS?\b|GMS?\b|G\b|LTR|LT\b|L\b|ML\b))/) ||
    n.match(/\b(\d{1,3})\s*(?:CN|CANS?|BTLS?|BOTTLES?|PCS?|NOS|PKTS?)\b/)) ? Number(m[1]) : 0;
  var bu = bnxRcUnit_(u);
  if ((m = u.match(/^B(\d{3,4})$/))) { p.V = Number(m[1]); p.C = 1; p.note = 'bottle ' + m[1] + ' ml'; return p; }
  if (bu && bu.d !== 'C') { p[bu.d] = bu.f; p.note = u.toLowerCase(); if (size && size.d === 'C') p.C = size.q; return p; }
  if (bu && bu.d === 'C') { p.C = bu.f; if (size) { p[size.d] = size.q * bu.f; p.note = (bu.f > 1 ? bu.f + ' pcs × ' : 'piece ') + size.q + (size.d === 'V' ? ' ml' : ' g'); } else p.note = bu.f > 1 ? bu.f + ' pcs' : 'per piece'; return p; }
  if (/^(CS|CA|CASE|BX|BOX|CRT|CRATE)$/.test(u)) {
    var c = cnt || (size && size.d === 'V' ? (size.q >= 600 ? 12 : 24) : 0);
    if (c) p.C = c; if (size && c) p[size.d] = c * size.q;
    p.note = 'case ' + (c ? c + ' pcs' : '? pcs') + (size ? ' × ' + size.q + (size.d === 'V' ? ' ml' : ' g') : '') + (cnt ? '' : (c ? ' (count assumed)' : ' – pack unknown'));
    return p;
  }
  p.C = cnt || 1;   /* PK / PKT / BTL / BT / TIN / JR / CAN / BK / CLY … = one pack */
  if (size) { p[size.d] = size.q * (cnt || 1); p.note = u.toLowerCase() + ' ' + size.q + (size.d === 'V' ? ' ml' : ' g'); }
  else if (/^(BTL|BT|BOTTLE)$/.test(u) && /\b(WHISK|VODKA|GIN|RUM|TEQUILA|BRANDY|COGNAC|WINE|CHAMPAGNE|MALT|LIQ)/.test(n)) { p.V = 750; p.note = 'bottle – assumed 750 ml'; }
  else p.note = (u || 'unit').toLowerCase() + ' – size not in name';
  return p;
}

/* store items with pack + rate; writes STORE_UNIT_CONVERSION when write=true */
var BNX_RC_CONV_COLS = ['STORE_ITEM_CODE', 'CLIENT_ID', 'STORE_ITEM_NAME', 'CATEGORY', 'UOM', 'ML_PER_UNIT', 'GM_PER_UNIT', 'PCS_PER_UNIT', 'RATE',
  'RATE_SOURCE', 'COST_PER_ML', 'COST_PER_GM', 'COST_PER_PC', 'NOTE', 'STATUS', 'UPDATED_AT'];
function bnxRcStore_(cid, db, write) {
  var N = function (v) { var x = Number(v); return isFinite(x) ? x : 0; };
  var last = {};
  try {
    bnxBcTable_(db.TRANSACTION, 'STOCK_MOVEMENT').rows.forEach(function (m) {
      if (!(N(m.QUANTITY_IN) > 0) || !(N(m.RATE) > 0) || /^SALE$/i.test(String(m.MOVEMENT_TYPE || ''))) return;
      if (/DEPARTMENT_ISSUE|TRANSFER/i.test(String(m.SOURCE_TYPE || '') + String(m.MOVEMENT_TYPE || ''))) return;
      var it = String(m.ITEM_ID || ''), d = bnxSrDate_(m.MOVEMENT_DATE); if (!it) return;
      if (!last[it] || d >= last[it].d) last[it] = { d: d, r: N(m.RATE) };
    });
  } catch (e) {}
  var t = bnxBcTable_(db.MASTER, 'STORE_UNIT_CONVERSION', BNX_RC_CONV_COLS), old = {};
  t.rows.forEach(function (r) { old[String(r.STORE_ITEM_CODE)] = r; });
  var bar = {}; try { bnxBcTable_(db.MASTER, 'BAR_STORE_CONVERSION').rows.forEach(function (r) { if (/MANUAL/i.test(String(r.STATUS || '')) && N(r.ML_PER_UNIT) > 0) bar[String(r.STORE_ITEM_CODE)] = N(r.ML_PER_UNIT); }); } catch (e) {}
  var items = {}, list = [];
  bnxBcTable_(db.MASTER, 'RAW_MATERIAL_MASTER').rows.forEach(function (r) {
    var code = String(r.ITEM_CODE || '').trim(); if (!code || items[code]) return;
    if (/INACTIVE/i.test(String(r.STATUS || ''))) return;
    var name = String(r.ITEM_NAME || ''), cat = String(r.CATEGORY || ''), uom = String(r.UOM || '');
    var p = bnxRcPack_(name, uom), o = old[code], manual = o && /MANUAL/i.test(String(o.STATUS || ''));
    if (/LIQU|BREWPUB/i.test(cat) || /^B\d{3,4}$/i.test(uom)) { var bc = bnxBcConv_(name, uom); if (bc.ml) { p.V = bc.ml; p.note = bc.note; if (bc.count) p.C = bc.count; } }
    if (bar[code]) { p.V = bar[code]; p.note = 'bar conversion (manual)'; }
    if (manual) { if (N(o.ML_PER_UNIT) > 0) p.V = N(o.ML_PER_UNIT); if (N(o.GM_PER_UNIT) > 0) p.M = N(o.GM_PER_UNIT); if (N(o.PCS_PER_UNIT) > 0) p.C = N(o.PCS_PER_UNIT); p.note = String(o.NOTE || 'manual'); }
    var rate = N(r.COST_PRICE), src = 'COST_PRICE';
    if (!(rate > 0) && last[code]) { rate = last[code].r; src = 'last receipt ' + last[code].d; }
    if (manual && N(o.RATE) > 0 && /manual/i.test(String(o.RATE_SOURCE || ''))) { rate = N(o.RATE); src = 'manual'; }
    if (!(rate > 0)) src = 'no rate';
    var s = { code: code, name: name, cat: cat, uom: uom, rate: rate, src: src, V: p.V || 0, M: p.M || 0, C: p.C || 0, note: p.note, manual: !!manual, t: bnxBcToks_(name) };
    s.k = s.t.join(' '); items[code] = s; list.push(s);
  });
  if (write) {
    var r4 = function (x) { return x ? Math.round(x * 10000) / 10000 : ''; }, now = new Date();
    t.rows = list.map(function (s) {
      return { STORE_ITEM_CODE: s.code, CLIENT_ID: cid, STORE_ITEM_NAME: s.name, CATEGORY: s.cat, UOM: s.uom, ML_PER_UNIT: s.V || '', GM_PER_UNIT: s.M || '', PCS_PER_UNIT: s.C || '',
        RATE: s.rate || '', RATE_SOURCE: s.src, COST_PER_ML: s.V ? r4(s.rate / s.V) : '', COST_PER_GM: s.M ? r4(s.rate / s.M) : '', COST_PER_PC: s.C ? r4(s.rate / s.C) : '',
        NOTE: s.note, STATUS: s.manual ? 'MANUAL' : (s.rate > 0 ? 'AUTO' : 'NO RATE'), UPDATED_AT: now };
    });
    bnxBcWrite_(t, true);
  }
  return { items: items, list: list };
}
/* cost of 1 recipe unit of a store item → {cost, note} */
function bnxRcUnitCost_(s, unit) {
  if (!s) return { cost: 0, note: 'store item not found' };
  var u = bnxRcUnit_(unit || 'ML');
  if (!u) { var uu = String(unit || '').toUpperCase(); if (uu && uu === String(s.uom).toUpperCase()) return { cost: s.rate, note: '' }; return { cost: 0, note: 'unit ' + unit + ' not known' }; }
  if (!(s.rate > 0)) return { cost: 0, note: 'no purchase rate for ' + s.name };
  var per = s[u.d], note = '';
  if (!per && u.d !== 'C' && s[u.d === 'V' ? 'M' : 'V']) { per = s[u.d === 'V' ? 'M' : 'V']; note = '1 ml ≈ 1 g'; }
  if (!per) return { cost: 0, note: 'set ' + (u.d === 'V' ? 'ML' : u.d === 'M' ? 'GM' : 'PCS') + '_PER_UNIT for ' + s.code + ' in STORE_UNIT_CONVERSION' };
  return { cost: s.rate / per * u.f, note: note };
}
/* store qty used by a recipe qty (for consumption) */
function bnxRcStoreQty_(s, qty, unit) {
  var u = bnxRcUnit_(unit || 'ML'); if (!s) return 0;
  if (!u) return String(unit || '').toUpperCase() === String(s.uom).toUpperCase() ? qty : 0;
  var per = s[u.d] || (u.d !== 'C' ? s[u.d === 'V' ? 'M' : 'V'] : 0);
  return per ? qty * u.f / per : 0;
}
function bnxRcResolve_(store, code, name, itmMap) {   /* RM code, POS item code (bar mapping) or name → store item */
  code = String(code || '').trim();
  if (code && store.items[code]) return store.items[code];
  if (code && itmMap && itmMap[code] && store.items[itmMap[code]]) return store.items[itmMap[code]];
  if (!name) return null;
  var bm = bnxBcBest_(name, store.list); return bm.s && bm.score >= 0.62 ? bm.s : null;
}

/* ── recost every recipe in RECIPE_MASTER / RECIPE_ITEMS whose lines are store items (food, beverage, mocktail) ── */
function bnxRecipeCostingRun_(cid, opt) {
  var t0 = Date.now();
  try {
    var db = bnxBcDbs_(cid), store = bnxRcStore_(cid, db, true), N = function (v) { var x = Number(v); return isFinite(x) ? x : 0; };
    var r2 = function (n) { return Math.round(N(n) * 100) / 100; }, r4 = function (n) { return Math.round(N(n) * 10000) / 10000; }, now = new Date();
    var rci = bnxBcTable_(db.MASTER, 'RECIPE_ITEMS', ['RAW_MATERIAL_ID', 'UNIT_COST', 'EXTENDED_COST', 'COST_SOURCE', 'COST_UPDATED_AT']);
    var rcm = bnxBcTable_(db.MASTER, 'RECIPE_MASTER', ['MATERIAL_COST', 'TOTAL_COST', 'COST_PER_YIELD', 'COST_STATUS', 'COST_UPDATED_AT']);
    var sum = {}, bad = {}, n = 0, ok = 0;
    rci.rows.forEach(function (r) {
      var comp = String(r.RAW_MATERIAL_ID || r.ITEM_ID || r.COMPONENT_ITEM_ID || '');
      if (!r.RECIPE_ID || /^ITM/i.test(String(r.ITEM_ID || r.COMPONENT_ITEM_ID || ''))) return;   /* bar spirit lines (POS item) → bar-costing.gs */
      if (!store.items[comp]) return;                                                               /* old bar ids (OLDMONKSPICE …) → bar-costing.gs */
      n++; var s = store.items[comp], q = N(r.QTY) || N(r.QUANTITY), w = N(r.WASTAGE_PCT) || N(r.WASTE_PERCENTAGE), c = bnxRcUnitCost_(s, r.UOM);
      if (c.cost > 0) {
        ok++; r.UNIT_COST = r4(c.cost); r.RAW_MATERIAL_ID = s.code; r.EXTENDED_COST = r2(q * (1 + w / 100) * c.cost);
        r.COST_SOURCE = s.code + ' ' + s.src + (c.note ? ' · ' + c.note : ''); r.COST_UPDATED_AT = now;
      } else { bad[r.RECIPE_ID] = 1; r.COST_SOURCE = c.note; }
      sum[r.RECIPE_ID] = (sum[r.RECIPE_ID] || 0) + q * (1 + w / 100) * N(r.UNIT_COST);
    });
    rcm.rows.forEach(function (r) {
      if (sum[r.RECIPE_ID] === undefined) return; var y = N(r.YIELD_QTY) || 1, v = sum[r.RECIPE_ID];
      r.MATERIAL_COST = r2(v); r.TOTAL_COST = r2(v + N(r.WASTAGE_COST)); r.COST_PER_YIELD = r2((v + N(r.WASTAGE_COST)) / y);
      r.COST_STATUS = bad[r.RECIPE_ID] ? 'PARTIAL' : 'OK'; r.COSTING_METHOD = 'Store rate ÷ unit conversion'; r.COST_UPDATED_AT = now;
    });
    bnxBcWrite_(rci); bnxBcWrite_(rcm);
    try { CacheService.getScriptCache().removeAll(['rcl_' + cid]); } catch (e) {}
    return { success: true, summary: { storeItems: store.list.length, withRate: store.list.filter(function (s) { return s.rate > 0; }).length,
      recipeLines: n, linesCosted: ok, recipesPartial: Object.keys(bad).length, ms: Date.now() - t0 } };
  } catch (e) { return { success: false, error: String(e && e.stack || e) }; }
}

/* ── list: menu items (scope FOOD | BAR) with recipe + cost, store items with unit costs ── */
function bnxRecipeCostingList_(session, payload) {
  try {
    var cid = session.CLIENT_ID, p = payload || {}, scope = String(p.scope || 'FOOD').toUpperCase(), db = bnxBcDbs_(cid), N = function (v) { var x = Number(v); return isFinite(x) ? x : 0; };
    var store = bnxRcStore_(cid, db, false), grp = {}, cat = {};
    bnxBcTable_(db.MASTER, 'ITEM_GROUP_MASTER').rows.forEach(function (r) { grp[r.ITEM_GROUP_ID] = String(r.ITEM_GROUP_NAME || ''); });
    bnxBcTable_(db.MASTER, 'CATEGORY_MASTER').rows.forEach(function (r) { cat[r.CATEGORY_ID] = String(r.CATEGORY_NAME || ''); });
    var bim = {}; bnxBcTable_(db.MASTER, 'BAR_ITEM_MASTER').rows.forEach(function (r) { if (r.ITEM_ID && !bim[r.ITEM_ID]) bim[String(r.ITEM_ID)] = r; });
    var itm2rm = {}; try { bnxBcTable_(db.MASTER, 'BAR_STORE_MAPPING').rows.forEach(function (r) { if (r.STORE_ITEM_CODE && !itm2rm[r.ITEM_ID]) itm2rm[String(r.ITEM_ID)] = String(r.STORE_ITEM_CODE); }); } catch (e) {}
    var rcm = bnxBcTable_(db.MASTER, 'RECIPE_MASTER').rows, rci = bnxBcTable_(db.MASTER, 'RECIPE_ITEMS').rows, lines = {}, imName = {};
    rci.forEach(function (r) { if (!r.RECIPE_ID) return; (lines[r.RECIPE_ID] = lines[r.RECIPE_ID] || []).push(r); });
    var byItem = {}, byName = {};
    rcm.forEach(function (r) { if (!r.RECIPE_ID || /INACTIVE/i.test(String(r.STATUS || ''))) return; if (r.ITEM_ID) byItem[String(r.ITEM_ID)] = r; if (r.RECIPE_NAME) byName[bnxBcNorm_(r.RECIPE_NAME)] = r; });
    var isBar = function (g, c, iid) { return /LIQUOR|BAR/i.test(g) || !!bim[iid]; };
    var isMock = function (g, c, name) { return /BEVERAGE/i.test(g) || /MOCKTAIL|DRINK & DRIVE|SHAKE|SMOOTHIE|JUICE|TEA|COFFEE|SODA|LEMONADE|COOLER/i.test(c + ' ' + name); };
    var items = [];
    var imRows = bnxBcTable_(db.MASTER, 'ITEM_MASTER').rows; imRows.forEach(function (r) { if (r.ITEM_ID) imName[String(r.ITEM_ID)] = String(r.ITEM_NAME || ''); });
    var seenName = {};
    imRows.forEach(function (r) {
      var iid = String(r.ITEM_ID || ''); if (!iid || !r.ITEM_NAME) return;
      var g = grp[r.ITEM_GROUP_ID] || '', c = cat[r.CATEGORY_ID] || '', name = String(r.ITEM_NAME), b = bim[iid];
      var kind, resale = null;
      if (scope === 'BAR') {
        if (!(isBar(g, c, iid) || /BEVERAGE/i.test(g))) return;
        var bc = String(b && b.BAR_CATEGORY || c);
        kind = /COCKTAIL|CLARIFIED|SHOTS|SPRITZ|PUNCH/i.test(bc) ? 'COCKTAIL' : (/DRINK & DRIVE|MOCKTAIL/i.test(bc) || (/BEVERAGE/i.test(g) && isMock(g, c, name))) ? 'MOCKTAIL' : null;
        if (!kind && !byItem[iid] && !byName[bnxBcNorm_(name)]) return;   /* straight pours are costed in Store Mapping */
        kind = kind || 'COCKTAIL'; c = bc;
        if (kind === 'MOCKTAIL' && !byItem[iid] && !byName[bnxBcNorm_(name)]) {   /* packaged drinks (water, cola, Red Bull) are resold as bought */
          var bm = bnxBcBest_(name, store.list); if (bm.s && bm.score >= 0.72 && /BEVERAGE|LIQU/i.test(bm.s.cat)) { kind = 'RESALE'; resale = bm.s; }
        }
      } else {
        if (isBar(g, c, iid) || /HUKKA|HOOKAH|TOBACCO|CIGAR|BEVERAGE/i.test(g + ' ' + c)) return;
        if (/POS CATEGORY|OPEN FOOD|FOOD PACKAGE|^OPEN /i.test(name)) return;
        kind = 'FOOD';
      }
      var nk = bnxBcNorm_(name) + '|' + kind; if (seenName[nk] && !byItem[iid]) return; seenName[nk] = 1;   /* same dish listed twice in ITEM_MASTER */
      var rc = byItem[iid] || byName[bnxBcNorm_(name)], ls = rc ? (lines[rc.RECIPE_ID] || []) : [];
      var price = N(b && b.SELLING_PRICE) || N(r.SELLING_RATE);
      items.push({ itemId: iid, name: name, group: g, category: c, kind: kind, price: price, active: String(r.MENU_ACTIVE) !== 'false' && r.MENU_ACTIVE !== false,
        recipeId: rc ? String(rc.RECIPE_ID) : '', yieldQty: rc ? N(rc.YIELD_QTY) || 1 : 1, yieldUom: rc ? String(rc.YIELD_UOM || 'PLATE') : '',
        cost: rc ? N(rc.COST_PER_YIELD) : (resale && resale.C ? Math.round(resale.rate / resale.C * 100) / 100 : 0), costStatus: rc ? String(rc.COST_STATUS || '') : (resale ? 'RESALE' : ''),
        resale: resale ? { code: resale.code, name: resale.name } : null,
        lines: ls.map(function (l) { var comp = String(l.RAW_MATERIAL_ID || l.ITEM_ID || l.COMPONENT_ITEM_ID || ''), s = store.items[comp] || store.items[itm2rm[String(l.ITEM_ID)] || ''];
          return { code: s ? s.code : comp, posCode: /^ITM/.test(String(l.ITEM_ID || '')) ? String(l.ITEM_ID) : '', name: s ? s.name : (imName[String(l.ITEM_ID)] || comp), qty: N(l.QTY) || N(l.QUANTITY), unit: String(l.UOM || ''),
            waste: N(l.WASTAGE_PCT) || N(l.WASTE_PERCENTAGE), unitCost: N(l.UNIT_COST), note: String(l.COST_SOURCE || '') }; }) });
    });
    var sold = bnxRcSold_(cid, db, p.from, p.to, scope);
    items.forEach(function (it) { var x = sold.items[it.itemId] || sold.items['#' + bnxBcNorm_(it.name)]; it.soldQty = x ? x.qty : 0; it.soldNet = x ? Math.round(x.net) : 0; });
    items.sort(function (a, b) { return (b.soldNet - a.soldNet) || (a.name < b.name ? -1 : 1); });
    var r4 = function (x) { return Math.round(x * 10000) / 10000; };
    return { success: true, data: { scope: scope, from: sold.from, to: sold.to, items: items,
      store: store.list.filter(function (s) { return !/STATIONERY|HOUSEKEEP|FUEL|GLASSWARE|^OTHERS$/i.test(s.cat); }).map(function (s) {
        return { code: s.code, name: s.name, cat: s.cat, uom: s.uom, rate: s.rate, src: s.src, ml: s.V ? r4(s.rate / s.V) : 0, gm: s.M ? r4(s.rate / s.M) : 0, pc: s.C ? r4(s.rate / s.C) : 0 }; }) } };
  } catch (e) { return { success: false, error: String(e && e.stack || e) }; }
}

/* sold qty per item in a period (TRANSACTION BILL_ITEMS, cancelled bills out, NC lines kept as consumption) */
function bnxRcSold_(cid, db, from, to, scope) {
  var today = Utilities.formatDate(new Date(Date.now() - 6 * 3600 * 1000), 'Asia/Kolkata', 'yyyy-MM-dd');
  to = bnxSrDate_(to) || today; from = bnxSrDate_(from) || (to.slice(5) >= '04-01' ? to.slice(0, 4) : String(+to.slice(0, 4) - 1)) + '-04-01';
  var ck = 'rcs_' + cid + '_' + from + '_' + to + '_' + scope, cache = CacheService.getScriptCache();
  try { var hit = cache.get(ck); if (hit) return JSON.parse(hit); } catch (e) {}
  var bm = db.TRANSACTION.getSheetByName('BILL_MASTER'), bi = db.TRANSACTION.getSheetByName('BILL_ITEMS'), bills = {}, out = { from: from, to: to, items: {}, byDay: {}, net: 0, lump: 0 };
  var day = function (sh, v) { return typeof bnxTlDay_ === 'function' ? bnxTlDay_(sh, v) : bnxSrDate_(v); };
  bnxBcTable_(db.TRANSACTION, 'BILL_MASTER').rows.forEach(function (r) {
    if (/CANCEL|VOID|DELETE/i.test(String(r.BILL_STATUS || ''))) return; var d = day(bm, r.BILL_DATE); if (d && d >= from && d <= to) bills[String(r.BILL_ID)] = d;
  });
  bnxBcTable_(db.TRANSACTION, 'BILL_ITEMS').rows.forEach(function (r) {
    var d = bills[String(r.BILL_ID)]; if (!d) return; var g = String(r.ITEM_GROUP_NAME || '').toUpperCase();
    if (scope === 'FOOD' ? !/FOOD/.test(g) : !/LIQUOR|BAR|BEVERAGE/.test(g)) return;
    var name = String(r.ITEM_NAME || ''), q = Number(r.QUANTITY) || 0, net = Number(r.TAXABLE_PER_ITEM) || 0;
    if (/POS CATEGORY|OPEN FOOD|FOOD PACKAGE/i.test(name)) { out.lump += net; out.net += net; var dl = out.byDay[d.slice(0, 7)] = out.byDay[d.slice(0, 7)] || { net: 0 }; dl.net += net; return; }
    var k = String(r.ITEM_ID || '') || '#' + bnxBcNorm_(name), x = out.items[k] = out.items[k] || { qty: 0, net: 0, name: name, group: g, days: {} };
    x.qty += q; x.net += net; x.days[d.slice(0, 7)] = (x.days[d.slice(0, 7)] || 0) + q; out.net += net;
    var dd = out.byDay[d.slice(0, 7)] = out.byDay[d.slice(0, 7)] || { net: 0 }; dd.net += net;
    if (r.ITEM_ID) { var nk = '#' + bnxBcNorm_(name); if (!out.items[nk]) out.items[nk] = x; }
  });
  try { var txt = JSON.stringify(out); if (txt.length < 95000) cache.put(ck, txt, to < today ? 1800 : 300); } catch (e) {}
  return out;
}

/* ── save one recipe { itemId, name, kind, yieldQty, yieldUom, lines:[{code, posCode, name, qty, unit, waste}] } ── */
function bnxRecipeSave_(session, payload) {
  try {
    var cid = session.CLIENT_ID, p = payload || {}, db = bnxBcDbs_(cid), now = new Date(), N = function (v) { var x = Number(v); return isFinite(x) ? x : 0; };
    var lines = (p.lines || []).filter(function (l) { return (l.code || l.posCode) && N(l.qty) > 0; });
    if (!p.itemId && !p.name) return { success: false, error: 'menu item missing' };
    if (!lines.length) return { success: false, error: 'add at least one ingredient with a quantity' };
    var store = bnxRcStore_(cid, db, false), kind = String(p.kind || '').toUpperCase();
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var rcm = bnxBcTable_(db.MASTER, 'RECIPE_MASTER', ['RECIPE_ID', 'CLIENT_ID', 'ITEM_ID', 'RECIPE_NAME', 'BASE_QTY', 'BASE_UOM', 'YIELD_QTY', 'YIELD_UOM', 'COSTING_METHOD', 'STATUS', 'CREATED_AT', 'UPDATED_AT', 'MATERIAL_COST', 'WASTAGE_COST', 'TOTAL_COST', 'COST_PER_YIELD', 'COST_STATUS', 'COST_UPDATED_AT']);
      var rci = bnxBcTable_(db.MASTER, 'RECIPE_ITEMS', ['RECIPE_ITEM_ID', 'CLIENT_ID', 'RECIPE_ID', 'RAW_MATERIAL_ID', 'ITEM_ID', 'QTY', 'UOM', 'WASTAGE_PCT', 'UNIT_COST', 'STATUS', 'CREATED_AT', 'UPDATED_AT', 'COMPONENT_ITEM_ID', 'QUANTITY', 'UNIT_ID', 'WASTE_PERCENTAGE', 'EFFECTIVE_QTY', 'EXTENDED_COST', 'WASTE_QTY', 'WASTE_COST', 'COST_SOURCE', 'COST_UPDATED_AT']);
      var rc = null, maxR = 0, maxI = 0;
      rcm.rows.forEach(function (r) { var m = String(r.RECIPE_ID || '').match(/(\d+)$/); if (m) maxR = Math.max(maxR, +m[1]);
        if (!rc && ((p.recipeId && String(r.RECIPE_ID) === String(p.recipeId)) || (p.itemId && String(r.ITEM_ID) === String(p.itemId) && !/INACTIVE/i.test(String(r.STATUS || ''))))) rc = r; });
      rci.rows.forEach(function (r) { var m = String(r.RECIPE_ITEM_ID || '').match(/(\d+)$/); if (m) maxI = Math.max(maxI, +m[1]); });
      if (!rc) { rc = { RECIPE_ID: 'RCP' + ('0000' + (maxR + 1)).slice(-5), CLIENT_ID: cid, CREATED_AT: now }; rcm.rows.push(rc); }
      var y = N(p.yieldQty) || 1, total = 0, partial = false, out = [];
      rci.rows = rci.rows.filter(function (r) { return String(r.RECIPE_ID) !== String(rc.RECIPE_ID); });
      lines.forEach(function (l) {
        var s = store.items[String(l.code || '')] || null, q = N(l.qty), w = N(l.waste), unit = String(l.unit || 'GM').toUpperCase(), c = bnxRcUnitCost_(s, unit);
        var cost = c.cost; if (!(cost > 0) && N(l.unitCost) > 0) cost = N(l.unitCost); if (!(cost > 0)) partial = true;
        var comp = l.posCode || (s ? s.code : String(l.code));
        total += q * (1 + w / 100) * cost;
        var row = { RECIPE_ITEM_ID: 'RCI' + ('0000' + (++maxI)).slice(-5), CLIENT_ID: cid, RECIPE_ID: rc.RECIPE_ID, RAW_MATERIAL_ID: s ? s.code : '', ITEM_ID: comp, QTY: q, UOM: unit,
          WASTAGE_PCT: w, UNIT_COST: Math.round(cost * 10000) / 10000, STATUS: 'ACTIVE', CREATED_AT: now, UPDATED_AT: now, COMPONENT_ITEM_ID: comp, QUANTITY: q, UNIT_ID: '',
          WASTE_PERCENTAGE: w, EFFECTIVE_QTY: Math.round(q * (1 + w / 100) * 1000) / 1000, EXTENDED_COST: Math.round(q * (1 + w / 100) * cost * 100) / 100,
          WASTE_QTY: Math.round(q * w / 100 * 1000) / 1000, WASTE_COST: Math.round(q * w / 100 * cost * 100) / 100, COST_SOURCE: s ? s.code + ' ' + s.src + (c.note ? ' · ' + c.note : '') : 'manual', COST_UPDATED_AT: now };
        rci.rows.push(row); out.push({ s: s, l: l, cost: cost, unit: unit, q: q });
      });
      rc.ITEM_ID = p.itemId || rc.ITEM_ID || ''; rc.RECIPE_NAME = p.name || rc.RECIPE_NAME; rc.BASE_QTY = 1; rc.BASE_UOM = p.yieldUom || 'PLATE'; rc.YIELD_QTY = y; rc.YIELD_UOM = p.yieldUom || 'PLATE';
      rc.STATUS = 'ACTIVE'; rc.UPDATED_AT = now; rc.MATERIAL_COST = Math.round(total * 100) / 100; rc.WASTAGE_COST = N(rc.WASTAGE_COST); rc.TOTAL_COST = Math.round((total + rc.WASTAGE_COST) * 100) / 100;
      rc.COST_PER_YIELD = Math.round((total + rc.WASTAGE_COST) / y * 100) / 100; rc.COST_STATUS = partial ? 'PARTIAL' : 'OK'; rc.COST_UPDATED_AT = now; rc.COSTING_METHOD = 'Store rate ÷ unit conversion';
      bnxBcWrite_(rcm); bnxBcWrite_(rci);
      /* bar recipes → Bar Module tabs too */
      if (kind === 'COCKTAIL' || kind === 'MOCKTAIL') {
        var tab = kind === 'COCKTAIL' ? 'BAR_B10_COCKTAIL_RECIPE' : 'BAR_B11_MOCKTAIL_RECIPE';
        var bt = bnxBcTable_(db.TRANSACTION, tab, ['RECIPE_ID', 'RECIPE_NAME', 'CATEGORY', 'PRICE', 'TAX', 'CLIENT_ID', 'ITEM_CODE', 'INGREDIENT', 'ML', 'UOM', 'COST_PER_ML', 'ACTIVE']);
        var other = bnxBcTable_(db.TRANSACTION, kind === 'COCKTAIL' ? 'BAR_B11_MOCKTAIL_RECIPE' : 'BAR_B10_COCKTAIL_RECIPE');
        var nm = bnxBcNorm_(rc.RECIPE_NAME), same = function (r) { return String(r.RECIPE_ID) === String(rc.RECIPE_ID) || bnxBcNorm_(r.RECIPE_NAME) === nm; };
        bt.rows = bt.rows.filter(function (r) { return !same(r); });
        out.forEach(function (o) { bt.rows.push({ RECIPE_ID: rc.RECIPE_ID, RECIPE_NAME: rc.RECIPE_NAME, CATEGORY: kind === 'COCKTAIL' ? 'Cocktail' : 'Mocktail', PRICE: N(p.price), TAX: '', CLIENT_ID: cid,
          ITEM_CODE: o.l.posCode || (o.s ? o.s.code : ''), INGREDIENT: o.l.name || (o.s ? o.s.name : ''), ML: o.q, UOM: o.unit, COST_PER_ML: Math.round(o.cost * 10000) / 10000, ACTIVE: true }); });
        bnxBcWrite_(bt, true);
        if (other.sh && other.rows.some(same)) { other.rows = other.rows.filter(function (r) { return !same(r); }); bnxBcWrite_(other, true); }
      }
    } finally { lock.releaseLock(); }
    try { CacheService.getScriptCache().removeAll(['rcl_' + cid]); } catch (e) {}
    if (kind === 'COCKTAIL' || kind === 'MOCKTAIL') { try { bnxBarCostingRun_(cid, { write: true }); } catch (e) {} }   /* re-cost Store Mapping + Code Master */
    return { success: true, data: { recipeId: rc.RECIPE_ID, costPerYield: rc.COST_PER_YIELD, status: rc.COST_STATUS } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
function bnxRecipeDelete_(session, payload) {
  try {
    var db = bnxBcDbs_(session.CLIENT_ID), id = String((payload || {}).recipeId || ''); if (!id) return { success: false, error: 'recipeId missing' };
    var rcm = bnxBcTable_(db.MASTER, 'RECIPE_MASTER'); rcm.rows.forEach(function (r) { if (String(r.RECIPE_ID) === id) { r.STATUS = 'INACTIVE'; r.UPDATED_AT = new Date(); } }); bnxBcWrite_(rcm);
    return { success: true };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* ── wastage { date, department, source:'KITCHEN'|'STORE', lines:[{code, qty, unit, reason}] } ── */
function bnxWastageSave_(session, payload) {
  try {
    var cid = session.CLIENT_ID, p = payload || {}, db = bnxBcDbs_(cid), store = bnxRcStore_(cid, db, false), now = new Date();
    var d = bnxSrDate_(p.date) || Utilities.formatDate(now, 'Asia/Kolkata', 'yyyy-MM-dd'), dept = String(p.department || 'MAIN KITCHEN').toUpperCase();
    var t = bnxBcTable_(db.TRANSACTION, 'WASTAGE_MASTER', ['WASTAGE_ID', 'CLIENT_ID', 'DATE', 'ITEM_CODE', 'ITEM_NAME', 'QTY', 'UOM', 'REASON', 'COST_VALUE', 'APPROVED_BY', 'DEPARTMENT', 'ENTRY_BY', 'TIME', 'ITEM_ID', 'CATEGORY', 'RATE', 'NOTES', 'VOUCHER_NO', 'SHIFT', 'REMARKS', 'INDENT_ID', 'CREATED_AT']);
    var vno = 'WST-' + d.replace(/-/g, '') + '-' + Utilities.formatDate(now, 'Asia/Kolkata', 'HHmmss'), n = 0, val = 0, mv = [];
    (p.lines || []).forEach(function (l, i) {
      var s = store.items[String(l.code || '')], q = Number(l.qty) || 0; if (!s || !(q > 0)) return;
      var unit = String(l.unit || s.uom), sq = String(unit).toUpperCase() === String(s.uom).toUpperCase() ? q : bnxRcStoreQty_(s, q, unit), v = Math.round(sq * s.rate * 100) / 100;
      t.rows.push({ WASTAGE_ID: vno + '-' + ('0' + (i + 1)).slice(-2), CLIENT_ID: cid, DATE: d, ITEM_CODE: s.code, ITEM_NAME: s.name, QTY: q, UOM: unit, REASON: String(l.reason || ''),
        COST_VALUE: v, APPROVED_BY: '', DEPARTMENT: dept, ENTRY_BY: session.USER_NAME || session.USER_ID || '', TIME: Utilities.formatDate(now, 'Asia/Kolkata', 'HH:mm'), ITEM_ID: s.code,
        CATEGORY: s.cat, RATE: s.rate, NOTES: 'store qty ' + Math.round(sq * 1000) / 1000 + ' ' + s.uom + (p.source === 'STORE' ? ' · from store stock' : ' · from issued kitchen stock'),
        VOUCHER_NO: vno, SHIFT: String(p.shift || ''), REMARKS: '', INDENT_ID: '', CREATED_AT: now });
      if (p.source === 'STORE') mv.push({ s: s, q: sq, v: v, i: i });
      n++; val += v;
    });
    if (!n) return { success: false, error: 'no valid lines (pick the item from the list and enter a quantity)' };
    bnxBcWrite_(t);
    if (mv.length) {   /* store wastage reduces store stock */
      var sm = bnxBcTable_(db.TRANSACTION, 'STOCK_MOVEMENT');
      mv.forEach(function (x) { sm.rows.push({ STOCK_MOVEMENT_ID: vno + '-' + (x.i + 1), CLIENT_ID: cid, ITEM_ID: x.s.code, LOCATION_ID: 'STORE', MOVEMENT_DATE: d, MOVEMENT_TYPE: 'WASTAGE',
        SOURCE_TYPE: 'WASTAGE', SOURCE_ID: vno, REFERENCE_NUMBER: vno, QUANTITY_IN: 0, QUANTITY_OUT: x.q, RATE: x.s.rate, NOTES: 'wastage · ' + dept, CREATED_AT: now }); });
      bnxBcWrite_(sm);
    }
    return { success: true, data: { voucherNo: vno, lines: n, value: Math.round(val * 100) / 100 } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* ── food cost report { from, to, departments:[…] } ── */
function bnxFoodCostReport_(session, payload) {
  var t0 = Date.now();
  try {
    var cid = session.CLIENT_ID, p = payload || {}, db = bnxBcDbs_(cid), N = function (v) { var x = Number(v); return isFinite(x) ? x : 0; };
    var r2 = function (n) { return Math.round(N(n) * 100) / 100; };
    var store = bnxRcStore_(cid, db, false), sold = bnxRcSold_(cid, db, p.from, p.to, 'FOOD'), from = sold.from, to = sold.to;
    var deptRe = p.departments && p.departments.length ? null : /MAIN KITCHEN|BAKERY|F&B|PRODUCTION/;
    var deptOk = function (d) { d = String(d || '').toUpperCase(); return deptRe ? deptRe.test(d) && !/HOUSE ?KEEP/.test(d) : p.departments.map(function (x) { return String(x).toUpperCase(); }).indexOf(d) >= 0; };
    /* recipes of food items */
    var rcm = bnxBcTable_(db.MASTER, 'RECIPE_MASTER').rows, rci = bnxBcTable_(db.MASTER, 'RECIPE_ITEMS').rows, lines = {}, recOf = {}, recName = {};
    rci.forEach(function (r) { if (r.RECIPE_ID && !/^ITM/i.test(String(r.ITEM_ID || ''))) (lines[r.RECIPE_ID] = lines[r.RECIPE_ID] || []).push(r); });
    rcm.forEach(function (r) { if (!r.RECIPE_ID || /INACTIVE/i.test(String(r.STATUS || '')) || !lines[r.RECIPE_ID]) return; if (r.ITEM_ID) recOf[String(r.ITEM_ID)] = r; if (r.RECIPE_NAME) recName['#' + bnxBcNorm_(r.RECIPE_NAME)] = r; });
    /* theoretical */
    var RM = {}, rmx = function (code) { var s = store.items[code] || {}; return RM[code] = RM[code] || { code: code, name: s.name || code, uom: s.uom || '', cat: s.cat || '', rate: s.rate || 0, issueQ: 0, issueV: 0, theoQ: 0, wasteQ: 0, wasteV: 0, used: {} }; };
    var theoV = 0, covNet = 0, items = [], seen = {};
    Object.keys(sold.items).forEach(function (k) {
      var x = sold.items[k]; if (seen[x.name + '|' + x.qty]) return; seen[x.name + '|' + x.qty] = 1;
      var rc = recOf[k] || recName['#' + bnxBcNorm_(x.name)], cost = rc ? N(rc.COST_PER_YIELD) : 0;
      items.push({ itemId: k.charAt(0) === '#' ? '' : k, name: x.name, qty: r2(x.qty), net: r2(x.net), recipe: !!rc, costPerPlate: r2(cost), theoCost: r2(cost * x.qty), fcPct: x.net && cost ? r2(cost * x.qty / x.net * 100) : '' });
      if (!rc) return; covNet += x.net; theoV += cost * x.qty; var y = N(rc.YIELD_QTY) || 1;
      lines[rc.RECIPE_ID].forEach(function (l) {
        var s = store.items[String(l.RAW_MATERIAL_ID || l.ITEM_ID || '')]; if (!s) return;
        var q = (N(l.QTY) || N(l.QUANTITY)) * (1 + (N(l.WASTAGE_PCT) || N(l.WASTE_PERCENTAGE)) / 100) / y * x.qty, sq = bnxRcStoreQty_(s, q, l.UOM);
        var m = rmx(s.code); m.theoQ += sq; m.used[x.name] = 1;
      });
    });
    /* actual issues to the kitchen departments */
    var dept = {}, deptTot = {}, month = {};
    bnxBcTable_(db.TRANSACTION, 'DEPARTMENT_ISSUE').rows.forEach(function (r) { var v = String(r.DEPARTMENT || '').toUpperCase(); if (r.ISSUE_ID) dept[String(r.ISSUE_ID)] = v; if (r.INDENT_ID && !dept[String(r.INDENT_ID)]) dept[String(r.INDENT_ID)] = v; });
    var issueV = 0;
    bnxBcTable_(db.TRANSACTION, 'STOCK_MOVEMENT').rows.forEach(function (m) {
      if (!/^DEPARTMENT_ISSUE$/i.test(String(m.SOURCE_TYPE || '')) || !(N(m.QUANTITY_OUT) > 0)) return;
      var d = bnxSrDate_(m.MOVEMENT_DATE); if (!d || d < from || d > to) return;
      var dp = dept[String(m.SOURCE_ID || '')] || ((String(m.NOTES || '').match(/issued to\s+([^·]+)/i) || [])[1] || '').trim().toUpperCase() || 'UNKNOWN';
      var s = store.items[String(m.ITEM_ID || '')], rate = m.RATE === '' || m.RATE === null ? (s ? s.rate : 0) : N(m.RATE), v = N(m.QUANTITY_OUT) * rate;
      deptTot[dp] = (deptTot[dp] || 0) + v; if (!deptOk(dp)) return;
      var x = rmx(String(m.ITEM_ID)); x.issueQ += N(m.QUANTITY_OUT); x.issueV += v; issueV += v;
      var mo = month[d.slice(0, 7)] = month[d.slice(0, 7)] || { month: d.slice(0, 7), issue: 0, waste: 0, sales: 0 }; mo.issue += v;
    });
    /* wastage */
    var wasteV = 0, wasteList = [];
    bnxBcTable_(db.TRANSACTION, 'WASTAGE_MASTER').rows.forEach(function (w) {
      var d = bnxSrDate_(w.DATE); if (!d || d < from || d > to || !deptOk(w.DEPARTMENT || 'MAIN KITCHEN')) return;
      var s = store.items[String(w.ITEM_CODE || w.ITEM_ID || '')], v = N(w.COST_VALUE); wasteV += v;
      if (s) { var x = rmx(s.code), u = String(w.UOM || s.uom); x.wasteQ += u.toUpperCase() === String(s.uom).toUpperCase() ? N(w.QTY) : bnxRcStoreQty_(s, N(w.QTY), u); x.wasteV += v; }
      var mo = month[d.slice(0, 7)] = month[d.slice(0, 7)] || { month: d.slice(0, 7), issue: 0, waste: 0, sales: 0 }; mo.waste += v;
      if (wasteList.length < 300) wasteList.push({ date: d, voucher: String(w.VOUCHER_NO || w.WASTAGE_ID || ''), item: String(w.ITEM_NAME || ''), qty: N(w.QTY), uom: String(w.UOM || ''), value: r2(v), reason: String(w.REASON || ''), dept: String(w.DEPARTMENT || '') });
    });
    Object.keys(sold.byDay).forEach(function (k) { var mo = month[k] = month[k] || { month: k, issue: 0, waste: 0, sales: 0 }; mo.sales += sold.byDay[k].net; });
    var rows = Object.keys(RM).map(function (k) {
      var x = RM[k], has = Object.keys(x.used).length > 0, varQ = x.issueQ - x.theoQ - x.wasteQ;
      return { code: x.code, name: x.name, cat: x.cat, uom: x.uom, rate: r2(x.rate), issueQ: r2(x.issueQ), issueV: r2(x.issueV), theoQ: has ? r2(x.theoQ) : '', theoV: has ? r2(x.theoQ * x.rate) : '',
        wasteQ: r2(x.wasteQ), wasteV: r2(x.wasteV), varQ: has ? r2(varQ) : '', varV: has ? r2(varQ * x.rate) : '', varPct: has && x.issueQ ? r2(varQ / x.issueQ * 100) : '',
        inRecipes: has ? Object.keys(x.used).length : 0 };
    }).sort(function (a, b) { return b.issueV - a.issueV; });
    var net = sold.net;
    return { success: true, data: { from: from, to: to,
      summary: { foodSales: r2(net), lumpSales: r2(sold.lump), actualCost: r2(issueV), actualPct: net ? r2(issueV / net * 100) : 0, theoCost: r2(theoV), coveredSales: r2(covNet),
        coveragePct: net ? r2(covNet / net * 100) : 0, theoPct: covNet ? r2(theoV / covNet * 100) : 0, wastage: r2(wasteV), wastagePct: net ? r2(wasteV / net * 100) : 0,
        itemsSold: items.length, itemsWithRecipe: items.filter(function (i) { return i.recipe; }).length, ms: Date.now() - t0 },
      departments: Object.keys(deptTot).map(function (k) { return { dept: k, value: r2(deptTot[k]), food: deptOk(k) }; }).sort(function (a, b) { return b.value - a.value; }),
      months: Object.keys(month).sort().map(function (k) { var m = month[k]; return { month: k, sales: r2(m.sales), issue: r2(m.issue), waste: r2(m.waste), pct: m.sales && m.issue ? r2(m.issue / m.sales * 100) : '' }; }),
      materials: rows, items: items.sort(function (a, b) { return b.net - a.net; }), wastage: wasteList } };
  } catch (e) { return { success: false, error: String(e && e.stack || e) }; }
}

/* ═══ BAR MAPPING · CONVERSION · COSTING (2026-11-16) ═══════════════════════════════════════════════════════
   One job links the bar menu to the store and costs every pour from actual purchase rates.

   1. BAR_STORE_CONVERSION (MASTER DB) – every store liquor / beverage / brew-pub item with its ml per store unit
      (B750 → 750 · B700 → 700 · CS "500 ML X 24" → 12,000 · BTL/CAN "330 ML" → 330 …), cost per unit
      (RAW_MATERIAL_MASTER.COST_PRICE = last receipt rate) and cost per ml.
   2. BAR_STORE_MAPPING (MASTER DB) – every BAR_ITEM_MASTER menu item → its store bottle, serve ml, cost per serve,
      GP % and pour-cost %. Cocktails / mocktails are costed from their recipe instead.
      STATUS: AUTO (sure match) · REVIEW (check it) · UNMAPPED · RECIPE · MANUAL.
      To correct a row, type the right STORE_ITEM_CODE (and SERVING_ML if needed) and set STATUS = MANUAL,
      or use Bar Module → 🔗 Store Mapping. MANUAL rows are never overwritten.
      In BAR_STORE_CONVERSION, change ML_PER_UNIT and set STATUS = MANUAL to fix a pack size.
   3. Writes the results where the screens read them:
      BAR_ITEM_MASTER  BOTTLE_SIZE / BOTTLE_SIZE_UOM / PURCHASE_UOM / UNITS_PER_PACK / BRAND (store item)
      BAR_B13_POS_ITEM_MAPPING  Bar Module Code Master layout (POS item → store item, serve ml, bottle ml, cost/ml)
      BAR_B10 / BAR_B11 recipes  COST_PER_ML per ingredient
      RECIPE_ITEMS  UNIT_COST / RAW_MATERIAL_ID · RECIPE_MASTER  MATERIAL_COST / TOTAL_COST / COST_PER_YIELD
      BAR_B2_STOCK_INWARD  BOTTLE_ML / QTY_ML filled where an issue line had no ml
   Run:   RUN_BAR_COSTING_Refresh   (editor, client CL00010)   or action BAR_COSTING_REFRESH from the Bar Module.
   Router lines (Code.gs, next to STORE_REGISTERS):
     case 'BAR_COSTING_REFRESH': result = bnxBarCostingRefresh_(session, payload); break;
     case 'GET_BAR_COSTING':     result = bnxGetBarCosting_(session, payload); break;
     case 'BAR_MAPPING_SAVE':    result = bnxBarMappingSave_(session, payload); break;                              */

var BNX_BC_CID = 'CL00010';
function RUN_BAR_COSTING_Refresh() {
  var r = bnxBarCostingRun_(BNX_BC_CID, { write: true });
  Logger.log(JSON.stringify(r.summary || r, null, 1));
}
function RUN_BAR_COSTING_Check() {   /* dry run – nothing written */
  var r = bnxBarCostingRun_(BNX_BC_CID, { write: false });
  Logger.log(JSON.stringify(r.summary || r, null, 1));
  (r.review || []).slice(0, 60).forEach(function (m) { Logger.log('%s | %s → %s (%s)', m.status, m.menu, m.store, m.score); });
}

function bnxBarCostingRefresh_(session, payload) {
  var r = bnxBarCostingRun_(session.CLIENT_ID, { write: true });
  return r.success === false ? r : { success: true, data: { summary: r.summary } };
}
function bnxGetBarCosting_(session, payload) {
  try {
    var db = bnxBcDbs_(session.CLIENT_ID), map = bnxBcTable_(db.MASTER, 'BAR_STORE_MAPPING'), conv = bnxBcTable_(db.MASTER, 'BAR_STORE_CONVERSION');
    if (!map.rows.length) { var r = bnxBarCostingRun_(session.CLIENT_ID, { write: true }); if (r.success === false) return r; map = bnxBcTable_(db.MASTER, 'BAR_STORE_MAPPING'); conv = bnxBcTable_(db.MASTER, 'BAR_STORE_CONVERSION'); }
    var pick = function (o) { var x = {}; Object.keys(o).forEach(function (k) { var v = o[k]; x[k] = v instanceof Date ? Utilities.formatDate(v, 'Asia/Kolkata', 'yyyy-MM-dd HH:mm') : v; }); return x; };
    return { success: true, data: { mapping: map.rows.map(pick), conversion: conv.rows.map(pick) } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
/* payload { rows:[{BAR_ITEM_ID, STORE_ITEM_CODE, SERVING_ML}] , conversion:[{STORE_ITEM_CODE, ML_PER_UNIT}] } → MANUAL, then re-cost */
function bnxBarMappingSave_(session, payload) {
  try {
    var cid = session.CLIENT_ID, db = bnxBcDbs_(cid), p = payload || {};
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var t = bnxBcTable_(db.MASTER, 'BAR_STORE_MAPPING', BNX_BC_MAP_COLS), ix = {};
      t.rows.forEach(function (r, i) { ix[String(r.BAR_ITEM_ID || r.ITEM_ID)] = i; });
      (p.rows || []).forEach(function (u) {
        var i = ix[String(u.BAR_ITEM_ID || u.ITEM_ID || '')]; if (i === undefined) return;
        var r = t.rows[i]; r.STORE_ITEM_CODE = String(u.STORE_ITEM_CODE || '').trim();
        if (u.SERVING_ML !== undefined && u.SERVING_ML !== '') r.SERVING_ML = Number(u.SERVING_ML) || r.SERVING_ML;
        r.STATUS = r.STORE_ITEM_CODE ? 'MANUAL' : (u.UNMAP ? 'MANUAL' : 'UNMAPPED'); r.UPDATED_BY = session.USER_NAME || session.USER_ID || '';
      });
      bnxBcWrite_(t);
      if ((p.conversion || []).length) {
        var c = bnxBcTable_(db.MASTER, 'BAR_STORE_CONVERSION', BNX_BC_CONV_COLS), cx = {};
        c.rows.forEach(function (r, i) { cx[String(r.STORE_ITEM_CODE)] = i; });
        p.conversion.forEach(function (u) { var i = cx[String(u.STORE_ITEM_CODE || '')]; if (i === undefined || !(Number(u.ML_PER_UNIT) > 0)) return;
          c.rows[i].ML_PER_UNIT = Number(u.ML_PER_UNIT); c.rows[i].STATUS = 'MANUAL'; c.rows[i].NOTE = 'set by ' + (session.USER_NAME || 'user'); });
        bnxBcWrite_(c);
      }
    } finally { lock.releaseLock(); }
    var r = bnxBarCostingRun_(cid, { write: true });
    return r.success === false ? r : { success: true, data: { summary: r.summary } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

var BNX_BC_CONV_COLS = ['STORE_ITEM_CODE', 'CLIENT_ID', 'STORE_ITEM_NAME', 'CATEGORY', 'UOM', 'PIECE_ML', 'PIECES_PER_UNIT', 'ML_PER_UNIT',
  'COST_PER_UNIT', 'COST_PER_ML', 'CURRENT_STOCK', 'STOCK_ML', 'NOTE', 'STATUS', 'UPDATED_AT'];
var BNX_BC_MAP_COLS = ['ITEM_ID', 'CLIENT_ID', 'BAR_ITEM_ID', 'MENU_ITEM_NAME', 'BAR_CATEGORY', 'SERVING_SIZE', 'SERVING_ML', 'SELLING_PRICE',
  'STORE_ITEM_CODE', 'STORE_ITEM_NAME', 'STORE_UOM', 'ML_PER_UNIT', 'COST_PER_ML', 'COST_PER_SERVING', 'GP_AMOUNT', 'GP_PCT', 'POUR_COST_PCT',
  'MATCH_SCORE', 'STATUS', 'NOTE', 'UPDATED_AT', 'UPDATED_BY'];

function bnxBarCostingRun_(cid, opt) {
  var t0 = Date.now();
  try {
    opt = opt || {}; var write = opt.write !== false, now = new Date();
    var db = bnxBcDbs_(cid), N = function (v) { var n = Number(v); return isFinite(n) ? n : 0; };
    var r2 = function (n) { return Math.round(N(n) * 100) / 100; }, r4 = function (n) { return Math.round(N(n) * 10000) / 10000; };

    /* ── 1. store items + conversion ── */
    var rm = bnxBcTable_(db.MASTER, 'RAW_MATERIAL_MASTER').rows, rmBy = {};
    rm.forEach(function (r) { var c = String(r.ITEM_CODE || '').trim(); if (c) rmBy[c] = r; });
    var conv = bnxBcTable_(db.MASTER, 'BAR_STORE_CONVERSION', BNX_BC_CONV_COLS), convOld = {};
    conv.rows.forEach(function (r) { convOld[String(r.STORE_ITEM_CODE)] = r; });
    var barCat = /LIQU|BREWPUB|BEVERAGE|BEER|WINE|SPIRIT|BAR/i, store = [], storeBy = {};
    Object.keys(rmBy).forEach(function (code) {
      var r = rmBy[code], name = String(r.ITEM_NAME || ''), cat = String(r.CATEGORY || '');
      if (!barCat.test(cat) && !/\b(WHISK|VODKA|GIN|RUM|BEER|WINE|TEQUILA|BRANDY|COGNAC|LIQ)/i.test(name)) return;
      if (/INACTIVE/i.test(String(r.STATUS || ''))) return;
      var cv = bnxBcConv_(name, r.UOM), old = convOld[code];
      if (old && /MANUAL/i.test(String(old.STATUS || '')) && N(old.ML_PER_UNIT) > 0) {
        cv = { piece: N(old.PIECE_ML) || cv.piece, count: N(old.PIECES_PER_UNIT) || cv.count, ml: N(old.ML_PER_UNIT), note: String(old.NOTE || 'manual'), manual: true };
      }
      var cost = N(r.COST_PRICE), s = { code: code, name: name, cat: cat, uom: String(r.UOM || ''), cost: cost, stock: N(r.CURRENT_STOCK),
        piece: cv.piece, count: cv.count, ml: cv.ml, note: cv.note, manual: !!cv.manual, cpm: cv.ml > 0 && cost > 0 ? cost / cv.ml : 0, t: bnxBcToks_(name) };
      s.k = s.t.join(' '); store.push(s); storeBy[code] = s;
    });
    var convRows = store.map(function (s) {
      return { STORE_ITEM_CODE: s.code, CLIENT_ID: cid, STORE_ITEM_NAME: s.name, CATEGORY: s.cat, UOM: s.uom, PIECE_ML: s.piece || '', PIECES_PER_UNIT: s.count || '',
        ML_PER_UNIT: s.ml || '', COST_PER_UNIT: r2(s.cost), COST_PER_ML: s.cpm ? r4(s.cpm) : '', CURRENT_STOCK: s.stock, STOCK_ML: s.ml ? Math.round(s.stock * s.ml) : '',
        NOTE: s.note, STATUS: s.manual ? 'MANUAL' : (s.ml ? (/assumed/.test(s.note) ? 'CHECK' : 'AUTO') : 'NO ML'), UPDATED_AT: now };
    }).sort(function (a, b) { return a.CATEGORY < b.CATEGORY ? -1 : a.CATEGORY > b.CATEGORY ? 1 : (a.STORE_ITEM_NAME < b.STORE_ITEM_NAME ? -1 : 1); });

    /* ── 2. menu → store ── */
    var im = {}; bnxBcTable_(db.MASTER, 'ITEM_MASTER').rows.forEach(function (r) { if (r.ITEM_ID) im[String(r.ITEM_ID)] = r; });
    var card = {}; bnxBcTable_(db.MASTER, 'BAR_MENU_CARD').rows.forEach(function (r) { if (r.ITEM_ID) card[String(r.ITEM_ID)] = r; });
    var bim = bnxBcTable_(db.MASTER, 'BAR_ITEM_MASTER', ['BRAND', 'BOTTLE_SIZE', 'BOTTLE_SIZE_UOM', 'PURCHASE_UOM', 'UNITS_PER_PACK']);
    var mapT = bnxBcTable_(db.MASTER, 'BAR_STORE_MAPPING', BNX_BC_MAP_COLS), mapOld = {};
    mapT.rows.forEach(function (r) { mapOld[String(r.BAR_ITEM_ID || r.ITEM_ID)] = r; });

    /* recipes (cocktails / mocktails): B10 + B11 in the TRANSACTION DB, RECIPE_MASTER in the MASTER DB */
    var b10 = bnxBcTable_(db.TRANSACTION, 'BAR_B10_COCKTAIL_RECIPE'), b11 = bnxBcTable_(db.TRANSACTION, 'BAR_B11_MOCKTAIL_RECIPE');
    var rcm = bnxBcTable_(db.MASTER, 'RECIPE_MASTER'), rci = bnxBcTable_(db.MASTER, 'RECIPE_ITEMS', ['RAW_MATERIAL_ID', 'UNIT_COST']);
    var recipeName = {}, recipeItem = {}, oldCpm = {};   /* old SLG cost/ml per POS item – used only when the store item has no cost price */
    [b10, b11].forEach(function (t) { t.rows.forEach(function (r) { if (r.ITEM_CODE && N(r.COST_PER_ML) > 0 && !oldCpm[r.ITEM_CODE]) oldCpm[String(r.ITEM_CODE)] = N(r.COST_PER_ML); }); });
    rci.rows.forEach(function (r) { var k = String(r.ITEM_ID || r.COMPONENT_ITEM_ID || ''); if (k && /^ML$/i.test(String(r.UOM || '')) && N(r.UNIT_COST) > 0 && !oldCpm[k]) oldCpm[k] = N(r.UNIT_COST); });
    [b10, b11].forEach(function (t) { t.rows.forEach(function (r) { if (r.RECIPE_NAME) recipeName[bnxBcNorm_(r.RECIPE_NAME)] = 1; }); });
    rcm.rows.forEach(function (r) { if (r.ITEM_ID && !/INACTIVE/i.test(String(r.STATUS || ''))) recipeItem[String(r.ITEM_ID)] = String(r.RECIPE_ID); if (r.RECIPE_NAME) recipeName[bnxBcNorm_(r.RECIPE_NAME)] = 1; });

    var maps = {}, byItm = {}, cnt = { AUTO: 0, REVIEW: 0, UNMAPPED: 0, RECIPE: 0, MANUAL: 0 };
    bim.rows.forEach(function (b) {
      var iid = String(b.ITEM_ID || ''), bid = String(b.BAR_ITEM_ID || '') || iid + '|' + String(b.SERVING_SIZE || ''); if (!iid) return;
      var it = im[iid] || {}, name = String(it.ITEM_NAME || b.ITEM_NAME || '').trim(); if (!name) return;
      var old = mapOld[bid], cat = String(b.BAR_CATEGORY || ''), price = N(b.SELLING_PRICE) || N(it.SELLING_RATE);
      var m = { ITEM_ID: iid, CLIENT_ID: cid, BAR_ITEM_ID: String(b.BAR_ITEM_ID || ''), MENU_ITEM_NAME: name, BAR_CATEGORY: cat, SERVING_SIZE: String(b.SERVING_SIZE || ''),
        SELLING_PRICE: price, UPDATED_AT: now, UPDATED_BY: old ? (old.UPDATED_BY || '') : '' };
      var s = null, score = 0, status;
      if (old && /MANUAL/i.test(String(old.STATUS || ''))) {
        s = storeBy[String(old.STORE_ITEM_CODE || '').trim()] || null; score = 1; status = 'MANUAL';
        if (N(old.SERVING_ML) > 0) m.SERVING_ML = N(old.SERVING_ML);
      } else if (recipeItem[iid] || recipeName[bnxBcNorm_(name)] || /COCKTAIL|MOCKTAIL|DRINK & DRIVE|SHOTS|CLARIFIED|SPRITZ|PUNCH/i.test(cat) || /^VIRGIN\b/i.test(name)) {
        status = 'RECIPE';
      } else {
        var bm = bnxBcBest_(name, store); s = bm.s; score = bm.score;
        status = !s ? 'UNMAPPED' : score >= 0.70 ? 'AUTO' : score >= 0.50 ? 'REVIEW' : 'UNMAPPED';
        if (status === 'UNMAPPED') s = null;
      }
      if (!m.SERVING_ML) m.SERVING_ML = bnxBcServeMl_(b.SERVING_SIZE, name, cat, s, card[iid], price);
      m.MATCH_SCORE = status === 'RECIPE' ? '' : Math.round(score * 100) / 100; m.STATUS = status; cnt[status]++;
      m.NOTE = '';
      if (s) {
        m.STORE_ITEM_CODE = s.code; m.STORE_ITEM_NAME = s.name; m.STORE_UOM = s.uom; m.ML_PER_UNIT = s.ml || '';
        m.COST_PER_ML = s.cpm ? r4(s.cpm) : '';
        if (!s.ml) m.NOTE = 'store pack size unknown – set ML_PER_UNIT in BAR_STORE_CONVERSION';
        else if (!s.cost && oldCpm[iid]) { m.COST_PER_ML = r4(oldCpm[iid]); m.NOTE = 'store item has no cost price – old SLG cost/ml used'; }
        else if (!s.cost) m.NOTE = 'store item has no cost price';
      } else {
        m.STORE_ITEM_CODE = status === 'MANUAL' && old ? String(old.STORE_ITEM_CODE || '') : ''; m.STORE_ITEM_NAME = ''; m.STORE_UOM = ''; m.ML_PER_UNIT = ''; m.COST_PER_ML = '';
        if (status === 'UNMAPPED') m.NOTE = /CRAFT BEER|BREW/i.test(cat) ? 'brew-pub beer – no store bottle' : /HUKKA|CIGAR|TOBACCO|ADD-ON/i.test(cat) ? 'not a liquor item' : 'no store item found – pick it in Store Mapping (or add a recipe if it is a cocktail)';
      }
      maps[bid] = { m: m, s: s, iid: iid }; if (s && s.cpm && !byItm[iid]) byItm[iid] = s;
    });

    /* ── 3. recipe costing ── */
    /* cost of one recipe unit: spirits per ml from the bar conversion; mixers / garnish / syrups (ML, GM, PC, DASH …)
       from the store unit engine (recipe-costing.gs) */
    var eng = null, itmRm = {};
    try { if (typeof bnxRcStore_ === 'function') eng = bnxRcStore_(cid, db, false); } catch (e) {}
    var ingCost = function (itemCode, ingName, uom) {
      var u = String(uom || 'ML').toUpperCase().replace(/[^A-Z]/g, '') || 'ML';
      if (u === 'ML') {
        var ms = byItm[String(itemCode || '')];
        if (ms) return { cpm: ms.cpm, s: ms, liq: /LIQU|BREWPUB/i.test(ms.cat) };
        if (storeBy[String(itemCode || '')] && storeBy[String(itemCode)].cpm) { var s0 = storeBy[String(itemCode)]; return { cpm: s0.cpm, s: s0, liq: /LIQU|BREWPUB/i.test(s0.cat) }; }
        var bm = ingName ? bnxBcBest_(ingName, store) : { s: null };
        if (bm.s && bm.score >= 0.62 && bm.s.cpm) return { cpm: bm.s.cpm, s: bm.s, liq: /LIQU|BREWPUB/i.test(bm.s.cat) };
      }
      if (!eng) return null;
      var es = bnxRcResolve_(eng, itemCode, ingName, itmRm); if (!es) return null;
      var c = bnxRcUnitCost_(es, u); if (!(c.cost > 0)) return null;
      return { cpm: c.cost, s: { code: es.code, name: es.name, piece: 0, ml: es.V, count: es.C, cpm: u === 'ML' ? c.cost : 0 }, liq: /LIQU|BREWPUB/i.test(es.cat) };
    };
    Object.keys(maps).forEach(function (k) { var o = maps[k]; if (o.s && !itmRm[o.iid]) itmRm[o.iid] = o.s.code; });
    var recipeCost = {}, ingAlias = {}, b10cost = {}, b10n = 0, b10u = 0;
    [b10, b11].forEach(function (t) {
      t.rows.forEach(function (r) {
        if (!r.RECIPE_NAME) return; var k = bnxBcNorm_(r.RECIPE_NAME), ml = N(r.ML);
        var rc = recipeCost[k] = recipeCost[k] || { cost: 0, ok: true, price: N(r.PRICE) };
        if (!r.INGREDIENT && !ml) return; b10n++;
        var c = ingCost(r.ITEM_CODE, r.INGREDIENT, r.UOM), ik = bnxBcNorm_(r.INGREDIENT);
        if (c) { r.COST_PER_ML = r4(c.cpm); b10u++; b10cost[String(r.RECIPE_ID) + '|' + String(r.ITEM_CODE || '')] = c; if (c.liq || /^ML$/i.test(String(r.UOM || 'ML'))) ingAlias[ik] = { name: String(r.INGREDIENT), code: String(r.ITEM_CODE || ''), s: c.s }; }
        else if (!(N(r.COST_PER_ML) > 0)) rc.ok = false;
        rc.lines = (rc.lines || 0) + 1; if (c && !c.liq) rc.mixers = (rc.mixers || 0) + 1;
        rc.seen = rc.seen || {}; if (rc.seen[ik + '|' + ml]) rc.dup = String(r.INGREDIENT); rc.seen[ik + '|' + ml] = 1;
        rc.cost += ml * N(r.COST_PER_ML);
      });
    });
    var rciByRecipe = {}, rciN = 0, rciU = 0;
    rci.rows.forEach(function (r) {
      if (!r.RECIPE_ID) return; rciN++;
      var uom = String(r.UOM || 'ML').toUpperCase(), ic = String(r.ITEM_ID || r.COMPONENT_ITEM_ID || ''), c = null;
      c = b10cost[String(r.RECIPE_ID) + '|' + ic] || ingCost(ic, String((im[ic] || {}).ITEM_NAME || ''), uom || 'ML');
      var q = N(r.QTY) || N(r.QUANTITY), w = N(r.WASTAGE_PCT) || N(r.WASTE_PERCENTAGE);
      if (c) {
        r.UNIT_COST = r4(c.cpm); r.RAW_MATERIAL_ID = c.s.code; rciU++;
        r.EFFECTIVE_QTY = r2(q * (1 + w / 100)); r.EXTENDED_COST = r2(q * c.cpm); r.WASTE_QTY = r2(q * w / 100); r.WASTE_COST = r2(q * w / 100 * c.cpm);
        r.COST_SOURCE = 'Store ' + c.s.code + ' cost/' + (uom || 'ML').toLowerCase(); r.COST_UPDATED_AT = now;
      }
      rciByRecipe[r.RECIPE_ID] = (rciByRecipe[r.RECIPE_ID] || 0) + q * N(r.UNIT_COST) * (1 + w / 100);
    });
    rcm.rows.forEach(function (r) {
      var v = rciByRecipe[r.RECIPE_ID]; if (v === undefined) return;
      var y = N(r.YIELD_QTY) || 1, wc = N(r.WASTAGE_COST);
      r.MATERIAL_COST = r2(v); r.TOTAL_COST = r2(v + wc); r.COST_PER_YIELD = r2((v + wc) / y);
      r.COSTING_METHOD = 'Store rate ÷ unit conversion'; r.UPDATED_AT = now;
      if (r.RECIPE_NAME) { var k = bnxBcNorm_(r.RECIPE_NAME); if (!recipeCost[k]) recipeCost[k] = { cost: N(r.COST_PER_YIELD), ok: true }; }
      if (r.ITEM_ID) recipeCost['#' + r.ITEM_ID] = { cost: N(r.COST_PER_YIELD), ok: true };
    });

    /* ── 4. serve cost, GP, pour cost ── */
    var rows = [], review = [];
    Object.keys(maps).forEach(function (bid) {
      var o = maps[bid], m = o.m, iid = o.iid, cost = 0;
      if (m.STATUS === 'RECIPE') {
        var rc = recipeCost['#' + iid] || recipeCost[bnxBcNorm_(m.MENU_ITEM_NAME)];
        cost = rc ? rc.cost : 0;
        m.NOTE = rc ? (rc.ok ? 'recipe cost' : 'recipe cost – some ingredients not costed') + (rc.lines && !rc.mixers ? ' · spirits only – add mixers / garnish for full cost' : '') + (rc.dup ? ' · ' + rc.dup + ' listed twice – check' : '')
                    : 'no recipe – add it in 🍸 Cocktail & Mocktail recipes';
        if (!rc) m.STATUS = 'RECIPE?';
      } else if (o.s && N(m.COST_PER_ML) > 0) cost = N(m.SERVING_ML) * N(m.COST_PER_ML);
      m.COST_PER_SERVING = cost ? r2(cost) : '';
      m.GP_AMOUNT = cost && m.SELLING_PRICE ? r2(m.SELLING_PRICE - cost) : '';
      m.GP_PCT = cost && m.SELLING_PRICE ? r2((m.SELLING_PRICE - cost) / m.SELLING_PRICE * 100) : '';
      m.POUR_COST_PCT = cost && m.SELLING_PRICE ? r2(cost / m.SELLING_PRICE * 100) : '';
      if (cost && m.SELLING_PRICE && cost > m.SELLING_PRICE) m.NOTE = (m.NOTE ? m.NOTE + ' · ' : '') + 'cost above selling price – check serve ml / mapping';
      else if (cost && m.SELLING_PRICE && cost / m.SELLING_PRICE < 0.03) m.NOTE = (m.NOTE ? m.NOTE + ' · ' : '') + 'pour cost under 3% – check serve ml (bottle sold as peg?)';
      rows.push(m);
      if (/REVIEW|UNMAPPED|RECIPE\?/.test(m.STATUS) || /above selling|under 3%/.test(m.NOTE)) review.push({ status: m.STATUS, menu: m.MENU_ITEM_NAME, store: m.STORE_ITEM_NAME, score: m.MATCH_SCORE });
    });
    var order = { 'REVIEW': 0, 'UNMAPPED': 1, 'RECIPE?': 2, 'AUTO': 3, 'MANUAL': 4, 'RECIPE': 5 };
    rows.sort(function (a, b) { return (order[a.STATUS] - order[b.STATUS]) || (a.BAR_CATEGORY < b.BAR_CATEGORY ? -1 : a.BAR_CATEGORY > b.BAR_CATEGORY ? 1 : (a.MENU_ITEM_NAME < b.MENU_ITEM_NAME ? -1 : 1)); });

    /* ── 5. write ── */
    var b2fix = 0, b13n = 0, bimN = 0;
    if (write) {
      conv.rows = convRows; bnxBcWrite_(conv, true);
      mapT.rows = rows; bnxBcWrite_(mapT, true);
      bim.rows.forEach(function (b) {
        var o = maps[String(b.BAR_ITEM_ID || '') || String(b.ITEM_ID || '') + '|' + String(b.SERVING_SIZE || '')]; if (!o || !o.s) return; var s = o.s; bimN++;
        b.BRAND = s.name; b.BOTTLE_SIZE = s.piece || s.ml || ''; b.BOTTLE_SIZE_UOM = 'ML'; b.PURCHASE_UOM = s.uom; b.UNITS_PER_PACK = s.count || 1;
      });
      bnxBcWrite_(bim);
      bnxBcWrite_(b10); bnxBcWrite_(b11); bnxBcWrite_(rci); bnxBcWrite_(rcm);
      /* Bar Module Code Master: [ID, ITEM_CODE, POS_NAME, STORE_ITEM, SELL_ML, ISSUE_ML, CONV, OUTLET, GROUP, COST_PER_ML] */
      var b13 = bnxBcSheet_(db.TRANSACTION, 'BAR_B13_POS_ITEM_MAPPING'), cmRows = bnxBarCodeMasterRows_(cid, rows, storeBy, ingAlias);
      if (b13.getLastRow() > 1 && String(b13.getRange(1, 1).getValue()) !== 'CM_ID') {      /* old recipe-layout copy → keep a backup once */
        var bk = 'BAR_B13_BACKUP_' + Utilities.formatDate(now, 'Asia/Kolkata', 'yyyyMMdd');
        if (!b13.getParent().getSheetByName(bk)) b13.copyTo(b13.getParent()).setName(bk);
      }
      b13.clearContents();
      var cmH = ['CM_ID', 'ITEM_CODE', 'POS_NAME', 'STORE_ITEM', 'SELL_ML', 'ISSUE_ML', 'CONV', 'OUTLET_ID', 'GROUP', 'COST_PER_ML', 'STORE_ITEM_CODE', 'STATUS'];
      b13.getRange(1, 1, 1, cmH.length).setValues([cmH]);
      if (cmRows.length) { bnxBcEnsureRows_(b13, cmRows.length + 1); b13.getRange(2, 1, cmRows.length, cmH.length).setValues(cmRows); }
      b13n = cmRows.length;
      /* store → bar issue lines without ml */
      var b2 = bnxBcTable_(db.TRANSACTION, 'BAR_B2_STOCK_INWARD');
      b2.rows.forEach(function (r) {
        if (N(r.QTY_ML) > 0) return; var s = storeBy[String(r.ITEM_CODE || '')]; if (!s || !s.ml) return;
        r.BOTTLE_ML = s.ml; r.QTY_ML = Math.round(N(r.QTY_BTL) * s.ml * 100) / 100; r.UOM = 'ML'; b2fix++;
      });
      if (b2fix) bnxBcWrite_(b2);
      try { CacheService.getScriptCache().removeAll(['bartdb_' + cid]); } catch (e) {}
    }
    var summary = { client: cid, written: write, storeItems: store.length, storeWithMl: store.filter(function (s) { return s.ml; }).length,
      storeCosted: store.filter(function (s) { return s.cpm; }).length, menuItems: rows.length, status: cnt,
      recipeLines: b10n, recipeLinesCosted: b10u, recipeItems: rciN, recipeItemsCosted: rciU, barItemMasterFilled: bimN, codeMasterRows: b13n,
      b2LinesGivenMl: b2fix, review: review.length, ms: Date.now() - t0 };
    return { success: true, summary: summary, review: review };
  } catch (e) { return { success: false, error: String(e && e.stack || e) }; }
}

/* Code Master rows for the Bar Module (menu items + recipe ingredient names → store item) */
function bnxBarCodeMasterRows_(cid, rows, storeBy, ingAlias) {
  var out = [], seen = {};
  rows.slice().sort(function (a, b) { return (Number(a.SERVING_ML) || 0) - (Number(b.SERVING_ML) || 0); }).forEach(function (m) {
    if (!m.STORE_ITEM_CODE || !m.STORE_ITEM_NAME || seen['#' + m.ITEM_ID]) return; var s = storeBy[m.STORE_ITEM_CODE] || {}; seen['#' + m.ITEM_ID] = 1;
    out.push(['CM-' + m.ITEM_ID, m.ITEM_ID, m.MENU_ITEM_NAME, m.STORE_ITEM_NAME, Number(m.SERVING_ML) || 30, s.piece || s.ml || 750, s.count || 1, cid, m.BAR_CATEGORY, m.COST_PER_ML || 0, m.STORE_ITEM_CODE, m.STATUS]);
    seen[bnxBcNorm_(m.MENU_ITEM_NAME)] = 1;
  });
  Object.keys(ingAlias).forEach(function (k) {
    var a = ingAlias[k]; if (!k || seen[k] || !a.s) return; seen[k] = 1;
    out.push(['CM-ING-' + a.s.code + '-' + out.length, a.code, a.name, a.s.name, 0, a.s.piece || a.s.ml || 750, a.s.count || 1, cid, 'RECIPE INGREDIENT', a.s.cpm ? Math.round(a.s.cpm * 10000) / 10000 : 0, a.s.code, 'RECIPE']);
  });
  return out;
}

/* ── conversion: ml per store unit from UOM + name ── */
function bnxBcConv_(name, uom) {
  var n = String(name || '').toUpperCase(), u = String(uom || '').toUpperCase().replace(/\s+/g, ''), m;
  var size = 0;
  if ((m = n.match(/(\d+(?:\.\d+)?)\s*(ML|LTR|LT|L)\b/))) size = /^L/.test(m[2]) ? Number(m[1]) * 1000 : Number(m[1]);
  else if ((m = n.match(/\b(180|200|250|275|300|330|375|500|650|700|750|1000)\b/))) size = Number(m[1]);
  if ((m = u.match(/^B(\d{3,4})$/))) return { piece: Number(m[1]), count: 1, ml: Number(m[1]), note: 'bottle ' + m[1] + ' ml' };
  if (/^(CS|CA|CASE|CRT|CRATE)$/.test(u)) {
    var pk = n.match(/(?:\bX|\*)\s*(\d{1,2})\b/) || n.match(/\b(\d{1,2})\s*(?:X|\*)\s*\d/) || n.match(/\b(\d{1,2})\s*(?:CN|CANS?|BTLS?|BOTTLES?|PCS?)\b/);
    var cnt = pk ? Number(pk[1]) : (size >= 600 ? 12 : 24);
    if (size) return { piece: size, count: cnt, ml: cnt * size, note: 'case ' + cnt + ' × ' + size + ' ml' + (pk ? '' : ' (assumed ' + cnt + ' per case)') };
    return { piece: 0, count: cnt, ml: 0, note: 'case – pack size unknown' };
  }
  if (/^(LTR|LT|L|LITRE)$/.test(u)) return { piece: 1000, count: 1, ml: 1000, note: 'litre' };
  if (/^ML$/.test(u)) return { piece: 1, count: 1, ml: 1, note: 'per ml' };
  if (/^(BTL|BT|BOTTLE|CAN|CN|NO|NOS|PC|PCS|PK|PKT|TIN|JAR)$/.test(u) && size) return { piece: size, count: 1, ml: size, note: u.toLowerCase() + ' ' + size + ' ml' };
  if (/^(BTL|BT|BOTTLE)$/.test(u) && /\b(WHISK|VODKA|GIN|RUM|TEQUILA|BRANDY|COGNAC|WINE|CHAMPAGNE|MALT|LIQ)/.test(n)) return { piece: 750, count: 1, ml: 750, note: 'bottle – assumed 750 ml' };
  return { piece: 0, count: 0, ml: 0, note: 'ml not known (' + (u || 'no UOM') + ')' };
}

/* ── serve ml of a menu item ── */
function bnxBcServeMl_(sz, name, cat, s, card, price) {
  var z = String(sz || '').toUpperCase(), n = String(name || '').toUpperCase(), m;
  if ((m = z.match(/(\d+(?:\.\d+)?)\s*ML/))) return Number(m[1]);
  if ((m = z.match(/(\d+(?:\.\d+)?)\s*(LTR|LT|L)\b/))) return Number(m[1]) * 1000;
  if ((m = n.match(/(\d+(?:\.\d+)?)\s*ML\b/))) return Number(m[1]);
  var whole = s && (s.piece || s.ml) || 0;
  if (/\b(BTL|BOTTLE|BUCKET)\b/.test(n + ' ' + z)) return whole || 750;
  if (/PINT/.test(z + ' ' + n)) return 330;
  if (/CAN/.test(z)) return whole || 500;
  var notes = String(card && card.NOTES || ''), bp = Number(card && card.BOTTLE_PRICE) || 0, sp = Number(card && card.SERVING_PRICE) || 0;
  if (bp > 0 && price > 0 && Math.abs(price - bp) < 1 && Math.abs(price - sp) >= 1) return whole || 750;
  if ((m = notes.match(/(\d+)\s*ML\s*(?:SINGLE|SERV|PEG|GLASS)/i))) return Number(m[1]);
  var t = (cat + ' ' + (s ? s.cat + ' ' + s.name : '') + ' ' + n).toUpperCase();
  if (/BEER|BREW|SODA|WATER|JUICE|RED ?BULL|SOFT|TONIC|COKE|SPRITE|ENERGY/.test(t)) return whole || 330;
  if (/WINE|CHAMPAGNE|SPARKLING|PROSECCO|SAKE/.test(t)) return 150;
  return 30;
}

/* ── name matching ── */
var BNX_BC_STOP = ('OS IF OI Z BV LIQ WHISKY WHISKEY SCOTCH GIN VODKA RUM BEER TEQUILA BRANDY WINE LIQUEUR LIQUER LIQ ML LTR LT L BTL BOTTLE CN CAN CANS CS X OF THE AND N ' +
  'YO YRS YR YEARS YEAR OLD PINT IND IMP IMPORTED SINGLE MALT BLENDED PREMIUM SPIRIT FL PC PEG LARGE SMALL MRP S W SW').split(' ');
var BNX_BC_VARIANT = ('ORANGE APPLE GREEN LIMON LEMON LIME MANGO CINNAMON COFFEE HONEY VANILLA CHERRY PEACH RASPBERRY STRAWBERRY BERRY CITRUS MINT CHOCOLATE ' +
  'XO VS VSOP RESERVE GOLD BLACK RED BLUE WHITE DOUBLE GREEN PLATINUM SILVER ROSE BRUT DRY SWEET SPICED DARK LIGHT ULTRA STRONG MILD SMOOTH BLONDE BLONE ' +
  'REPOSADO ANEJO BLANCO EXTRA FIRE RYE STOUT CASK SHERRY PORT SELECT EDITION').split(' ');
var BNX_BC_SYN = [[/\bJ\s*W\b|\bJW\b/g, 'JOHNNIE WALKER'], [/\bJOHNY\b|\bJHONNIE\b|\bJOHNNY\b/g, 'JOHNNIE'], [/\bGLENFIDDCH\b/g, 'GLENFIDDICH'], [/\bSINGLETONE\b/g, 'SINGLETON'],
  [/\bORIGNAL\b/g, 'ORIGINAL'], [/\bJACK DANIEL\b/g, 'JACK DANIELS'], [/\bSANTORI\b/g, 'SUNTORY'], [/\bJAMESOM\b|\bJOHN JAMESON\b/g, 'JAMESON'], [/\bTALISKAR\b/g, 'TALISKER'],
  [/\bGLEKINCHIE\b/g, 'GLENKINCHIE'], [/\bCAOL LIA\b/g, 'CAOL ILA'], [/\bMARTEL\b/g, 'MARTELL'], [/\bLONDAN\b/g, 'LONDON'], [/\bBLONE\b/g, 'BLONDE'], [/\bKF\b/g, 'KINGFISHER'],
  [/\bJIMBEAM\b/g, 'JIM BEAM'], [/\bCOFFE\b/g, 'COFFEE'], [/\bVIEGO\b/g, 'VIEJO'], [/\bRIGA\b/g, 'RIOJA'], [/\bST\.?\s*-?\s*REMY\b/g, 'STREMY'], [/\bBALLANTINES\b|\bBALLANIINES\b|\bBALLANTINE S\b/g, 'BALLANTINE'], [/\bTEACHERS\b/g, 'TEACHER'], [/\bSUNTORI\b/g, 'SUNTORY']];
function bnxBcToks_(name) {
  var s = ' ' + String(name || '').toUpperCase().replace(/[’'`.]/g, '').replace(/[()\-\/,&+]/g, ' ') + ' ';
  BNX_BC_SYN.forEach(function (p) { s = s.replace(p[0], p[1]); });
  s = s.replace(/\b(OS|IF|OI)\s*\d*\b/g, ' ').replace(/\b\d+(?:\.\d+)?\s*(ML|LTR|LT|L)\b/g, ' ').replace(/\bB\d{3,4}\b/g, ' ').replace(/\b\d+\s*X\b|\bX\s*\d+\b/g, ' ');
  s = s.replace(/\b(\d+)\s*(YO|YRS?|YEARS?|Y)\b/g, ' $1Y ');
  return (s.match(/[A-Z0-9]+/g) || []).filter(function (w) { return BNX_BC_STOP.indexOf(w) < 0 && !/^\d{3,4}$/.test(w); });
}
function bnxBcBigram_(a, b) {
  if (!a || !b) return 0; if (a === b) return 1;
  var g = function (s) { var o = {}; for (var i = 0; i < s.length - 1; i++) { var k = s.substr(i, 2); o[k] = (o[k] || 0) + 1; } return o; };
  var A = g(a), B = g(b), inter = 0, na = 0, nb = 0; for (var k in A) { na += A[k]; if (B[k]) inter += Math.min(A[k], B[k]); } for (var j in B) nb += B[j];
  return na + nb ? 2 * inter / (na + nb) : 0;
}
function bnxBcBest_(name, store) {
  var t = bnxBcToks_(name), k = t.join(' '); if (!t.length) return { s: null, score: 0 };
  var ts = {}; t.forEach(function (w) { ts[w] = 1; }); var nt = Object.keys(ts).length;
  var ageM = t.filter(function (w) { return /^\d+Y$/.test(w); }), varM = t.filter(function (w) { return BNX_BC_VARIANT.indexOf(w) >= 0; });
  var best = null, bs = 0;
  store.forEach(function (s) {
    if (!s.t.length) return; var ss = {}, inter = 0; s.t.forEach(function (w) { ss[w] = 1; });
    Object.keys(ts).forEach(function (w) { if (ss[w]) inter++; }); if (!inter) return;
    var cov = inter / nt, rev = inter / Object.keys(ss).length, score = 0.5 * cov + 0.2 * rev + 0.3 * bnxBcBigram_(k, s.k);
    var ageS = s.t.filter(function (w) { return /^\d+Y$/.test(w); });
    if (ageM.length && ageS.length && !ageM.some(function (a) { return ageS.indexOf(a) >= 0; })) score *= 0.4;
    else if (ageM.length && !ageS.length) score *= 0.85;
    var varS = s.t.filter(function (w) { return BNX_BC_VARIANT.indexOf(w) >= 0; });
    var miss = varS.filter(function (w) { return varM.indexOf(w) < 0; }).length + varM.filter(function (w) { return varS.indexOf(w) < 0; }).length;
    if (miss) score *= Math.pow(0.8, miss);
    if (score > bs) { bs = score; best = s; }
  });
  return { s: best, score: bs };
}
function bnxBcNorm_(v) { return String(v == null ? '' : v).trim().replace(/\s+/g, ' ').toLowerCase(); }

/* ── sheet helpers (bar tabs are not in the MASTER/TRANSACTION routing map, so open the DBs directly) ── */
function bnxBcDbs_(cid) {
  var ids = bnxGetClientDbIds_(cid), op = function (id) { return typeof bnxOpenSpreadsheetCached_ === 'function' ? bnxOpenSpreadsheetCached_(id) : SpreadsheetApp.openById(id); };
  return { MASTER: op(ids.MASTER), TRANSACTION: op(ids.TRANSACTION) };
}
function bnxBcSheet_(ss, name) { return ss.getSheetByName(name) || ss.insertSheet(name); }
function bnxBcEnsureRows_(sh, n) { if (sh.getMaxRows() < n) sh.insertRowsAfter(sh.getMaxRows(), n - sh.getMaxRows()); }
/* table as objects; ensureCols are added to the header when missing (only created when written) */
function bnxBcTable_(ss, name, ensureCols) {
  var sh = ss.getSheetByName(name), t = { ss: ss, name: name, sh: sh, head: [], rows: [] };
  if (!sh) { t.head = (ensureCols || []).slice(); return t; }
  var lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (lr >= 1 && lc >= 1) {
    var v = sh.getRange(1, 1, lr, lc).getValues(); t.head = v[0].map(function (x) { return String(x || '').trim(); });
    for (var r = 1; r < v.length; r++) {
      if (!v[r].some(function (x) { return x !== '' && x !== null; })) continue;
      var o = {}; for (var c = 0; c < t.head.length; c++) if (t.head[c] && o[t.head[c]] === undefined) o[t.head[c]] = v[r][c]; t.rows.push(o);
    }
  }
  (ensureCols || []).forEach(function (c) { if (t.head.indexOf(c) < 0) t.head.push(c); });
  return t;
}
/* write rows back by header (blank rows dropped, rows beyond the new length cleared) */
function bnxBcWrite_(t, replace) {
  if (!t.head.length || (!t.sh && !t.rows.length)) return;
  var sh = t.sh || (t.sh = t.ss.insertSheet(t.name));
  var old = sh.getLastRow();
  sh.getRange(1, 1, 1, t.head.length).setValues([t.head]);
  if (t.rows.length) {
    bnxBcEnsureRows_(sh, t.rows.length + 1);
    sh.getRange(2, 1, t.rows.length, t.head.length).setValues(t.rows.map(function (o) { return t.head.map(function (h) { var v = o[h]; return v === undefined || v === null ? '' : v; }); }));
  }
  if (old > t.rows.length + 1) sh.getRange(t.rows.length + 2, 1, old - t.rows.length - 1, t.head.length).clearContent();
}

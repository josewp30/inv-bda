/**
 * ══════════════════════════════════════════════════════
 *  InvControl — Google Apps Script Backend
 *  Despliega como: Ejecutar como "Yo", Acceso "Cualquiera"
 *  URL: Extensiones > Apps Script > Implementar > Web App
 * ══════════════════════════════════════════════════════
 *
 *  ESTRUCTURA DE GOOGLE SHEETS:
 *  - Hoja "Registros"   → Todos los registros de conteo
 *  - Hoja "Productos"   → Catálogo maestro de productos
 *  - Hoja "Almacenes"   → Lista de almacenes
 *  - Hoja "Resumen"     → Consolidado por fecha (auto-generado)
 */

// ── CONFIGURACIÓN ──────────────────────────────────────
const CONFIG = {
  API_KEY: 'alfa#621',       // Cambia esto
  SPREADSHEET_ID: '',                  // Déjalo vacío = usa el Spreadsheet donde está el script
  SHEET_RECORDS:   'Registros',
  SHEET_PRODUCTS:  'Productos',
  SHEET_WAREHOUSES:'Almacenes',
  SHEET_SUMMARY:   'Resumen',
};

// ── CORS HEADERS ───────────────────────────────────────
function corsHeaders() {
  return ContentService.createTextOutput()
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonResponse(data, status = 200) {
  const output = ContentService.createTextOutput(
    JSON.stringify({ ...data, status, timestamp: new Date().toISOString() })
  ).setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── GET HANDLER ────────────────────────────────────────
function doGet(e) {
  const params = e.parameter;
  const action = params.action || 'ping';
  const apiKey = params.apiKey || '';

  if (action !== 'ping' && !validateKey(apiKey)) {
    return jsonResponse({ success: false, error: 'API Key inválida' }, 401);
  }

  try {
    switch (action) {
      case 'ping':      return jsonResponse({ success: true, message: 'InvControl API Online' });
      case 'products':  return jsonResponse({ success: true, data: getProducts() });
      case 'warehouses':return jsonResponse({ success: true, data: getWarehouses() });
      case 'records':   return jsonResponse({ success: true, data: getRecords(params) });
      case 'summary':   return jsonResponse({ success: true, data: getSummary(params) });
      default:          return jsonResponse({ success: false, error: 'Acción no reconocida' }, 400);
    }
  } catch (err) {
    Logger.log('Error en doGet: ' + err.toString());
    return jsonResponse({ success: false, error: err.toString() }, 500);
  }
}

// ── POST HANDLER ───────────────────────────────────────
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, error: 'JSON inválido' }, 400);
  }

  const { action, apiKey } = payload;

  if (!validateKey(apiKey)) {
    return jsonResponse({ success: false, error: 'API Key inválida' }, 401);
  }

  try {
    switch (action) {
      case 'addRecords':    return jsonResponse(addRecords(payload.records));
      case 'addProduct':    return jsonResponse(addProduct(payload.product));
      case 'updateProduct': return jsonResponse(updateProduct(payload.product));
      case 'deleteProduct': return jsonResponse(deleteProduct(payload.productId));
      case 'addWarehouse':  return jsonResponse(addWarehouse(payload.warehouse));
      case 'deleteRecord':  return jsonResponse(deleteRecord(payload.recordId));
      case 'importProducts':return jsonResponse(importProducts(payload.products));
      default:              return jsonResponse({ success: false, error: 'Acción no reconocida' }, 400);
    }
  } catch (err) {
    Logger.log('Error en doPost: ' + err.toString());
    return jsonResponse({ success: false, error: err.toString() }, 500);
  }
}

// ── VALIDACIÓN ─────────────────────────────────────────
function validateKey(key) {
  if (!CONFIG.API_KEY || CONFIG.API_KEY === 'TU_CLAVE_API_AQUI') return true; // modo dev
  return key === CONFIG.API_KEY;
}

// ── ACCESO AL SPREADSHEET ──────────────────────────────
function getSpreadsheet() {
  return CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet(name, headers) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    Logger.log(`[InvControl] Hoja "${name}" creada`);
  }
  return sheet;
}

// ── RECORDS ────────────────────────────────────────────
const RECORD_HEADERS = [
  'ID', 'Fecha', 'Hora', 'Timestamp', 'Código Producto', 'Nombre Producto',
  'ID Almacén', 'Almacén', 'Cantidad', 'Unidad', 'ID Operador', 'Operador',
  'Observaciones', 'Sincronizado'
];

function addRecords(records) {
  if (!records || !records.length) return { success: false, error: 'Sin registros' };
  const sheet = getOrCreateSheet(CONFIG.SHEET_RECORDS, RECORD_HEADERS);

  // Agrupar por fecha para organización diferenciada
  const byDate = {};
  records.forEach(r => {
    const date = (r.timestamp || new Date().toISOString()).slice(0, 10);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(r);
  });

  let totalAdded = 0;
  Object.entries(byDate).forEach(([date, dayRecords]) => {
    dayRecords.forEach(r => {
      const ts = new Date(r.timestamp || new Date());
      const row = [
        r.id || `REC-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        Utilities.formatDate(ts, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        Utilities.formatDate(ts, Session.getScriptTimeZone(), 'HH:mm:ss'),
        r.timestamp || ts.toISOString(),
        r.productCode || '',
        r.productName || '',
        r.warehouseId || '',
        r.warehouseName || '',
        r.qty || 0,
        r.unit || '',
        r.userId || '',
        r.userName || '',
        r.obs || '',
        new Date().toISOString(),
      ];
      sheet.appendRow(row);
      totalAdded++;
    });
  });

  // Auto-formatear columnas
  sheet.autoResizeColumns(1, RECORD_HEADERS.length);

  // Actualizar resumen
  updateSummary();

  Logger.log(`[InvControl] ${totalAdded} registros agregados`);
  return { success: true, added: totalAdded };
}

function getRecords({ date, warehouseId, userId, limit = 200 }) {
  const sheet = getOrCreateSheet(CONFIG.SHEET_RECORDS, RECORD_HEADERS);
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  let rows = data.slice(1).map(row => ({
    id:           row[0],
    date:         row[1],
    time:         row[2],
    timestamp:    row[3],
    productCode:  row[4],
    productName:  row[5],
    warehouseId:  row[6],
    warehouseName:row[7],
    qty:          row[8],
    unit:         row[9],
    userId:       row[10],
    userName:     row[11],
    obs:          row[12],
  }));

  if (date)        rows = rows.filter(r => String(r.date).startsWith(date));
  if (warehouseId) rows = rows.filter(r => r.warehouseId === warehouseId);
  if (userId)      rows = rows.filter(r => r.userId === userId);

  return rows.slice(0, parseInt(limit)).reverse();
}

function deleteRecord(recordId) {
  const sheet = getOrCreateSheet(CONFIG.SHEET_RECORDS, RECORD_HEADERS);
  const data  = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === recordId) {
      sheet.deleteRow(i + 1);
      return { success: true, deleted: recordId };
    }
  }
  return { success: false, error: 'Registro no encontrado' };
}

// ── PRODUCTS ───────────────────────────────────────────
const PRODUCT_HEADERS = ['ID', 'Código', 'Nombre', 'Categoría', 'Unidad', 'Activo'];

function getProducts() {
  const sheet = getOrCreateSheet(CONFIG.SHEET_PRODUCTS, PRODUCT_HEADERS);
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1)
    .filter(row => row[5] !== false && row[5] !== 'false') // solo activos
    .map(row => ({
      id: row[0], code: row[1], name: row[2],
      category: row[3], unit: row[4], active: row[5],
    }));
}

function addProduct(product) {
  const sheet = getOrCreateSheet(CONFIG.SHEET_PRODUCTS, PRODUCT_HEADERS);
  sheet.appendRow([
    product.id || `P-${Date.now()}`,
    product.code || '', product.name || '',
    product.category || '', product.unit || '', true
  ]);
  return { success: true };
}

function updateProduct(product) {
  const sheet = getOrCreateSheet(CONFIG.SHEET_PRODUCTS, PRODUCT_HEADERS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === product.id) {
      sheet.getRange(i+1, 2, 1, 4).setValues([[
        product.code, product.name, product.category, product.unit
      ]]);
      return { success: true };
    }
  }
  return { success: false, error: 'Producto no encontrado' };
}

function deleteProduct(productId) {
  const sheet = getOrCreateSheet(CONFIG.SHEET_PRODUCTS, PRODUCT_HEADERS);
  const data  = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === productId) {
      // Soft delete — marcar como inactivo
      sheet.getRange(i+1, 6).setValue(false);
      return { success: true };
    }
  }
  return { success: false, error: 'Producto no encontrado' };
}

function importProducts(products) {
  if (!products || !products.length) return { success: false, error: 'Sin productos' };
  const sheet = getOrCreateSheet(CONFIG.SHEET_PRODUCTS, PRODUCT_HEADERS);
  products.forEach(p => {
    sheet.appendRow([
      p.id || `P-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
      p.code, p.name, p.category, p.unit, true
    ]);
  });
  sheet.autoResizeColumns(1, PRODUCT_HEADERS.length);
  return { success: true, imported: products.length };
}

// ── WAREHOUSES ─────────────────────────────────────────
const WAREHOUSE_HEADERS = ['ID', 'Nombre', 'Ubicación', 'Activo'];

function getWarehouses() {
  const sheet = getOrCreateSheet(CONFIG.SHEET_WAREHOUSES, WAREHOUSE_HEADERS);
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1)
    .filter(row => row[3] !== false)
    .map(row => ({ id: row[0], name: row[1], location: row[2] }));
}

function addWarehouse(w) {
  const sheet = getOrCreateSheet(CONFIG.SHEET_WAREHOUSES, WAREHOUSE_HEADERS);
  sheet.appendRow([w.id || `W-${Date.now()}`, w.name, w.location || '', true]);
  return { success: true };
}

// ── RESUMEN POR FECHA ──────────────────────────────────
function updateSummary() {
  const records = getRecords({});
  if (!records.length) return;

  const sheet = getOrCreateSheet(CONFIG.SHEET_SUMMARY, [
    'Fecha', 'Código', 'Producto', 'Almacén', 'Total Cajas', 'Total Unidades', 'Operadores'
  ]);

  // Limpiar y regenerar
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 7).clearContent();

  // Agrupar por fecha + producto + almacén
  const grouped = {};
  records.forEach(r => {
    const key = `${r.date}|${r.productCode}|${r.warehouseId}`;
    if (!grouped[key]) {
      grouped[key] = {
        date: r.date, code: r.productCode, name: r.productName,
        warehouse: r.warehouseName, boxes: 0, units: 0, operators: new Set()
      };
    }
    if (r.unit === 'CAJA') grouped[key].boxes += Number(r.qty);
    else grouped[key].units += Number(r.qty);
    grouped[key].operators.add(r.userId);
  });

  const summaryRows = Object.values(grouped).map(g => [
    g.date, g.code, g.name, g.warehouse, g.boxes, g.units,
    [...g.operators].join(', ')
  ]);

  if (summaryRows.length) {
    sheet.getRange(2, 1, summaryRows.length, 7).setValues(summaryRows);
    sheet.autoResizeColumns(1, 7);
  }

  Logger.log(`[InvControl] Resumen actualizado: ${summaryRows.length} filas`);
}

// ── FUNCIÓN DE SETUP INICIAL ───────────────────────────
function setupSheets() {
  getOrCreateSheet(CONFIG.SHEET_RECORDS,    RECORD_HEADERS);
  getOrCreateSheet(CONFIG.SHEET_PRODUCTS,   PRODUCT_HEADERS);
  getOrCreateSheet(CONFIG.SHEET_WAREHOUSES, WAREHOUSE_HEADERS);
  getOrCreateSheet(CONFIG.SHEET_SUMMARY,    ['Fecha','Código','Producto','Almacén','Total Cajas','Total Unidades','Operadores']);
  Logger.log('[InvControl] Setup completado ✓');
  SpreadsheetApp.getUi().alert('✅ InvControl configurado correctamente.\n\nHojas creadas:\n- Registros\n- Productos\n- Almacenes\n- Resumen');
}

// ── MENÚ EN SHEETS ─────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📦 InvControl')
    .addItem('🔧 Configurar hojas', 'setupSheets')
    .addItem('📊 Actualizar Resumen', 'updateSummary')
    .addSeparator()
    .addItem('🔗 Ver URL del Web App', 'showDeployUrl')
    .addToUi();
}

function showDeployUrl() {
  SpreadsheetApp.getUi().alert(
    '📡 URL del Web App\n\n' +
    'Ve a: Extensiones > Apps Script > Implementar > Administrar implementaciones\n\n' +
    'Copia la URL de "Web App" y pégala en la configuración de InvControl PWA.'
  );
}

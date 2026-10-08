// Configure SPREADSHEET_ID and CONTACT_RELAY_TOKEN in Project Settings > Script properties.
const HEADERS = ['Date', 'Name', 'Company', 'Email', 'Phone', 'Project Type', 'Message'];
const LIMITS = {name: [2, 180], company: [2, 180], email: [1, 180], phone: [7, 40], type: [1, 180], message: [15, 4000]};

function reply(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let lock;
  try {
    const properties = PropertiesService.getScriptProperties();
    const token = properties.getProperty('CONTACT_RELAY_TOKEN');
    const p = e && e.parameter;
    if (!token || !p || p.relay_token !== token) return reply({ok: false, code: 'unauthorized'});
    if (p._gotcha) return reply({ok: false, code: 'spam'});
    const values = {};
    for (const field in LIMITS) {
      const raw = p[field];
      if (typeof raw !== 'string' || raw.length > LIMITS[field][1] || raw.trim().length < LIMITS[field][0]) {
        return reply({ok: false, code: 'validation', field: field});
      }
      values[field] = raw.trim();
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return reply({ok: false, code: 'validation', field: 'email'});
    if (!/^[+()\d\s.-]{7,40}$/.test(values.phone)) return reply({ok: false, code: 'validation', field: 'phone'});
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return reply({ok: false, code: 'busy'});
    const book = SpreadsheetApp.openById(properties.getProperty('SPREADSHEET_ID'));
    const sheet = book.getSheetByName('Leads') || book.insertSheet('Leads');
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
    const headers = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    if (HEADERS.some((header, i) => headers[i] !== header)) return reply({ok: false, code: 'headers'});
    // Prefix formula-like input with an apostrophe so Sheets stores literal text.
    const safe = value => /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? "'" + value : value;
    sheet.appendRow([new Date(), ...Object.keys(LIMITS).map(field => safe(values[field]))]);
    SpreadsheetApp.flush();
    return reply({ok: true, saved: true});
  } catch (error) {
    // Never return spreadsheet identifiers or submission contents to the caller.
    return reply({ok: false, code: 'server_error'});
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

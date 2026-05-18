/**
 * ייבוא/ייצוא לידים מקובצי Excel.
 */
const XLSX = require('xlsx');

// מיפוי שם-שדה במערכת -> כותרת בעברית בקובץ
const FIELD_LABELS = {
  name: 'שם',
  phone: 'טלפון',
  email: 'מייל',
  status: 'סטטוס',
  notes: 'הערות',
  source: 'מקור',
  utm_source: 'UTM Source',
  utm_medium: 'UTM Medium',
  utm_campaign: 'UTM Campaign',
  utm_term: 'UTM Term',
  utm_content: 'UTM Content',
  assigned_to_name: 'טלפן מטפל',
  attended_open_day: 'יום פתוח',
  attended_webinar: 'וובינר',
  webinar_minutes: 'דקות בוובינר',
  is_customer: 'רכש',
  course_name: 'קורס',
  created_at: 'נרשם בתאריך',
  updated_at: 'עדכון אחרון',
};

// כותרות מקובלות בקבצים נכנסים -> שם השדה במערכת (לזיהוי גמיש)
const HEADER_ALIASES = {};
for (const [field, label] of Object.entries(FIELD_LABELS)) {
  HEADER_ALIASES[label.toLowerCase()] = field;
  HEADER_ALIASES[field.toLowerCase()] = field;
}
Object.assign(HEADER_ALIASES, {
  'שם מלא': 'name', 'name': 'name', 'full name': 'name',
  'נייד': 'phone', 'טלפון נייד': 'phone', 'מספר': 'phone', 'phone number': 'phone',
  'אימייל': 'email', 'דוא"ל': 'email', 'דואל': 'email', 'e-mail': 'email',
  'הערה': 'notes', 'comment': 'notes', 'comments': 'notes',
});

/** קורא buffer של xlsx/csv ומחזיר { headers, rows } כאשר rows הם אובייקטים גולמיים */
function parseBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

/** ממפה שורה גולמית לאובייקט עם שמות שדות מוכרים, לפי בחירת המשתמש או זיהוי אוטומטי */
function mapRow(rawRow, columnMap) {
  const out = {};
  for (const [header, value] of Object.entries(rawRow)) {
    let field = columnMap && columnMap[header];
    if (!field) field = HEADER_ALIASES[String(header).trim().toLowerCase()];
    if (field && field !== '__ignore__') out[field] = value;
  }
  return out;
}

/** בונה workbook של לידים לייצוא. fields = רשימת שמות שדות שנבחרו לייצוא */
function buildLeadsWorkbook(leads, fields) {
  const cols = (fields && fields.length ? fields : Object.keys(FIELD_LABELS))
    .filter((f) => FIELD_LABELS[f]);
  const data = leads.map((lead) => {
    const row = {};
    for (const f of cols) {
      let v = lead[f];
      if (typeof v === 'boolean') v = v ? 'כן' : 'לא';
      if (v == null) v = '';
      row[FIELD_LABELS[f]] = v;
    }
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(data, { header: cols.map((f) => FIELD_LABELS[f]) });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'לידים');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { FIELD_LABELS, parseBuffer, mapRow, buildLeadsWorkbook };

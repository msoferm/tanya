/** המרת מספר טלפון לפורמט וואטסאפ בינלאומי (ברירת מחדל: ישראל 972) */
export function toWa(raw, country = '972') {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith(country)) return d;
  if (d.startsWith('0')) return country + d.slice(1);
  return d;
}

/** פורמט תאריך עברי קצר */
export function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('he-IL') : '—';
}

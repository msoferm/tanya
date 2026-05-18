/**
 * נרמול מספרי טלפון - לזיהוי כפילויות ולוואטסאפ.
 * מתמקד במספרים ישראליים אך עובד גם על מספרים בינלאומיים.
 */

/** משאיר ספרות בלבד */
function digitsOnly(raw) {
  return String(raw || '').replace(/\D/g, '');
}

/**
 * מחזיר צורה מנורמלת ואחידה של המספר לצורך השוואת כפילויות.
 * 972 -> 0 ; מסיר אפסים מובילים כפולים. מחזיר null אם אין מספיק ספרות.
 */
function normalizePhone(raw) {
  let d = digitsOnly(raw);
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('972')) d = '0' + d.slice(3);
  // מספר ישראלי ללא 0 מוביל (למשל 521234567)
  if (d.length === 9 && !d.startsWith('0')) d = '0' + d;
  if (d.length < 7) return null;
  return d;
}

/**
 * מחזיר מספר בפורמט בינלאומי לוואטסאפ (ללא +, ללא 0 מוביל).
 * ברירת מחדל: קידומת ישראל 972.
 */
function toWhatsApp(raw, countryCode = '972') {
  let d = digitsOnly(raw);
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith(countryCode)) return d;
  if (d.startsWith('0')) return countryCode + d.slice(1);
  return d;
}

module.exports = { digitsOnly, normalizePhone, toWhatsApp };

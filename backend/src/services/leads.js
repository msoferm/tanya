/**
 * לוגיקה משותפת ליצירת לידים - בשימוש ע"י הוספה ידנית, וובהוק אלמנטור וייבוא אקסל.
 * אחראית על נרמול, מניעת כפילויות, חלוקה אוטומטית ורישום ביומן.
 */
const { normalizePhone } = require('../utils/phone');
const { pickTelephonist } = require('./distribution');

/** מחזיר את מזהה סטטוס ברירת המחדל (הראשון לפי סדר) */
async function defaultStatusId(client) {
  const { rows } = await client.query(
    `SELECT id FROM lead_statuses ORDER BY sort_order, id LIMIT 1`
  );
  return rows[0]?.id || null;
}

/** ממיר ערך טקסט/בוליאני ל-boolean */
function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (v == null) return false;
  return ['1', 'true', 'כן', 'yes', 'y'].includes(String(v).trim().toLowerCase());
}

/**
 * יוצר ליד יחיד בתוך טרנזקציה נתונה (client).
 * options: { autoAssign, actorId, sourceLabel }
 * מחזיר { created, duplicate, lead }
 */
async function createLead(client, data, options = {}) {
  const phoneNorm = normalizePhone(data.phone);
  const email = data.email ? String(data.email).trim().toLowerCase() : null;

  // ----- מניעת כפילויות -----
  if (phoneNorm || email) {
    const dup = await client.query(
      `SELECT * FROM leads
       WHERE ($1::text IS NOT NULL AND phone_normalized = $1)
          OR ($2::text IS NOT NULL AND lower(email) = $2)
       LIMIT 1`,
      [phoneNorm, email]
    );
    if (dup.rows[0]) {
      return { created: false, duplicate: true, lead: dup.rows[0] };
    }
  }

  let statusId = data.status_id || (await defaultStatusId(client));

  let assignedTo = data.assigned_to || null;
  if (!assignedTo && options.autoAssign) {
    assignedTo = await pickTelephonist(client);
  }

  const { rows } = await client.query(
    `INSERT INTO leads
      (name, phone, phone_normalized, email, status_id, notes, assigned_to,
       source, utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_page,
       attended_open_day, attended_webinar, webinar_minutes, course_name,
       created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
       COALESCE($19, NOW()))
     RETURNING *`,
    [
      data.name || null,
      data.phone || null,
      phoneNorm,
      email,
      statusId,
      data.notes || null,
      assignedTo,
      data.source || options.sourceLabel || null,
      data.utm_source || null,
      data.utm_medium || null,
      data.utm_campaign || null,
      data.utm_term || null,
      data.utm_content || null,
      data.landing_page || null,
      toBool(data.attended_open_day),
      toBool(data.attended_webinar),
      data.webinar_minutes != null && data.webinar_minutes !== ''
        ? parseInt(data.webinar_minutes, 10) : null,
      data.course_name || null,
      data.created_at || null,
    ]
  );
  const lead = rows[0];

  await client.query(
    `INSERT INTO lead_history (lead_id, user_id, action, details)
     VALUES ($1, $2, 'created', $3)`,
    [lead.id, options.actorId || null, options.sourceLabel || 'נוצר ליד']
  );

  return { created: true, duplicate: false, lead };
}

module.exports = { createLead, defaultStatusId, toBool };

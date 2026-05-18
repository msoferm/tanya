const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { createLead } = require('../services/leads');
const { normalizePhone, digitsOnly, toWhatsApp } = require('../utils/phone');

const router = express.Router();
router.use(authenticate);

const LEAD_SELECT = `
  SELECT l.*,
         s.name  AS status_name,
         s.color AS status_color,
         s.is_won AS status_is_won,
         u.name  AS assigned_to_name
  FROM leads l
  LEFT JOIN lead_statuses s ON s.id = l.status_id
  LEFT JOIN users u ON u.id = l.assigned_to
`;

/** טלפן רואה רק את הלידים שלו; מנהל/על רואים הכל */
function visibilityClause(user, params) {
  if (user.role === 'telephonist') {
    params.push(user.id);
    return `l.assigned_to = $${params.length}`;
  }
  return 'TRUE';
}

/** GET /api/leads - רשימה עם חיפוש, סינון ומיון */
router.get('/', async (req, res, next) => {
  try {
    const {
      q, status_id, assigned_to, source, is_customer,
      attended_webinar, attended_open_day,
      date_from, date_to, sort = 'created_desc',
      page = 1, limit = 50,
    } = req.query;

    const params = [];
    const where = [visibilityClause(req.user, params)];

    if (q && q.trim()) {
      // חיפוש לפי שם, מייל או טלפון - כולל חצי מספר טלפון
      const term = `%${q.trim()}%`;
      const phoneTerm = `%${digitsOnly(q)}%`;
      params.push(term, term, phoneTerm);
      const n = params.length;
      where.push(`(l.name ILIKE $${n - 2} OR l.email ILIKE $${n - 1}
                   OR l.phone_normalized LIKE $${n}
                   OR regexp_replace(coalesce(l.phone,''),'\\D','','g') LIKE $${n})`);
    }
    if (status_id) { params.push(status_id); where.push(`l.status_id = $${params.length}`); }
    if (assigned_to) { params.push(assigned_to); where.push(`l.assigned_to = $${params.length}`); }
    if (source) { params.push(`%${source}%`); where.push(`l.source ILIKE $${params.length}`); }
    if (is_customer != null && is_customer !== '') {
      params.push(is_customer === 'true' || is_customer === '1');
      where.push(`l.is_customer = $${params.length}`);
    }
    if (attended_webinar === 'true') where.push('l.attended_webinar = TRUE');
    if (attended_open_day === 'true') where.push('l.attended_open_day = TRUE');
    if (date_from) { params.push(date_from); where.push(`l.created_at >= $${params.length}`); }
    if (date_to) { params.push(date_to); where.push(`l.created_at <= ($${params.length}::date + 1)`); }

    const orderMap = {
      created_desc: 'l.created_at DESC',
      created_asc: 'l.created_at ASC',
      updated_desc: 'l.updated_at DESC',
      name_asc: 'l.name ASC',
    };
    const orderBy = orderMap[sort] || orderMap.created_desc;

    const lim = Math.min(parseInt(limit, 10) || 50, 500);
    const off = ((parseInt(page, 10) || 1) - 1) * lim;

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const countRes = await db.query(
      `SELECT COUNT(*) FROM leads l ${whereSql}`, params
    );
    params.push(lim, off);
    const rowsRes = await db.query(
      `${LEAD_SELECT} ${whereSql} ORDER BY ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`, params
    );

    const leads = rowsRes.rows.map((l) => ({ ...l, whatsapp: toWhatsApp(l.phone) }));
    res.json({
      leads,
      total: parseInt(countRes.rows[0].count, 10),
      page: parseInt(page, 10) || 1,
      limit: lim,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/leads/:id - ליד בודד + יומן + תזכורות */
router.get('/:id', async (req, res, next) => {
  try {
    const params = [req.params.id];
    const vis = req.user.role === 'telephonist'
      ? ` AND l.assigned_to = ${Number(req.user.id)}` : '';
    const { rows } = await db.query(
      `${LEAD_SELECT} WHERE l.id = $1${vis}`, params
    );
    if (!rows[0]) return res.status(404).json({ error: 'הליד לא נמצא' });

    const history = await db.query(
      `SELECT h.*, u.name AS user_name FROM lead_history h
       LEFT JOIN users u ON u.id = h.user_id
       WHERE h.lead_id = $1 ORDER BY h.created_at DESC`, [req.params.id]
    );
    const reminders = await db.query(
      `SELECT * FROM reminders WHERE lead_id = $1 ORDER BY remind_at`, [req.params.id]
    );
    res.json({
      ...rows[0],
      whatsapp: toWhatsApp(rows[0].phone),
      history: history.rows,
      reminders: reminders.rows,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/leads - יצירת ליד ידנית */
router.post('/', async (req, res, next) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const data = { ...req.body };
    // טלפן יכול ליצור ליד רק עבור עצמו
    if (req.user.role === 'telephonist') data.assigned_to = req.user.id;

    const result = await createLead(client, data, {
      autoAssign: req.user.role !== 'telephonist' && !data.assigned_to,
      actorId: req.user.id,
      sourceLabel: data.source || 'הוספה ידנית',
    });
    if (result.duplicate) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'ליד עם טלפון או מייל זהים כבר קיים במערכת',
        existingLeadId: result.lead.id,
      });
    }
    await client.query('COMMIT');
    res.status(201).json(result.lead);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

const EDITABLE = [
  'name', 'phone', 'email', 'status_id', 'notes', 'assigned_to', 'source',
  'attended_open_day', 'attended_webinar', 'webinar_minutes', 'course_name',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
];

/** PUT /api/leads/:id - עדכון ליד */
router.put('/:id', async (req, res, next) => {
  try {
    const cur = await db.query(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
    const lead = cur.rows[0];
    if (!lead) return res.status(404).json({ error: 'הליד לא נמצא' });
    if (req.user.role === 'telephonist' && lead.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'אפשר לערוך רק לידים שמשויכים אליך' });
    }
    // טלפן לא יכול לשנות שיוך
    const body = { ...req.body };
    if (req.user.role === 'telephonist') delete body.assigned_to;

    const fields = [];
    const vals = [];
    let i = 1;
    for (const col of EDITABLE) {
      if (body[col] === undefined) continue;
      let v = body[col];
      if (col === 'phone') {
        fields.push(`phone_normalized = $${i++}`);
        vals.push(normalizePhone(v));
      }
      fields.push(`${col} = $${i++}`);
      vals.push(v === '' ? null : v);
    }
    if (!fields.length) return res.status(400).json({ error: 'אין שדות לעדכון' });
    vals.push(req.params.id);

    const { rows } = await db.query(
      `UPDATE leads SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${i} RETURNING *`, vals
    );

    // רישום שינוי סטטוס ביומן
    if (body.status_id && Number(body.status_id) !== lead.status_id) {
      await db.query(
        `INSERT INTO lead_history (lead_id, user_id, action, details)
         VALUES ($1, $2, 'status_change', $3)`,
        [lead.id, req.user.id, `סטטוס עודכן`]
      );
    } else {
      await db.query(
        `INSERT INTO lead_history (lead_id, user_id, action, details)
         VALUES ($1, $2, 'updated', 'הליד עודכן')`,
        [lead.id, req.user.id]
      );
    }
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'טלפון או מייל זהים כבר קיימים בליד אחר' });
    }
    next(err);
  }
});

/** PATCH /api/leads/bulk - עריכה מרובה (סטטוס / שיוך) */
router.patch('/bulk', async (req, res, next) => {
  try {
    const { ids, status_id, assigned_to } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: 'לא נבחרו לידים' });
    }
    const sets = [];
    const params = [];
    let i = 1;
    if (status_id) { sets.push(`status_id = $${i++}`); params.push(status_id); }
    if (assigned_to !== undefined && req.user.role !== 'telephonist') {
      sets.push(`assigned_to = $${i++}`);
      params.push(assigned_to || null);
    }
    if (!sets.length) return res.status(400).json({ error: 'לא נבחר ערך לעדכון' });

    params.push(ids);
    let sql = `UPDATE leads SET ${sets.join(', ')}, updated_at = NOW()
               WHERE id = ANY($${i++})`;
    if (req.user.role === 'telephonist') {
      params.push(req.user.id);
      sql += ` AND assigned_to = $${i}`;
    }
    sql += ' RETURNING id';
    const { rows } = await db.query(sql, params);
    res.json({ updated: rows.length });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/leads/:id - מחיקה (מנהל ומעלה) */
router.delete('/:id', async (req, res, next) => {
  try {
    if (req.user.role === 'telephonist') {
      return res.status(403).json({ error: 'אין הרשאה למחוק לידים' });
    }
    await db.query(`DELETE FROM leads WHERE id = $1`, [req.params.id]);
    res.json({ message: 'הליד נמחק' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

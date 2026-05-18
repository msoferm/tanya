const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const SELECT = `
  SELECT r.*, l.name AS lead_name, l.phone AS lead_phone, l.email AS lead_email,
         u.name AS user_name
  FROM reminders r
  JOIN leads l ON l.id = r.lead_id
  LEFT JOIN users u ON u.id = r.user_id
`;

/** GET /api/reminders - תזכורות. ?scope=today | upcoming | all  ?done=false */
router.get('/', async (req, res, next) => {
  try {
    const { scope = 'upcoming', done } = req.query;
    const params = [];
    const where = [];

    // טלפן רואה רק את התזכורות שלו
    if (req.user.role === 'telephonist') {
      params.push(req.user.id);
      where.push(`r.user_id = $${params.length}`);
    } else if (req.query.user_id) {
      params.push(req.query.user_id);
      where.push(`r.user_id = $${params.length}`);
    }

    if (scope === 'today') {
      where.push(`r.remind_at::date = CURRENT_DATE`);
    } else if (scope === 'upcoming') {
      where.push(`r.remind_at >= NOW() - INTERVAL '1 day'`);
    }
    if (done === 'false') where.push('r.is_done = FALSE');
    if (done === 'true') where.push('r.is_done = TRUE');

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await db.query(
      `${SELECT} ${whereSql} ORDER BY r.is_done ASC, r.remind_at ASC`, params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/** POST /api/reminders - יצירת תזכורת */
router.post('/', async (req, res, next) => {
  try {
    const { lead_id, remind_at, note, user_id } = req.body;
    if (!lead_id || !remind_at) {
      return res.status(400).json({ error: 'נדרשים ליד ומועד תזכורת' });
    }
    // טלפן יוצר תזכורת רק לעצמו
    const owner = req.user.role === 'telephonist' ? req.user.id : (user_id || req.user.id);
    const { rows } = await db.query(
      `INSERT INTO reminders (lead_id, user_id, remind_at, note)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [lead_id, owner, remind_at, note || null]
    );
    await db.query(
      `INSERT INTO lead_history (lead_id, user_id, action, details)
       VALUES ($1, $2, 'reminder', $3)`,
      [lead_id, req.user.id, `נקבעה תזכורת ל-${new Date(remind_at).toLocaleString('he-IL')}`]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/** PUT /api/reminders/:id - עדכון / סימון כבוצע */
router.put('/:id', async (req, res, next) => {
  try {
    const cur = await db.query(`SELECT * FROM reminders WHERE id = $1`, [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'התזכורת לא נמצאה' });
    if (req.user.role === 'telephonist' && cur.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'אין הרשאה' });
    }
    const { remind_at, note, is_done } = req.body;
    const { rows } = await db.query(
      `UPDATE reminders SET
         remind_at = COALESCE($1, remind_at),
         note = COALESCE($2, note),
         is_done = COALESCE($3, is_done)
       WHERE id = $4 RETURNING *`,
      [remind_at || null, note ?? null, is_done ?? null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/reminders/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    await db.query(`DELETE FROM reminders WHERE id = $1`, [req.params.id]);
    res.json({ message: 'התזכורת נמחקה' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

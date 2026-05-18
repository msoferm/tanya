const express = require('express');
const db = require('../db');
const { authenticate, isManager } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/** GET /api/statuses - כל הסטטוסים (כולל ספירת לידים) */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT s.*, COUNT(l.id) AS leads_count
      FROM lead_statuses s
      LEFT JOIN leads l ON l.status_id = s.id
      GROUP BY s.id
      ORDER BY s.sort_order, s.id
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/** POST /api/statuses - יצירת סטטוס (מנהל ומעלה) */
router.post('/', isManager, async (req, res, next) => {
  try {
    const { name, color, sort_order, is_won } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'נדרש שם סטטוס' });
    }
    const { rows } = await db.query(
      `INSERT INTO lead_statuses (name, color, sort_order, is_won)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), color || '#079965', sort_order || 0, !!is_won]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'כבר קיים סטטוס בשם זה' });
    }
    next(err);
  }
});

/** PUT /api/statuses/:id */
router.put('/:id', isManager, async (req, res, next) => {
  try {
    const { name, color, sort_order, is_won } = req.body;
    const { rows } = await db.query(
      `UPDATE lead_statuses SET
         name = COALESCE($1, name),
         color = COALESCE($2, color),
         sort_order = COALESCE($3, sort_order),
         is_won = COALESCE($4, is_won)
       WHERE id = $5 RETURNING *`,
      [name?.trim() || null, color || null, sort_order ?? null, is_won ?? null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'הסטטוס לא נמצא' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'כבר קיים סטטוס בשם זה' });
    }
    next(err);
  }
});

/** DELETE /api/statuses/:id - לידים עם סטטוס זה יישארו ללא סטטוס */
router.delete('/:id', isManager, async (req, res, next) => {
  try {
    await db.query(`DELETE FROM lead_statuses WHERE id = $1`, [req.params.id]);
    res.json({ message: 'הסטטוס נמחק' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

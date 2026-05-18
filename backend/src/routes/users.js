const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, isManager, isSuperAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const ROLES = ['telephonist', 'manager', 'super_admin'];

/** רשימת משתמשים - מנהל ומעלה. טלפנים רואים רק את רשימת הטלפנים (לצורך שיוך). */
router.get('/', async (req, res, next) => {
  try {
    const onlyTelephonists = req.query.role === 'telephonist';
    if (req.user.role === 'telephonist' && !onlyTelephonists) {
      return res.status(403).json({ error: 'אין הרשאה' });
    }
    const where = onlyTelephonists ? `WHERE role = 'telephonist'` : '';
    const { rows } = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.phone, u.is_active, u.created_at,
             COUNT(l.id) AS leads_count
      FROM users u
      LEFT JOIN leads l ON l.assigned_to = u.id
      ${where}
      GROUP BY u.id
      ORDER BY u.role, u.name
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/** יצירת משתמש - משתמש על בלבד */
router.post('/', isSuperAdmin, async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'נדרשים שם, מייל וסיסמה' });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: 'תפקיד לא תקין' });
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash, role, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, phone, is_active, created_at`,
      [name.trim(), email.trim().toLowerCase(), hash, role, phone || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'כתובת המייל כבר קיימת במערכת' });
    }
    next(err);
  }
});

/** עדכון משתמש - משתמש על בלבד */
router.put('/:id', isSuperAdmin, async (req, res, next) => {
  try {
    const { name, email, role, phone, is_active, password } = req.body;
    if (role && !ROLES.includes(role)) {
      return res.status(400).json({ error: 'תפקיד לא תקין' });
    }
    const fields = [];
    const vals = [];
    let i = 1;
    for (const [col, val] of Object.entries({ name, email, role, phone, is_active })) {
      if (val !== undefined) {
        fields.push(`${col} = $${i++}`);
        vals.push(col === 'email' && val ? String(val).toLowerCase() : val);
      }
    }
    if (password) {
      fields.push(`password_hash = $${i++}`);
      vals.push(await bcrypt.hash(password, 10));
    }
    if (!fields.length) return res.status(400).json({ error: 'אין שדות לעדכון' });
    vals.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE users SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${i} RETURNING id, name, email, role, phone, is_active`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'המשתמש לא נמצא' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'כתובת המייל כבר קיימת במערכת' });
    }
    next(err);
  }
});

/** מחיקת משתמש - משתמש על בלבד */
router.delete('/:id', isSuperAdmin, async (req, res, next) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'אי אפשר למחוק את עצמך' });
    }
    await db.query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
    res.json({ message: 'המשתמש נמחק' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

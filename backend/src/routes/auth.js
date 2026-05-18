const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone };
}

/** התחברות */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'נדרשים מייל וסיסמה' });
    }
    const { rows } = await db.query(
      `SELECT * FROM users WHERE lower(email) = lower($1)`,
      [email.trim()]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'פרטי התחברות שגויים או שהמשתמש מושבת' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'פרטי התחברות שגויים' });
    }
    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

/** פרטי המשתמש המחובר */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(`SELECT * FROM users WHERE id = $1`, [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'המשתמש לא נמצא' });
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

/** שינוי סיסמה של המשתמש המחובר */
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'הסיסמה החדשה חייבת להכיל לפחות 6 תווים' });
    }
    const { rows } = await db.query(`SELECT * FROM users WHERE id = $1`, [req.user.id]);
    const ok = await bcrypt.compare(currentPassword || '', rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'הסיסמה הנוכחית שגויה' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [hash, req.user.id]
    );
    res.json({ message: 'הסיסמה עודכנה' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

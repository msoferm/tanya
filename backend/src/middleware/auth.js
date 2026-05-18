const jwt = require('jsonwebtoken');
const config = require('../config');

/** מאמת JWT ומצרף את פרטי המשתמש ל-req.user */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'נדרשת התחברות' });
  }
  try {
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'הרשאה לא תקפה או שפג תוקפה' });
  }
}

/** מתיר גישה רק לתפקידים מסוימים */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'אין לך הרשאה לפעולה זו' });
    }
    next();
  };
}

/** קיצורים נפוצים */
const isManager = authorize('manager', 'super_admin');
const isSuperAdmin = authorize('super_admin');

module.exports = { authenticate, authorize, isManager, isSuperAdmin };

const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/** GET /api/dashboard/stats - סיכומים. טלפן מקבל נתונים על עצמו בלבד. */
router.get('/stats', async (req, res, next) => {
  try {
    const isAgent = req.user.role === 'telephonist';
    const scope = isAgent ? 'WHERE l.assigned_to = $1' : '';
    const p = isAgent ? [req.user.id] : [];

    const totals = await db.query(`
      SELECT
        COUNT(*)                                                   AS total,
        COUNT(*) FILTER (WHERE l.created_at::date = CURRENT_DATE)   AS today,
        COUNT(*) FILTER (WHERE l.created_at >= date_trunc('week', NOW())) AS this_week,
        COUNT(*) FILTER (WHERE l.is_customer)                       AS customers,
        COUNT(*) FILTER (WHERE l.attended_webinar)                  AS webinar,
        COUNT(*) FILTER (WHERE l.attended_open_day)                 AS open_day
      FROM leads l ${scope}
    `, p);

    const byStatus = await db.query(`
      SELECT s.name, s.color, COUNT(l.id) AS count
      FROM lead_statuses s
      LEFT JOIN leads l ON l.status_id = s.id
        ${isAgent ? 'AND l.assigned_to = $1' : ''}
      GROUP BY s.id ORDER BY s.sort_order
    `, p);

    const bySource = await db.query(`
      SELECT COALESCE(NULLIF(l.utm_source, ''), NULLIF(l.source, ''), 'לא ידוע') AS source,
             COUNT(*) AS count
      FROM leads l ${scope}
      GROUP BY 1 ORDER BY count DESC LIMIT 10
    `, p);

    // חלוקה לפי טלפן - רק למנהלים
    let byAgent = [];
    if (!isAgent) {
      byAgent = (await db.query(`
        SELECT u.id, u.name,
               COUNT(l.id)                                            AS total,
               COUNT(l.id) FILTER (WHERE l.created_at::date = CURRENT_DATE) AS today,
               COUNT(l.id) FILTER (WHERE l.is_customer)               AS customers
        FROM users u
        LEFT JOIN leads l ON l.assigned_to = u.id
        WHERE u.role = 'telephonist'
        GROUP BY u.id ORDER BY u.name
      `)).rows;
    }

    const remindersToday = await db.query(`
      SELECT COUNT(*) FROM reminders r
      WHERE r.remind_at::date = CURRENT_DATE AND r.is_done = FALSE
        ${isAgent ? 'AND r.user_id = $1' : ''}
    `, p);

    const t = totals.rows[0];
    res.json({
      totals: {
        ...t,
        conversion: t.total > 0 ? Math.round((t.customers / t.total) * 100) : 0,
      },
      byStatus: byStatus.rows,
      bySource: bySource.rows,
      byAgent,
      remindersToday: parseInt(remindersToday.rows[0].count, 10),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

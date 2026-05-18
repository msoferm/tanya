/**
 * נתיבי אינטגרציה - WooCommerce, מיילים, חלוקת לידים, מידע על וובהוקים.
 */
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const wc = require('../services/woocommerce');
const email = require('../services/email');
const { authenticate, isSuperAdmin } = require('../middleware/auth');
const { normalizePhone } = require('../utils/phone');

const router = express.Router();
router.use(authenticate);

/** GET /api/integrations/status - מצב החיבורים + כתובות הוובהוק */
router.get('/status', isSuperAdmin, (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.json({
    woocommerce: { enabled: wc.enabled(), url: config.woocommerce.url },
    email: { enabled: email.isEnabled() },
    webhooks: {
      token: config.webhookToken,
      elementorUrl: `${base}/api/webhooks/elementor?token=${config.webhookToken}`,
      woocommerceUrl: `${base}/api/webhooks/woocommerce?token=${config.webhookToken}`,
    },
  });
});

/** POST /api/integrations/woocommerce/test - בדיקת חיבור */
router.post('/woocommerce/test', isSuperAdmin, async (req, res) => {
  try {
    if (!wc.enabled()) {
      return res.status(400).json({ error: 'WooCommerce לא מוגדר בקובץ .env' });
    }
    const result = await wc.testConnection();
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'החיבור ל-WooCommerce נכשל', details: err.message });
  }
});

/**
 * POST /api/integrations/woocommerce/sync
 * מושך הזמנות אחרונות ומסמן לידים תואמים כ"רכשו".
 */
router.post('/woocommerce/sync', isSuperAdmin, async (req, res, next) => {
  try {
    if (!wc.enabled()) {
      return res.status(400).json({ error: 'WooCommerce לא מוגדר' });
    }
    const days = parseInt(req.body.days, 10) || 30;
    const after = new Date(Date.now() - days * 86400000).toISOString();
    const orders = await wc.listRecentOrders({ after, perPage: 100 });

    let matched = 0;
    for (const order of orders) {
      const emailAddr = order.billing?.email ? order.billing.email.toLowerCase() : null;
      const phoneNorm = normalizePhone(order.billing?.phone);
      if (!emailAddr && !phoneNorm) continue;
      const course = order.line_items?.[0]?.name || null;

      const { rows } = await db.query(
        `UPDATE leads SET is_customer = TRUE,
           purchased_at = COALESCE(purchased_at, $1),
           wc_order_id = $2, wc_customer_id = $3,
           course_name = COALESCE(course_name, $4), updated_at = NOW()
         WHERE ($5::text IS NOT NULL AND lower(email) = $5)
            OR ($6::text IS NOT NULL AND phone_normalized = $6)
         RETURNING id`,
        [order.date_created || new Date(), order.id, order.customer_id || null,
         course, emailAddr, phoneNorm]
      );
      matched += rows.length;
    }
    res.json({ ordersChecked: orders.length, leadsMatched: matched });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/integrations/leads/:id/create-account
 * יוצר משתמש באתר ה-WordPress עבור הליד ושולח אליו פרטי התחברות במייל.
 */
router.post('/leads/:id/create-account', isSuperAdmin, async (req, res, next) => {
  try {
    if (!wc.enabled()) {
      return res.status(400).json({ error: 'WooCommerce לא מוגדר' });
    }
    const { rows } = await db.query(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
    const lead = rows[0];
    if (!lead) return res.status(404).json({ error: 'הליד לא נמצא' });
    if (!lead.email) return res.status(400).json({ error: 'לליד אין כתובת מייל' });

    const password = crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '') + '!7';
    const [firstName, ...rest] = String(lead.name || '').trim().split(/\s+/);

    const { customer, created } = await wc.createCustomer({
      email: lead.email,
      firstName: firstName || '',
      lastName: rest.join(' '),
      password,
      phone: lead.phone,
    });

    const mailResult = await email.sendCourseCredentials({
      to: lead.email,
      name: lead.name,
      username: customer.username || lead.email,
      password,
      loginUrl: wc.loginUrl(),
      courseName: req.body.courseName || lead.course_name,
    });

    await db.query(
      `UPDATE leads SET wc_customer_id = $1, course_name = COALESCE($2, course_name),
         updated_at = NOW() WHERE id = $3`,
      [customer.id, req.body.courseName || null, lead.id]
    );
    await db.query(
      `INSERT INTO lead_history (lead_id, user_id, action, details)
       VALUES ($1, $2, 'account_created', $3)`,
      [lead.id, req.user.id,
       `נוצר חשבון באתר (#${customer.id})${mailResult.sent ? ' ונשלח מייל' : ' - המייל לא נשלח'}`]
    );

    res.json({
      ok: true,
      wcCustomerId: customer.id,
      alreadyExisted: !created,
      emailSent: mailResult.sent,
    });
  } catch (err) {
    const detail = err.response?.data?.message || err.message;
    res.status(502).json({ error: 'יצירת החשבון נכשלה', details: detail });
  }
});

/** GET / PUT  /api/integrations/distribution - הגדרות חלוקת לידים */
router.get('/distribution', isSuperAdmin, async (req, res, next) => {
  try {
    const { rows } = await db.query(`SELECT value FROM settings WHERE key = 'distribution'`);
    res.json(rows[0]?.value || { mode: 'balanced', enabled: true });
  } catch (err) {
    next(err);
  }
});

router.put('/distribution', isSuperAdmin, async (req, res, next) => {
  try {
    const value = { mode: 'balanced', enabled: req.body.enabled !== false };
    await db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('distribution', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(value)]
    );
    res.json(value);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

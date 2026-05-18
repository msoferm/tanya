/**
 * נתיבי וובהוק - נקראים ע"י מערכות חיצוניות (אלמנטור, WooCommerce).
 * אין כאן JWT - האימות נעשה ע"י WEBHOOK_TOKEN.
 */
const express = require('express');
const db = require('../db');
const config = require('../config');
const { createLead } = require('../services/leads');
const { normalizePhone } = require('../utils/phone');

const router = express.Router();

/** אימות הטוקן - מתוך query, header או גוף הבקשה */
function checkToken(req, res, next) {
  const token = req.query.token || req.headers['x-webhook-token'] || req.body.token;
  if (token !== config.webhookToken) {
    return res.status(401).json({ error: 'טוקן וובהוק שגוי' });
  }
  next();
}

/** משטח אובייקט מקונן (form_fields[name]) למפתחות פשוטים */
function flatten(obj, out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      // אלמנטור שולח לעיתים { value: '...' }
      if ('value' in v) out[k.toLowerCase()] = v.value;
      else flatten(v, out);
    } else {
      out[k.toLowerCase()] = v;
    }
  }
  return out;
}

/** מאתר ערך לפי כמה שמות מפתח אפשריים */
function pick(flat, names) {
  for (const n of names) {
    if (flat[n] != null && flat[n] !== '') return flat[n];
  }
  return null;
}

/**
 * POST /api/webhooks/elementor?token=...
 * קולט שליחת טופס מאלמנטור Pro (פעולת Webhook) כולל פרמטרי UTM.
 */
router.post('/elementor', checkToken, async (req, res, next) => {
  const client = await db.getClient();
  try {
    // אלמנטור עשוי לשלוח form_fields/fields או שדות שטוחים
    const source = req.body.form_fields || req.body.fields || req.body;
    const flat = flatten(source);
    // צירוף שדות שטוחים נוספים מגוף הבקשה (page_url וכד')
    flatten(req.body, flat);

    const data = {
      name: pick(flat, ['name', 'full_name', 'fullname', 'שם', 'שם מלא']),
      phone: pick(flat, ['phone', 'tel', 'telephone', 'mobile', 'טלפון', 'נייד']),
      email: pick(flat, ['email', 'e-mail', 'מייל', 'אימייל']),
      notes: pick(flat, ['message', 'notes', 'הודעה', 'הערות']),
      utm_source: pick(flat, ['utm_source']),
      utm_medium: pick(flat, ['utm_medium']),
      utm_campaign: pick(flat, ['utm_campaign']),
      utm_term: pick(flat, ['utm_term']),
      utm_content: pick(flat, ['utm_content']),
      landing_page: pick(flat, ['page_url', 'landing_page', 'referrer', 'page-url']),
    };
    data.source = data.utm_source || data.utm_campaign || 'טופס אתר';

    await client.query('BEGIN');
    const result = await createLead(client, data, {
      autoAssign: true,
      sourceLabel: `אלמנטור${data.utm_source ? ' / ' + data.utm_source : ''}`,
    });
    await client.query('COMMIT');

    if (result.duplicate) {
      return res.json({ ok: true, duplicate: true, leadId: result.lead.id });
    }
    res.status(201).json({ ok: true, leadId: result.lead.id, assignedTo: result.lead.assigned_to });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * POST /api/webhooks/woocommerce?token=...
 * קולט וובהוק הזמנה מ-WooCommerce ומסמן את הליד התואם כ"רכש".
 */
router.post('/woocommerce', checkToken, async (req, res, next) => {
  try {
    const order = req.body;
    // WooCommerce שולח לעיתים בקשת ping ריקה בעת יצירת הוובהוק
    if (!order || !order.id) return res.json({ ok: true, ping: true });

    const email = order.billing?.email ? order.billing.email.toLowerCase() : null;
    const phoneNorm = normalizePhone(order.billing?.phone);
    const course = order.line_items?.[0]?.name || null;

    const { rows } = await db.query(
      `UPDATE leads SET
         is_customer = TRUE,
         purchased_at = COALESCE(purchased_at, NOW()),
         wc_order_id = $1,
         wc_customer_id = $2,
         course_name = COALESCE(course_name, $3),
         updated_at = NOW()
       WHERE ($4::text IS NOT NULL AND lower(email) = $4)
          OR ($5::text IS NOT NULL AND phone_normalized = $5)
       RETURNING id`,
      [order.id, order.customer_id || null, course, email, phoneNorm]
    );

    for (const r of rows) {
      await db.query(
        `INSERT INTO lead_history (lead_id, action, details)
         VALUES ($1, 'purchase', $2)`,
        [r.id, `רכישה זוהתה - הזמנה #${order.id}${course ? ' / ' + course : ''}`]
      );
    }
    res.json({ ok: true, matchedLeads: rows.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

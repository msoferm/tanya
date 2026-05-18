const express = require('express');
const multer = require('multer');
const db = require('../db');
const { authenticate, isManager, isSuperAdmin } = require('../middleware/auth');
const { parseBuffer, mapRow, buildLeadsWorkbook, FIELD_LABELS } = require('../services/excel');
const { createLead } = require('../services/leads');
const { normalizePhone } = require('../utils/phone');

const router = express.Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/** רשימת השדות הזמינים לייבוא/ייצוא */
router.get('/fields', (req, res) => {
  res.json(Object.entries(FIELD_LABELS).map(([key, label]) => ({ key, label })));
});

/**
 * POST /api/import-export/import
 * שדות: file, columnMap (JSON), dryRun ('true' לתצוגה מקדימה), autoAssign
 * dryRun=true -> מנתח ומחזיר אילו שורות ייובאו ואילו ייחסמו, ללא שמירה.
 */
router.post('/import', isSuperAdmin, upload.single('file'), async (req, res, next) => {
  const client = await db.getClient();
  try {
    if (!req.file) return res.status(400).json({ error: 'לא צורף קובץ' });
    const dryRun = req.body.dryRun === 'true';
    const autoAssign = req.body.autoAssign === 'true';
    const columnMap = req.body.columnMap ? JSON.parse(req.body.columnMap) : null;

    const { headers, rows } = parseBuffer(req.file.buffer);

    // מיפוי סטטוסים ומשתמשים לפי שם
    const statusRows = (await client.query(`SELECT id, name FROM lead_statuses`)).rows;
    const statusByName = new Map(statusRows.map((s) => [s.name.trim().toLowerCase(), s.id]));
    const userRows = (await client.query(
      `SELECT id, name FROM users WHERE role = 'telephonist'`
    )).rows;
    const userByName = new Map(userRows.map((u) => [u.name.trim().toLowerCase(), u.id]));

    const report = { total: rows.length, imported: 0, skipped: 0, errors: [], headers };
    const seenInFile = new Set(); // למניעת כפילויות בתוך הקובץ עצמו

    await client.query('BEGIN');
    for (let idx = 0; idx < rows.length; idx++) {
      const rowNum = idx + 2; // שורה 1 = כותרות
      const mapped = mapRow(rows[idx], columnMap);

      // אימות בסיסי
      if (!mapped.name && !mapped.phone && !mapped.email) {
        report.skipped++;
        report.errors.push({ row: rowNum, reason: 'שורה ריקה - אין שם, טלפון או מייל' });
        continue;
      }

      // כפילות בתוך הקובץ
      const norm = normalizePhone(mapped.phone);
      const emailKey = mapped.email ? String(mapped.email).trim().toLowerCase() : null;
      const fileKey = norm || emailKey;
      if (fileKey && seenInFile.has(fileKey)) {
        report.skipped++;
        report.errors.push({ row: rowNum, reason: 'כפילות בתוך הקובץ', value: fileKey });
        continue;
      }
      if (fileKey) seenInFile.add(fileKey);

      // התאמת סטטוס/טלפן לפי שם
      if (mapped.status) {
        const sid = statusByName.get(String(mapped.status).trim().toLowerCase());
        if (sid) mapped.status_id = sid;
        else report.errors.push({ row: rowNum, reason: `סטטוס לא מוכר: "${mapped.status}" - יוגדר ברירת מחדל`, warning: true });
      }
      if (mapped.assigned_to_name) {
        const uid = userByName.get(String(mapped.assigned_to_name).trim().toLowerCase());
        if (uid) mapped.assigned_to = uid;
      }

      const result = await createLead(client, mapped, {
        autoAssign,
        actorId: req.user.id,
        sourceLabel: mapped.source || 'ייבוא אקסל',
      });
      if (result.duplicate) {
        report.skipped++;
        report.errors.push({
          row: rowNum,
          reason: 'הליד כבר קיים במערכת - לא נדרס',
          value: result.lead.phone || result.lead.email,
          existingLeadId: result.lead.id,
        });
      } else {
        report.imported++;
      }
    }

    if (dryRun) {
      await client.query('ROLLBACK');
      report.dryRun = true;
      return res.json(report);
    }

    // שמירת יומן הייבוא
    await client.query(
      `INSERT INTO import_logs (user_id, filename, total_rows, imported, skipped, errors)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, req.file.originalname, report.total, report.imported,
       report.skipped, JSON.stringify(report.errors)]
    );
    await client.query('COMMIT');
    res.json(report);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/** GET /api/import-export/logs - יומני ייבוא קודמים */
router.get('/logs', isSuperAdmin, async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT il.*, u.name AS user_name FROM import_logs il
      LEFT JOIN users u ON u.id = il.user_id
      ORDER BY il.created_at DESC LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/import-export/export
 * ?fields=name,phone,...  + אותם פילטרים כמו במסך הלידים
 * מייצא קובץ Excel.
 */
router.get('/export', isManager, async (req, res, next) => {
  try {
    const fields = req.query.fields ? String(req.query.fields).split(',') : null;
    const params = [];
    const where = [];
    if (req.query.status_id) { params.push(req.query.status_id); where.push(`l.status_id = $${params.length}`); }
    if (req.query.assigned_to) { params.push(req.query.assigned_to); where.push(`l.assigned_to = $${params.length}`); }
    if (req.query.is_customer === 'true') where.push('l.is_customer = TRUE');
    if (req.query.date_from) { params.push(req.query.date_from); where.push(`l.created_at >= $${params.length}`); }
    if (req.query.date_to) { params.push(req.query.date_to); where.push(`l.created_at <= ($${params.length}::date + 1)`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await db.query(`
      SELECT l.*, s.name AS status, u.name AS assigned_to_name
      FROM leads l
      LEFT JOIN lead_statuses s ON s.id = l.status_id
      LEFT JOIN users u ON u.id = l.assigned_to
      ${whereSql}
      ORDER BY l.created_at DESC
    `, params);

    const buffer = buildLeadsWorkbook(rows, fields);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

/** GET /api/import-export/template - תבנית אקסל ריקה לייבוא */
router.get('/template', isSuperAdmin, (req, res) => {
  const buffer = buildLeadsWorkbook([{
    name: 'ישראל ישראלי', phone: '0501234567', email: 'demo@example.com',
    status: 'ליד חדש', source: 'דוגמה',
  }], ['name', 'phone', 'email', 'status', 'source', 'notes',
       'attended_open_day', 'attended_webinar', 'webinar_minutes', 'course_name']);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="leads-template.xlsx"');
  res.send(buffer);
});

module.exports = router;

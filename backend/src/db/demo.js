/**
 * הזנת נתוני דמו להמחשת המערכת.
 * שימוש:  npm run db:demo
 * בטוח להרצה חוזרת - לידים קיימים (לפי טלפון) לא נדרסים.
 */
const { pool } = require('../db');
const { normalizePhone } = require('../utils/phone');

const FIRST = ['דוד', 'שרה', 'משה', 'רחל', 'יוסף', 'חנה', 'אברהם', 'מרים',
  'יעקב', 'לאה', 'שמואל', 'אסתר', 'מנחם', 'שירה', 'יצחק', 'נועה',
  'בנימין', 'מיכל', 'אריה', 'יעל', 'שלום', 'איריס', 'עמית', 'גילה',
  'ראובן', 'ברכה', 'נתן', 'דינה', 'אליהו', 'תמר', 'זאב', 'חוה',
  'גדעון', 'רונית', 'אורי', 'סיגל'];
const LAST = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אזולאי', 'דהן', 'פרידמן',
  'רוזנברג', 'שפירא', 'גולדשטיין', 'וייס', 'אדרי', 'חדד', 'גבאי', 'אוחיון',
  'בן דוד', 'טל', 'ברק', 'שמש'];
const MAILNAMES = ['david', 'sara', 'moshe', 'rachel', 'yossi', 'chana', 'avi',
  'miri', 'yaakov', 'lea', 'shmuel', 'esti'];
const MAILDOMAINS = ['gmail.com', 'walla.co.il', 'hotmail.com', 'outlook.com'];

// התפלגות סטטוסים - משקף משפך מכירה מציאותי
const STATUS_FLOW = [
  'ליד חדש', 'ליד חדש', 'ליד חדש', 'ליד חדש', 'ליד חדש',
  'בטיפול', 'בטיפול', 'בטיפול', 'בטיפול',
  'אין מענה', 'אין מענה', 'אין מענה',
  'תיאום שיחה', 'תיאום שיחה',
  'הוזמן ליום פתוח', 'הוזמן ליום פתוח',
  'נרשם לוובינר', 'נרשם לוובינר',
  'סגר / רכש', 'סגר / רכש', 'סגר / רכש',
  'לא רלוונטי', 'לא רלוונטי',
];

const SOURCES = [
  { source: 'פייסבוק - קמפיין תניא', utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'tanya-intro' },
  { source: 'גוגל - חיפוש', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'search-brand' },
  { source: 'אינסטגרם', utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'reels-may' },
  { source: 'קמפיין יום עיון', utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'open-day' },
  { source: 'הפניה מחבר', utm_source: '', utm_medium: 'referral', utm_campaign: '' },
  { source: 'דיוור במייל', utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'weekly' },
  { source: 'יוטיוב', utm_source: 'youtube', utm_medium: 'video', utm_campaign: 'shiur-clip' },
  { source: 'אתר - אורגני', utm_source: 'google', utm_medium: 'organic', utm_campaign: '' },
];

const COURSES = ['יסודות התניא', 'תניא לעמקים', 'מסע בנפש האלוקית', 'שער הייחוד והאמונה'];

const NOTES = [
  'מעוניין מאוד, ביקש לחזור אחרי החגים',
  'השאיר הודעה - לא ענה פעמיים',
  'שאל על מחיר ומלגות',
  'בוגר קורס קודם, רוצה להעמיק',
  'התעניין דרך חבר שלמד אצלנו',
  'ביקש חומר לקריאה לפני החלטה',
  '', '', '',
];

async function run() {
  const client = await pool.connect();
  try {
    // עדכון שמות הטלפנים לשמות בעברית
    const agentNames = ['מנחם ברגר', 'שניאור רוזן', 'לוי יצחק כהן', 'מענדי הולצמן'];
    const agents = (await client.query(
      `SELECT id FROM users WHERE role = 'telephonist' ORDER BY id LIMIT 4`
    )).rows;
    for (let i = 0; i < agents.length && i < agentNames.length; i++) {
      await client.query(`UPDATE users SET name = $1 WHERE id = $2`,
        [agentNames[i], agents[i].id]);
    }
    if (!agents.length) throw new Error('לא נמצאו טלפנים - הריצו קודם npm run db:init');

    // מיפוי סטטוסים
    const statusRows = (await client.query(`SELECT id, name FROM lead_statuses`)).rows;
    const statusId = (name) => statusRows.find((s) => s.name === name)?.id || null;

    let created = 0;
    let skipped = 0;
    const insertedLeadIds = [];

    for (let i = 0; i < 34; i++) {
      const first = FIRST[i % FIRST.length];
      const last = LAST[(i * 7) % LAST.length];
      const name = `${first} ${last}`;
      const phone = '05' + ['0', '2', '3', '4', '5', '8'][i % 6] +
        String(2000000 + i * 137).padStart(7, '0').slice(-7);
      const hasEmail = i % 3 !== 0; // ~2/3 מהלידים עם מייל
      const email = hasEmail
        ? `${MAILNAMES[i % MAILNAMES.length]}${100 + i}@${MAILDOMAINS[i % MAILDOMAINS.length]}`
        : null;

      const statusName = STATUS_FLOW[i % STATUS_FLOW.length];
      const sid = statusId(statusName);
      const src = SOURCES[i % SOURCES.length];
      const agentId = agents[i % agents.length].id;

      const isWon = statusName === 'סגר / רכש';
      const attendedWebinar = ['נרשם לוובינר', 'סגר / רכש', 'תיאום שיחה'].includes(statusName) && i % 2 === 0;
      const webinarMin = attendedWebinar ? [12, 28, 35, 47, 58, 64][i % 6] : null;
      const attendedOpenDay = ['הוזמן ליום פתוח', 'סגר / רכש'].includes(statusName) && i % 3 === 0;
      const course = isWon ? COURSES[i % COURSES.length] : null;
      const daysAgo = (i * 31) % 40; // פיזור על פני ~40 יום
      const updatedAgo = Math.max(0, daysAgo - (i % 5));

      const phoneNorm = normalizePhone(phone);
      const res = await client.query(
        `INSERT INTO leads
          (name, phone, phone_normalized, email, status_id, notes, assigned_to,
           source, utm_source, utm_medium, utm_campaign,
           attended_open_day, attended_webinar, webinar_minutes,
           is_customer, purchased_at, course_name, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
           NOW() - ($18 || ' days')::interval,
           NOW() - ($19 || ' days')::interval)
         ON CONFLICT (phone_normalized) WHERE phone_normalized IS NOT NULL DO NOTHING
         RETURNING id`,
        [name, phone, phoneNorm, email, sid, NOTES[i % NOTES.length], agentId,
         src.source, src.utm_source, src.utm_medium, src.utm_campaign,
         attendedOpenDay, attendedWebinar, webinarMin,
         isWon, isWon ? new Date(Date.now() - updatedAgo * 86400000) : null,
         course, String(daysAgo), String(updatedAgo)]
      );
      if (res.rows[0]) {
        created++;
        insertedLeadIds.push({ id: res.rows[0].id, agentId });
        await client.query(
          `INSERT INTO lead_history (lead_id, action, details)
           VALUES ($1, 'created', 'ליד דמו')`,
          [res.rows[0].id]
        );
      } else {
        skipped++;
      }
    }

    // תזכורות לדוגמה - על חלק מהלידים
    let reminders = 0;
    const reminderNotes = ['לחזור עם פרטי מלגה', 'לוודא שקיבל חומר', 'שיחת המשך',
      'לתאם יום פתוח', 'לבדוק אם נרשם'];
    const offsets = [0, 0, 1, 1, 2, 3, -1, 0]; // ימים מהיום (כולל באיחור)
    for (let k = 0; k < Math.min(8, insertedLeadIds.length); k++) {
      const lead = insertedLeadIds[k * 3];
      if (!lead) continue;
      const at = new Date();
      at.setDate(at.getDate() + offsets[k]);
      at.setHours(9 + (k % 8), k % 2 ? 30 : 0, 0, 0);
      await client.query(
        `INSERT INTO reminders (lead_id, user_id, remind_at, note)
         VALUES ($1, $2, $3, $4)`,
        [lead.id, lead.agentId, at, reminderNotes[k % reminderNotes.length]]
      );
      reminders++;
    }

    console.log(`✅ נוצרו ${created} לידים (דולגו ${skipped} שכבר קיימים)`);
    console.log(`✅ נוצרו ${reminders} תזכורות`);
    console.log(`✅ עודכנו שמות הטלפנים: ${agentNames.join(', ')}`);
  } catch (err) {
    console.error('❌ הזנת הדמו נכשלה:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();

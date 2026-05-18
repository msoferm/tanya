/**
 * חלוקת לידים שווה בין הטלפנים.
 *
 * הרעיון: כל ליד חדש משויך לטלפן הפעיל עם הכי מעט לידים שנקלטו *היום*.
 * כך אם נכנסו 20 לידים ויש 4 טלפנים - כל אחד מקבל 5.
 * במקרה תיקו נשמרת רוט ציה לפי distribution_state כדי שהחלוקה תהיה הוגנת
 * גם כשהלידים נכנסים אחד-אחד.
 */

/** מחזיר את מזהה הטלפן שאליו יש לשייך את הליד הבא, או null אם אין טלפנים פעילים. */
async function pickTelephonist(client) {
  // בדיקה אם החלוקה האוטומטית מופעלת
  const cfg = await client.query(
    `SELECT value FROM settings WHERE key = 'distribution'`
  );
  const enabled = cfg.rows[0]?.value?.enabled !== false;
  if (!enabled) return null;

  const { rows } = await client.query(`
    SELECT u.id,
           COUNT(l.id) FILTER (
             WHERE l.created_at::date = CURRENT_DATE
           ) AS today_count
    FROM users u
    LEFT JOIN leads l ON l.assigned_to = u.id
    WHERE u.role = 'telephonist' AND u.is_active = TRUE
    GROUP BY u.id
    ORDER BY today_count ASC, u.id ASC
  `);
  if (rows.length === 0) return null;

  const minCount = rows[0].today_count;
  const tied = rows.filter((r) => r.today_count === minCount);

  let chosen;
  if (tied.length === 1) {
    chosen = tied[0].id;
  } else {
    // שובר תיקו: הטלפן הבא בתור אחרי האחרון שקיבל ליד
    const stateRes = await client.query(
      `SELECT last_user_id FROM distribution_state WHERE id = 1`
    );
    const lastId = stateRes.rows[0]?.last_user_id;
    const idx = tied.findIndex((r) => r.id === lastId);
    chosen = tied[(idx + 1) % tied.length].id;
  }

  await client.query(
    `UPDATE distribution_state SET last_user_id = $1 WHERE id = 1`,
    [chosen]
  );
  return chosen;
}

module.exports = { pickTelephonist };

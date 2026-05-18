-- ============================================================
--  נתוני התחלה - מערכת ניהול לידים אקדמיה לתניא
--  (משתמשי ההתחלה נוצרים בנפרד ע"י init.js עם הצפנת bcrypt)
-- ============================================================

-- ---------- סטטוסים ברירת מחדל ----------
INSERT INTO lead_statuses (name, color, sort_order, is_won) VALUES
  ('ליד חדש',        '#079965', 1, FALSE),
  ('בטיפול',         '#0ea5e9', 2, FALSE),
  ('אין מענה',       '#f59e0b', 3, FALSE),
  ('תיאום שיחה',     '#8b5cf6', 4, FALSE),
  ('הוזמן ליום פתוח','#6366f1', 5, FALSE),
  ('נרשם לוובינר',   '#14b8a6', 6, FALSE),
  ('סגר / רכש',      '#16a34a', 7, TRUE),
  ('לא רלוונטי',     '#6b7280', 8, FALSE)
ON CONFLICT (name) DO NOTHING;

-- ---------- הגדרות ברירת מחדל ----------
INSERT INTO settings (key, value) VALUES
  ('distribution', '{"mode":"balanced","enabled":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

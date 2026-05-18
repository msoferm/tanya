-- ============================================================
--  מערכת ניהול לידים - אקדמיה לתניא
--  סכמת מסד נתונים PostgreSQL
-- ============================================================

-- ---------- משתמשים ----------
-- 3 סוגי משתמשים:
--   telephonist  - טלפן: רואה רק את הלידים שלו
--   manager      - מנהל: רואה את כל הלידים, דשבורד, סטטוסים
--   super_admin  - משתמש על: הכל כולל ניהול משתמשים, ייבוא/ייצוא והגדרות
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'telephonist'
                CHECK (role IN ('telephonist', 'manager', 'super_admin')),
  phone         VARCHAR(40),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------- סטטוסים של לקוח (ניתנים ליצירה חופשית) ----------
CREATE TABLE IF NOT EXISTS lead_statuses (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(80) NOT NULL UNIQUE,
  color      VARCHAR(20) NOT NULL DEFAULT '#079965',
  sort_order INTEGER     NOT NULL DEFAULT 0,
  is_won     BOOLEAN     NOT NULL DEFAULT FALSE,  -- סטטוס שמסמן "סגר/קנה"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- לידים ----------
CREATE TABLE IF NOT EXISTS leads (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(160),
  phone             VARCHAR(40),
  phone_normalized  VARCHAR(40),                 -- מספר מנורמל לזיהוי כפילויות
  email             VARCHAR(160),
  status_id         INTEGER REFERENCES lead_statuses(id) ON DELETE SET NULL,
  notes             TEXT,
  assigned_to       INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- מקור הליד + UTM (נקלט מטופס האלמנטור)
  source            VARCHAR(160),
  utm_source        VARCHAR(160),
  utm_medium        VARCHAR(160),
  utm_campaign      VARCHAR(160),
  utm_term          VARCHAR(160),
  utm_content       VARCHAR(160),
  landing_page      TEXT,

  -- נתוני מעורבות
  attended_open_day BOOLEAN NOT NULL DEFAULT FALSE,  -- היה ביום פתוח
  attended_webinar  BOOLEAN NOT NULL DEFAULT FALSE,  -- היה בוובינר
  webinar_minutes   INTEGER,                         -- כמה דקות היה בוובינר

  -- מצב רכישה / סנכרון WooCommerce
  is_customer       BOOLEAN NOT NULL DEFAULT FALSE,
  purchased_at      TIMESTAMPTZ,
  wc_order_id       BIGINT,
  wc_customer_id    BIGINT,
  course_name       VARCHAR(200),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- מתי הליד נרשם
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()   -- עדכון אחרון
);

-- מניעת כפילויות: מספר טלפון מנורמל ייחודי, ומייל ייחודי (כשקיים)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_leads_phone
  ON leads (phone_normalized) WHERE phone_normalized IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_leads_email
  ON leads (lower(email)) WHERE email IS NOT NULL AND email <> '';

CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status   ON leads (status_id);
CREATE INDEX IF NOT EXISTS idx_leads_created  ON leads (created_at);
CREATE INDEX IF NOT EXISTS idx_leads_phone_search ON leads (phone_normalized text_pattern_ops);

-- ---------- תזכורות ----------
CREATE TABLE IF NOT EXISTS reminders (
  id         SERIAL PRIMARY KEY,
  lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remind_at  TIMESTAMPTZ NOT NULL,
  note       TEXT,
  is_done    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders (user_id, remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_lead ON reminders (lead_id);

-- ---------- יומן פעילות על ליד ----------
CREATE TABLE IF NOT EXISTS lead_history (
  id         SERIAL PRIMARY KEY,
  lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(60) NOT NULL,
  details    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_history_lead ON lead_history (lead_id, created_at DESC);

-- ---------- יומן ייבוא ----------
CREATE TABLE IF NOT EXISTS import_logs (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  filename      VARCHAR(260),
  total_rows    INTEGER NOT NULL DEFAULT 0,
  imported      INTEGER NOT NULL DEFAULT 0,
  skipped       INTEGER NOT NULL DEFAULT 0,
  errors        JSONB   NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- הגדרות מערכת (מפתח/ערך) ----------
CREATE TABLE IF NOT EXISTS settings (
  key        VARCHAR(80) PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- אינדקס סדר רוטציה לחלוקת לידים שווה בין הטלפנים
CREATE TABLE IF NOT EXISTS distribution_state (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  last_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  CHECK (id = 1)
);
INSERT INTO distribution_state (id) VALUES (1) ON CONFLICT DO NOTHING;

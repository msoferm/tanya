require('dotenv').config();

module.exports = {
  // PORT אינו נקרא מ-.env בכוונה - הוא שמור ע"י Cloud Run בפרודקשן.
  port: process.env.PORT || 5001,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5174',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_insecure_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },
  webhookToken: process.env.WEBHOOK_TOKEN || 'dev_webhook_token',
  db: {
    // אם הוגדר DATABASE_URL (למשל Supabase) הוא קודם לפרמטרים הבדידים
    connectionString: process.env.DATABASE_URL || null,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'tanya_leads',
    user: process.env.DB_USER || 'tanya_user',
    password: process.env.DB_PASSWORD || 'tanya_secret_2024',
    // SSL נדרש לחיבור מנוהל בענן (Supabase). מקומית - כבוי.
    ssl: process.env.DB_SSL === 'true' || Boolean(process.env.DATABASE_URL),
  },
  woocommerce: {
    url: process.env.WC_URL || '',
    consumerKey: process.env.WC_CONSUMER_KEY || '',
    consumerSecret: process.env.WC_CONSUMER_SECRET || '',
    get enabled() {
      return Boolean(this.url && this.consumerKey && this.consumerSecret);
    },
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'אקדמיה לתניא',
    get enabled() {
      return Boolean(this.host && this.user && this.pass);
    },
  },
};

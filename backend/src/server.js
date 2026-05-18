const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');

const app = express();

app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan('dev'));
// וובהוקים של אלמנטור נשלחים לרוב כ-form-urlencoded
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// נתיבים
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/statuses', require('./routes/statuses'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/import-export', require('./routes/importExport'));
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/webhooks', require('./routes/webhooks'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'tanya-leads', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'הנתיב לא נמצא' });
});

// טיפול שגיאות מרכזי
app.use((err, req, res, next) => {
  console.error('❌', err.stack || err.message);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    error: err.publicMessage || 'שגיאת שרת פנימית',
    details: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
});

// הרצה כשרת עצמאי (פיתוח מקומי / VPS) - לא בסביבת Cloud Functions
if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`🚀 שרת מערכת הלידים פועל על פורט ${config.port}`);
    console.log(`   WooCommerce: ${config.woocommerce.enabled ? 'מחובר' : 'לא מוגדר'}`);
    console.log(`   מיילים:     ${config.smtp.enabled ? 'מוגדר' : 'לא מוגדר'}`);
  });
}

module.exports = app;

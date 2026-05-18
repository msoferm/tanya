const { Pool } = require('pg');
const config = require('./config');

// בסביבת Cloud Functions (serverless) שומרים על מאגר חיבורים קטן.
const isServerless = Boolean(process.env.FUNCTION_TARGET || process.env.K_SERVICE);

const poolConfig = config.db.connectionString
  ? { connectionString: config.db.connectionString }
  : {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
    };

if (config.db.ssl) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

poolConfig.max = isServerless ? 3 : 20;
poolConfig.idleTimeoutMillis = 30000;
poolConfig.connectionTimeoutMillis = 10000;

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('❌ שגיאת מסד נתונים:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};

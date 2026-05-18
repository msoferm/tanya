/**
 * אתחול מסד הנתונים: schema.sql, seed.sql ויצירת משתמשי התחלה.
 * שימוש:  npm run db:init
 * בטוח להרצה חוזרת - לא דורס נתונים קיימים.
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

// משתמשי התחלה
const SEED_USERS = [
  { name: 'מנהל מערכת', email: 'admin@tanya.local', password: 'Admin123!', role: 'super_admin' },
  { name: 'טלפן 1', email: 'agent1@tanya.local', password: 'Tanya123!', role: 'telephonist' },
  { name: 'טלפן 2', email: 'agent2@tanya.local', password: 'Tanya123!', role: 'telephonist' },
  { name: 'טלפן 3', email: 'agent3@tanya.local', password: 'Tanya123!', role: 'telephonist' },
  { name: 'טלפן 4', email: 'agent4@tanya.local', password: 'Tanya123!', role: 'telephonist' },
];

async function run() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');

  const client = await pool.connect();
  try {
    console.log('⏳ יוצר טבלאות...');
    await client.query(schema);
    console.log('✅ הטבלאות נוצרו');

    console.log('⏳ מזין סטטוסים והגדרות...');
    await client.query(seed);
    console.log('✅ נתוני ההתחלה הוזנו');

    console.log('⏳ יוצר משתמשי התחלה...');
    for (const u of SEED_USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      await client.query(
        `INSERT INTO users (name, email, password_hash, role, phone)
         VALUES ($1, $2, $3, $4, '')
         ON CONFLICT (email) DO NOTHING`,
        [u.name, u.email, hash, u.role]
      );
    }
    console.log('✅ המשתמשים נוצרו');

    console.log('\n🔑 פרטי כניסה ראשוניים:');
    console.log('   משתמש על:  admin@tanya.local  /  Admin123!');
    console.log('   טלפנים:    agent1..4@tanya.local  /  Tanya123!');
    console.log('\n⚠️  החליפו את הסיסמאות אחרי הכניסה הראשונה.');
  } catch (err) {
    console.error('❌ אתחול נכשל:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();

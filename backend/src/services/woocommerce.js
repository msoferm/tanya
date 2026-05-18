/**
 * אינטגרציה עם WooCommerce דרך ה-REST API.
 * דורש WC_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET בקובץ .env
 */
const axios = require('axios');
const config = require('../config');

function client() {
  if (!config.woocommerce.enabled) {
    throw new Error('WooCommerce לא מוגדר - מלאו WC_URL ומפתחות API בקובץ .env');
  }
  return axios.create({
    baseURL: `${config.woocommerce.url.replace(/\/$/, '')}/wp-json/wc/v3`,
    auth: {
      username: config.woocommerce.consumerKey,
      password: config.woocommerce.consumerSecret,
    },
    timeout: 20000,
  });
}

/** שליפת הזמנות שעודכנו לאחרונה (לסנכרון רכישות) */
async function listRecentOrders({ after, perPage = 50, page = 1 } = {}) {
  const params = { per_page: perPage, page, orderby: 'date', order: 'desc' };
  if (after) params.after = after; // ISO date
  const res = await client().get('/orders', { params });
  return res.data;
}

/** שליפת הזמנה בודדת */
async function getOrder(id) {
  const res = await client().get(`/orders/${id}`);
  return res.data;
}

/** חיפוש לקוח קיים לפי מייל */
async function findCustomerByEmail(email) {
  const res = await client().get('/customers', { params: { email, per_page: 1 } });
  return res.data[0] || null;
}

/** יצירת לקוח חדש באתר. אם כבר קיים - מחזיר את הקיים. */
async function createCustomer({ email, firstName, lastName, username, password, phone }) {
  const existing = await findCustomerByEmail(email);
  if (existing) return { customer: existing, created: false };

  const payload = {
    email,
    first_name: firstName || '',
    last_name: lastName || '',
    username: username || email,
    password,
    billing: { first_name: firstName || '', last_name: lastName || '', email, phone: phone || '' },
  };
  const res = await client().post('/customers', payload);
  return { customer: res.data, created: true };
}

/** בדיקת חיבור - מחזיר את שם החנות אם החיבור תקין */
async function testConnection() {
  const res = await client().get('/system_status');
  return {
    ok: true,
    environment: res.data?.environment?.site_url,
    wcVersion: res.data?.environment?.version,
  };
}

module.exports = {
  enabled: () => config.woocommerce.enabled,
  loginUrl: () => `${config.woocommerce.url.replace(/\/$/, '')}/my-account`,
  listRecentOrders,
  getOrder,
  findCustomerByEmail,
  createCustomer,
  testConnection,
};

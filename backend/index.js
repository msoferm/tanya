/**
 * נקודת הכניסה ל-Firebase Cloud Functions.
 * כל ה-API נחשף כפונקציה אחת בשם "api"; Firebase Hosting מנתב אליה /api/**.
 */
const { onRequest } = require('firebase-functions/v2/https');
const app = require('./src/server');

exports.api = onRequest(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
    maxInstances: 10,
  },
  app
);

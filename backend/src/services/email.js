const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;
if (config.smtp.enabled) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
}

/** שולח מייל. אם SMTP לא מוגדר - לא קורס, רק מחזיר sent:false. */
async function sendMail({ to, subject, html, text }) {
  if (!transporter) {
    console.warn('⚠️  SMTP לא מוגדר - דילוג על שליחת מייל אל', to);
    return { sent: false, reason: 'smtp_not_configured' };
  }
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text,
    html,
  });
  return { sent: true };
}

/** מייל פרטי התחברות לקורס באתר */
async function sendCourseCredentials({ to, name, username, password, loginUrl, courseName }) {
  const subject = 'פרטי הכניסה שלך לקורס באקדמיה לתניא';
  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;color:#111;line-height:1.7">
      <h2 style="color:#079965">ברוכים הבאים לאקדמיה לתניא!</h2>
      <p>שלום ${name || ''},</p>
      <p>נפתח עבורך חשבון באתר${courseName ? ` לקורס <strong>${courseName}</strong>` : ''}.</p>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 12px"><strong>שם משתמש:</strong></td><td>${username}</td></tr>
        <tr><td style="padding:4px 12px"><strong>סיסמה:</strong></td><td>${password}</td></tr>
      </table>
      <p style="margin-top:16px">
        <a href="${loginUrl}" style="background:#079965;color:#fff;padding:10px 22px;
           border-radius:8px;text-decoration:none">כניסה לקורס</a>
      </p>
      <p style="color:#666;font-size:13px">מומלץ להחליף את הסיסמה לאחר הכניסה הראשונה.</p>
    </div>`;
  return sendMail({ to, subject, html, text: `שם משתמש: ${username} | סיסמה: ${password} | ${loginUrl}` });
}

module.exports = { sendMail, sendCourseCredentials, isEnabled: () => Boolean(transporter) };

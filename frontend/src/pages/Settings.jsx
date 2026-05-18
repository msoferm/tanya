import { useState, useEffect } from 'react';
import { integrationsAPI, authAPI, errMsg } from '../api';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../auth.jsx';

export default function Settings() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user.role === 'super_admin';

  const [status, setStatus] = useState(null);
  const [distribution, setDistribution] = useState({ enabled: true });
  const [syncDays, setSyncDays] = useState(30);
  const [busy, setBusy] = useState('');

  // שינוי סיסמה
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });

  useEffect(() => {
    if (!isAdmin) return;
    integrationsAPI.status().then((r) => setStatus(r.data)).catch(() => {});
    integrationsAPI.getDistribution().then((r) => setDistribution(r.data)).catch(() => {});
  }, [isAdmin]);

  const testWC = async () => {
    setBusy('test');
    try {
      const r = await integrationsAPI.wcTest();
      toast.success(`חיבור תקין · WooCommerce ${r.data.wcVersion || ''}`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally { setBusy(''); }
  };

  const syncWC = async () => {
    setBusy('sync');
    try {
      const r = await integrationsAPI.wcSync(syncDays);
      toast.success(`נבדקו ${r.data.ordersChecked} הזמנות · ${r.data.leadsMatched} לידים סומנו כרכשו`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally { setBusy(''); }
  };

  const toggleDistribution = async (enabled) => {
    try {
      const r = await integrationsAPI.setDistribution(enabled);
      setDistribution(r.data);
      toast.success('ההגדרה נשמרה');
    } catch (err) { toast.error(errMsg(err)); }
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('הועתק');
  };

  const changePassword = async () => {
    if (pw.next.length < 6) return toast.error('הסיסמה החדשה קצרה מדי');
    if (pw.next !== pw.confirm) return toast.error('הסיסמאות אינן תואמות');
    try {
      await authAPI.changePassword(pw.current, pw.next);
      toast.success('הסיסמה עודכנה');
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">{isAdmin ? 'הגדרות ואינטגרציות' : 'החשבון שלי'}</div>
      </div>

      {/* שינוי סיסמה - לכל המשתמשים */}
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="card-title">שינוי סיסמה</div>
        <div className="field">
          <label>סיסמה נוכחית</label>
          <input className="input" type="password" value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="field">
            <label>סיסמה חדשה</label>
            <input className="input" type="password" value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </div>
          <div className="field">
            <label>אימות סיסמה</label>
            <input className="input" type="password" value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={changePassword}>עדכון סיסמה</button>
      </div>

      {isAdmin && status && (
        <>
          {/* כתובות וובהוק */}
          <div className="card">
            <div className="card-title">כתובות Webhook</div>
            <p className="hint" style={{ marginBottom: 10 }}>
              הדביקו את הכתובות הבאות במערכות החיצוניות. הטוקן כלול בכתובת.
            </p>
            <label className="hint"><strong>טופס אלמנטור</strong> (פעולת Webhook):</label>
            <div className="row" style={{ marginBottom: 10 }}>
              <div className="code-box" style={{ flex: 1 }}>{status.webhooks.elementorUrl}</div>
              <button className="btn btn-sm" onClick={() => copy(status.webhooks.elementorUrl)}>העתק</button>
            </div>
            <label className="hint"><strong>WooCommerce</strong> (Webhook על "Order created"):</label>
            <div className="row">
              <div className="code-box" style={{ flex: 1 }}>{status.webhooks.woocommerceUrl}</div>
              <button className="btn btn-sm" onClick={() => copy(status.webhooks.woocommerceUrl)}>העתק</button>
            </div>
          </div>

          {/* WooCommerce */}
          <div className="card">
            <div className="card-title">חיבור WooCommerce</div>
            <p className="hint" style={{ marginBottom: 10 }}>
              סטטוס: {status.woocommerce.enabled
                ? <span className="success-msg">מוגדר ({status.woocommerce.url})</span>
                : <span className="error-msg">לא מוגדר — מלאו WC_URL ומפתחות API בקובץ .env של השרת</span>}
            </p>
            <div className="row">
              <button className="btn btn-dark" onClick={testWC}
                disabled={!status.woocommerce.enabled || busy === 'test'}>
                {busy === 'test' ? 'בודק...' : 'בדיקת חיבור'}
              </button>
              <span className="muted">סנכרון רכישות מ-</span>
              <input className="input" type="number" style={{ width: 70 }} value={syncDays}
                onChange={(e) => setSyncDays(e.target.value)} />
              <span className="muted">ימים אחרונים</span>
              <button className="btn btn-primary" onClick={syncWC}
                disabled={!status.woocommerce.enabled || busy === 'sync'}>
                {busy === 'sync' ? 'מסנכרן...' : 'סנכרן עכשיו'}
              </button>
            </div>
          </div>

          {/* שליחת מיילים */}
          <div className="card">
            <div className="card-title">שליחת מיילים</div>
            <p className="hint">
              סטטוס: {status.email.enabled
                ? <span className="success-msg">מוגדר</span>
                : <span className="error-msg">לא מוגדר — מלאו פרטי SMTP בקובץ .env</span>}
            </p>
          </div>

          {/* חלוקת לידים */}
          <div className="card">
            <div className="card-title">חלוקת לידים אוטומטית</div>
            <label className="checkbox-row">
              <input type="checkbox" checked={distribution.enabled !== false}
                onChange={(e) => toggleDistribution(e.target.checked)} />
              חלק לידים חדשים שווה בשווה בין הטלפנים הפעילים
            </label>
            <p className="hint" style={{ marginTop: 6 }}>
              כאשר מופעל — כל ליד חדש משויך אוטומטית לטלפן עם הכי מעט לידים שהתקבלו היום.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

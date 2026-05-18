import { useState, useEffect } from 'react';
import { leadsAPI, remindersAPI, integrationsAPI, errMsg } from '../api';
import { useToast } from './Toast.jsx';
import { useAuth } from '../auth.jsx';

const EMPTY = {
  name: '', phone: '', email: '', status_id: '', assigned_to: '',
  source: '', notes: '', course_name: '',
  attended_open_day: false, attended_webinar: false, webinar_minutes: '',
};

/** מודאל יצירה/עריכה של ליד - כולל תזכורות ויומן פעילות */
export default function LeadModal({ leadId, isNew, statuses, agents, onClose, onSaved }) {
  const toast = useToast();
  const { user } = useAuth();
  const canAssign = user.role !== 'telephonist';

  const [form, setForm] = useState(EMPTY);
  const [detail, setDetail] = useState(null); // נתוני ליד מלאים (היסטוריה, תזכורות)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [remindNote, setRemindNote] = useState('');

  useEffect(() => {
    if (isNew) {
      setForm({ ...EMPTY, status_id: statuses[0]?.id || '' });
      return;
    }
    leadsAPI.get(leadId).then((res) => {
      const l = res.data;
      setDetail(l);
      setForm({
        name: l.name || '', phone: l.phone || '', email: l.email || '',
        status_id: l.status_id || '', assigned_to: l.assigned_to || '',
        source: l.source || '', notes: l.notes || '', course_name: l.course_name || '',
        attended_open_day: l.attended_open_day, attended_webinar: l.attended_webinar,
        webinar_minutes: l.webinar_minutes || '',
      });
    }).catch((err) => setError(errMsg(err)));
  }, [leadId, isNew]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = { ...form };
      if (!canAssign) delete payload.assigned_to;
      if (payload.assigned_to === '') payload.assigned_to = null;
      if (isNew) {
        await leadsAPI.create(payload);
        toast.success('הליד נוצר');
      } else {
        await leadsAPI.update(leadId, payload);
        toast.success('הליד עודכן');
      }
      onSaved();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const addReminder = async () => {
    if (!remindAt) return;
    try {
      await remindersAPI.create({ lead_id: leadId, remind_at: remindAt, note: remindNote });
      toast.success('התזכורת נוספה');
      setRemindAt('');
      setRemindNote('');
      const res = await leadsAPI.get(leadId);
      setDetail(res.data);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const createAccount = async () => {
    if (!window.confirm('ליצור משתמש באתר ולשלוח אליו פרטי התחברות במייל?')) return;
    setBusy(true);
    try {
      const r = await integrationsAPI.createAccount(leadId, form.course_name);
      toast.success(
        `החשבון ${r.data.alreadyExisted ? 'כבר קיים' : 'נוצר'}` +
        (r.data.emailSent ? ' · מייל נשלח' : ' · המייל לא נשלח (בדקו הגדרות SMTP)')
      );
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const waLink = detail?.whatsapp ? `https://wa.me/${detail.whatsapp}` : null;

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{isNew ? 'ליד חדש' : `עריכת ליד: ${detail?.name || ''}`}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="form-row">
            <div className="field">
              <label>שם</label>
              <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="field">
              <label>טלפון</label>
              <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} dir="ltr" />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>מייל</label>
              <input className="input" value={form.email} onChange={(e) => set('email', e.target.value)} dir="ltr" />
            </div>
            <div className="field">
              <label>סטטוס</label>
              <select className="select" value={form.status_id} onChange={(e) => set('status_id', e.target.value)}>
                <option value="">— ללא —</option>
                {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            {canAssign && (
              <div className="field">
                <label>טלפן מטפל</label>
                <select className="select" value={form.assigned_to} onChange={(e) => set('assigned_to', e.target.value)}>
                  <option value="">— לא משויך —</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <label>מקור הליד</label>
              <input className="input" value={form.source} onChange={(e) => set('source', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>הערות חופשיות</label>
            <textarea className="textarea" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          <div className="row" style={{ gap: 20 }}>
            <label className="checkbox-row">
              <input type="checkbox" checked={form.attended_open_day}
                onChange={(e) => set('attended_open_day', e.target.checked)} />
              היה ביום פתוח
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={form.attended_webinar}
                onChange={(e) => set('attended_webinar', e.target.checked)} />
              היה בוובינר
            </label>
            {form.attended_webinar && (
              <div className="field" style={{ marginBottom: 0 }}>
                <input className="input" style={{ width: 130 }} type="number" min="0"
                  placeholder="דקות בוובינר" value={form.webinar_minutes}
                  onChange={(e) => set('webinar_minutes', e.target.value)} />
              </div>
            )}
          </div>

          {!isNew && user.role === 'super_admin' && (
            <>
              <div className="divider" />
              <div className="card-title">קורס וחשבון באתר</div>
              <div className="row" style={{ alignItems: 'end' }}>
                <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <label>שם הקורס</label>
                  <input className="input" value={form.course_name}
                    onChange={(e) => set('course_name', e.target.value)} />
                </div>
                <button className="btn btn-dark" onClick={createAccount} disabled={busy}>
                  🎓 צור חשבון ושלח פרטים
                </button>
              </div>
              {detail?.is_customer && (
                <div className="hint" style={{ marginTop: 6 }}>
                  ✅ ליד זה סומן כרכש{detail.purchased_at
                    ? ` בתאריך ${new Date(detail.purchased_at).toLocaleDateString('he-IL')}` : ''}
                  {detail.wc_order_id ? ` · הזמנה #${detail.wc_order_id}` : ''}
                </div>
              )}
            </>
          )}

          {detail && (detail.utm_source || detail.utm_campaign) && (
            <>
              <div className="divider" />
              <div className="hint">
                <strong>UTM שנקלט:</strong>{' '}
                {['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
                  .filter((k) => detail[k]).map((k) => `${k}=${detail[k]}`).join(' · ') || '—'}
              </div>
            </>
          )}

          {!isNew && detail && (
            <>
              <div className="divider" />
              <div className="card-title">קביעת תזכורת</div>
              <div className="row">
                <input className="input" type="datetime-local" style={{ width: 210 }}
                  value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
                <input className="input" placeholder="הערה לתזכורת" style={{ flex: 1 }}
                  value={remindNote} onChange={(e) => setRemindNote(e.target.value)} />
                <button className="btn btn-dark" onClick={addReminder}>הוסף</button>
              </div>
              {detail.reminders?.length > 0 && (
                <ul style={{ listStyle: 'none', marginTop: 10 }}>
                  {detail.reminders.map((r) => (
                    <li key={r.id} className="hint">
                      ⏰ {new Date(r.remind_at).toLocaleString('he-IL')} {r.note && `– ${r.note}`}
                      {r.is_done && ' ✓'}
                    </li>
                  ))}
                </ul>
              )}

              {detail.history?.length > 0 && (
                <>
                  <div className="divider" />
                  <div className="card-title">יומן פעילות</div>
                  <ul style={{ listStyle: 'none', maxHeight: 140, overflowY: 'auto' }}>
                    {detail.history.map((h) => (
                      <li key={h.id} className="hint">
                        {new Date(h.created_at).toLocaleString('he-IL')} – {h.details}
                        {h.user_name && ` (${h.user_name})`}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'שומר...' : 'שמירה'}
          </button>
          <button className="btn" onClick={onClose}>ביטול</button>
          {waLink && (
            <a className="btn btn-wa" href={waLink} target="_blank" rel="noreferrer"
              style={{ marginInlineStart: 'auto' }}>
              💬 וואטסאפ
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

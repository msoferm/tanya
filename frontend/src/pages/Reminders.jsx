import { useState, useEffect, useCallback } from 'react';
import { remindersAPI, errMsg } from '../api';
import { useToast } from '../components/Toast.jsx';
import { toWa } from '../util.js';

export default function Reminders() {
  const toast = useToast();
  const [scope, setScope] = useState('today');
  const [showDone, setShowDone] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    remindersAPI.list({ scope, done: showDone ? undefined : 'false' })
      .then((r) => setItems(r.data))
      .catch((err) => toast.error(errMsg(err)))
      .finally(() => setLoading(false));
  }, [scope, showDone]);

  useEffect(() => { load(); }, [load]);

  const markDone = async (r) => {
    try {
      await remindersAPI.update(r.id, { is_done: !r.is_done });
      load();
    } catch (err) { toast.error(errMsg(err)); }
  };

  const remove = async (id) => {
    if (!window.confirm('למחוק את התזכורת?')) return;
    try {
      await remindersAPI.remove(id);
      toast.success('נמחק');
      load();
    } catch (err) { toast.error(errMsg(err)); }
  };

  // קיבוץ לפי תאריך
  const groups = {};
  for (const r of items) {
    const day = new Date(r.remind_at).toLocaleDateString('he-IL', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    (groups[day] = groups[day] || []).push(r);
  }

  const now = new Date();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">תזכורות</div>
          <div className="page-subtitle">לידים שצריך לחזור אליהם</div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="row">
          {[['today', 'היום'], ['upcoming', 'הקרובים'], ['all', 'הכל']].map(([k, label]) => (
            <button key={k} className={`btn btn-sm ${scope === k ? 'btn-primary' : ''}`}
              onClick={() => setScope(k)}>{label}</button>
          ))}
        </div>
        <label className="checkbox-row" style={{ marginInlineStart: 'auto' }}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          הצג גם שבוצעו
        </label>
      </div>

      {loading ? (
        <div className="loading">טוען...</div>
      ) : items.length === 0 ? (
        <div className="card table-empty">אין תזכורות 🎉</div>
      ) : (
        Object.entries(groups).map(([day, list]) => (
          <div className="card" key={day}>
            <div className="card-title">{day}</div>
            {list.map((r) => {
              const overdue = !r.is_done && new Date(r.remind_at) < now;
              return (
                <div key={r.id}
                  className={`reminder-item ${r.is_done ? 'done' : ''} ${overdue ? 'overdue' : ''}`}>
                  <div>
                    <span className="reminder-time">
                      {new Date(r.remind_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {' · '}
                    <strong>{r.lead_name || 'ליד'}</strong>
                    {r.lead_phone && <span className="muted" dir="ltr"> · {r.lead_phone}</span>}
                    {r.note && <div className="hint">{r.note}</div>}
                  </div>
                  <div className="row">
                    {r.lead_phone && toWa(r.lead_phone) && (
                      <a className="btn btn-sm btn-wa" target="_blank" rel="noreferrer"
                        href={`https://wa.me/${toWa(r.lead_phone)}`}>💬</a>
                    )}
                    <button className="btn btn-sm" onClick={() => markDone(r)}>
                      {r.is_done ? 'בטל' : '✓ בוצע'}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(r.id)}>מחק</button>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { leadsAPI, statusesAPI, usersAPI, errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import LeadModal from '../components/LeadModal.jsx';

const BLANK_FILTERS = {
  q: '', status_id: '', assigned_to: '', source: '', is_customer: '',
  attended_webinar: '', attended_open_day: '', date_from: '', date_to: '',
  sort: 'created_desc',
};

export default function Leads() {
  const { user } = useAuth();
  const toast = useToast();
  const canAssign = user.role !== 'telephonist';

  const [filters, setFilters] = useState(BLANK_FILTERS);
  const [data, setData] = useState({ leads: [], total: 0, page: 1, limit: 50 });
  const [statuses, setStatuses] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [modal, setModal] = useState(null); // {leadId, isNew}
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkAgent, setBulkAgent] = useState('');

  useEffect(() => {
    statusesAPI.list().then((r) => setStatuses(r.data));
    usersAPI.list({ role: 'telephonist' }).then((r) => setAgents(r.data)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    leadsAPI.list({ ...filters, page })
      .then((r) => setData(r.data))
      .catch((err) => toast.error(errMsg(err)))
      .finally(() => setLoading(false));
  }, [filters, page]);

  // טעינה מחדש בכל שינוי סינון (עם השהיה קצרה לחיפוש)
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const setFilter = (k, v) => { setPage(1); setFilters((f) => ({ ...f, [k]: v })); };
  const resetFilters = () => { setPage(1); setFilters(BLANK_FILTERS); };

  const toggleSelect = (id) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    setSelected((s) =>
      s.size === data.leads.length ? new Set() : new Set(data.leads.map((l) => l.id))
    );
  };

  const applyBulk = async () => {
    if (!selected.size || (!bulkStatus && !bulkAgent)) return;
    try {
      const payload = { ids: [...selected] };
      if (bulkStatus) payload.status_id = bulkStatus;
      if (bulkAgent && canAssign) payload.assigned_to = bulkAgent === 'none' ? null : bulkAgent;
      const r = await leadsAPI.bulk(payload);
      toast.success(`${r.data.updated} לידים עודכנו`);
      setSelected(new Set());
      setBulkStatus(''); setBulkAgent('');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const removeLead = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('למחוק את הליד?')) return;
    try {
      await leadsAPI.remove(id);
      toast.success('הליד נמחק');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const totalPages = Math.ceil(data.total / data.limit) || 1;
  const fmt = (d) => d ? new Date(d).toLocaleDateString('he-IL') : '—';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">לידים</div>
          <div className="page-subtitle">{data.total} לידים במערכת</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ isNew: true })}>
          + ליד חדש
        </button>
      </div>

      {/* סרגל חיפוש וסינון */}
      <div className="filter-bar">
        <div className="field search-box">
          <label>חיפוש</label>
          <input className="input" placeholder="שם, מייל או טלפון (גם חלקי)..."
            value={filters.q} onChange={(e) => setFilter('q', e.target.value)} />
        </div>
        <div className="field">
          <label>סטטוס</label>
          <select className="select" value={filters.status_id}
            onChange={(e) => setFilter('status_id', e.target.value)}>
            <option value="">הכל</option>
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {canAssign && (
          <div className="field">
            <label>טלפן</label>
            <select className="select" value={filters.assigned_to}
              onChange={(e) => setFilter('assigned_to', e.target.value)}>
              <option value="">הכל</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label>רכשו</label>
          <select className="select" value={filters.is_customer}
            onChange={(e) => setFilter('is_customer', e.target.value)}>
            <option value="">הכל</option>
            <option value="true">רכשו בלבד</option>
            <option value="false">לא רכשו</option>
          </select>
        </div>
        <div className="field">
          <label>מתאריך</label>
          <input className="input" type="date" value={filters.date_from}
            onChange={(e) => setFilter('date_from', e.target.value)} />
        </div>
        <div className="field">
          <label>עד תאריך</label>
          <input className="input" type="date" value={filters.date_to}
            onChange={(e) => setFilter('date_to', e.target.value)} />
        </div>
        <div className="field">
          <label>מיון</label>
          <select className="select" value={filters.sort}
            onChange={(e) => setFilter('sort', e.target.value)}>
            <option value="created_desc">נרשם – חדש לישן</option>
            <option value="created_asc">נרשם – ישן לחדש</option>
            <option value="updated_desc">עודכן לאחרונה</option>
            <option value="name_asc">לפי שם</option>
          </select>
        </div>
        <div className="row">
          <label className="checkbox-row">
            <input type="checkbox" checked={filters.attended_webinar === 'true'}
              onChange={(e) => setFilter('attended_webinar', e.target.checked ? 'true' : '')} />
            וובינר
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={filters.attended_open_day === 'true'}
              onChange={(e) => setFilter('attended_open_day', e.target.checked ? 'true' : '')} />
            יום פתוח
          </label>
        </div>
        <button className="btn btn-ghost" onClick={resetFilters}>נקה</button>
      </div>

      {/* סרגל עריכה מרובה */}
      {selected.size > 0 && (
        <div className="filter-bar" style={{ background: 'var(--green-light)' }}>
          <strong>{selected.size} נבחרו</strong>
          <select className="select" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
            <option value="">— שינוי סטטוס —</option>
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {canAssign && (
            <select className="select" value={bulkAgent} onChange={(e) => setBulkAgent(e.target.value)}>
              <option value="">— שיוך לטלפן —</option>
              <option value="none">ביטול שיוך</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <button className="btn btn-primary" onClick={applyBulk}>החל</button>
          <button className="btn btn-ghost" onClick={() => setSelected(new Set())}>ביטול בחירה</button>
        </div>
      )}

      {/* טבלה */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox"
                checked={data.leads.length > 0 && selected.size === data.leads.length}
                onChange={toggleAll} /></th>
              <th>שם</th>
              <th>טלפון</th>
              <th>מייל</th>
              <th>סטטוס</th>
              <th>מקור</th>
              {canAssign && <th>טלפן</th>}
              <th>נרשם</th>
              <th>עודכן</th>
              <th>רכש</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="11" className="table-empty">טוען...</td></tr>
            ) : data.leads.length === 0 ? (
              <tr><td colSpan="11" className="table-empty">לא נמצאו לידים</td></tr>
            ) : data.leads.map((l) => (
              <tr key={l.id} className={selected.has(l.id) ? 'selected' : ''}
                onClick={() => setModal({ leadId: l.id })} style={{ cursor: 'pointer' }}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(l.id)}
                    onChange={() => toggleSelect(l.id)} />
                </td>
                <td><strong>{l.name || '—'}</strong></td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="row" style={{ gap: 6 }}>
                    <span dir="ltr">{l.phone || '—'}</span>
                    {l.whatsapp && (
                      <a className="btn btn-sm btn-wa" href={`https://wa.me/${l.whatsapp}`}
                        target="_blank" rel="noreferrer" title="שליחת וואטסאפ">💬</a>
                    )}
                  </div>
                </td>
                <td dir="ltr">{l.email || '—'}</td>
                <td>
                  {l.status_name
                    ? <span className="badge" style={{ background: l.status_color }}>{l.status_name}</span>
                    : <span className="badge badge-soft">ללא</span>}
                </td>
                <td>{l.utm_source || l.source || '—'}</td>
                {canAssign && <td>{l.assigned_to_name || <span className="muted">לא משויך</span>}</td>}
                <td>{fmt(l.created_at)}</td>
                <td>{fmt(l.updated_at)}</td>
                <td>{l.is_customer ? <span className="badge tag-customer">רכש</span> : ''}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {canAssign && (
                    <button className="btn btn-sm btn-danger"
                      onClick={(e) => removeLead(l.id, e)}>מחק</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-sm" disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}>הקודם</button>
          <span>עמוד {page} מתוך {totalPages}</span>
          <button className="btn btn-sm" disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}>הבא</button>
        </div>
      )}

      {modal && (
        <LeadModal
          leadId={modal.leadId}
          isNew={!!modal.isNew}
          statuses={statuses}
          agents={agents}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

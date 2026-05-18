import { useState, useEffect } from 'react';
import { statusesAPI, errMsg } from '../api';
import { useToast } from '../components/Toast.jsx';

const EMPTY = { name: '', color: '#079965', sort_order: 0, is_won: false };

export default function Statuses() {
  const toast = useToast();
  const [list, setList] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const load = () => statusesAPI.list().then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return toast.error('נדרש שם סטטוס');
    try {
      if (editId) {
        await statusesAPI.update(editId, form);
        toast.success('הסטטוס עודכן');
      } else {
        await statusesAPI.create(form);
        toast.success('הסטטוס נוצר');
      }
      setForm(EMPTY); setEditId(null);
      load();
    } catch (err) { toast.error(errMsg(err)); }
  };

  const edit = (s) => {
    setEditId(s.id);
    setForm({ name: s.name, color: s.color, sort_order: s.sort_order, is_won: s.is_won });
  };

  const remove = async (s) => {
    if (!window.confirm(`למחוק את הסטטוס "${s.name}"? לידים עם סטטוס זה יישארו ללא סטטוס.`)) return;
    try {
      await statusesAPI.remove(s.id);
      toast.success('נמחק');
      load();
    } catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">סטטוסים</div>
          <div className="page-subtitle">ניהול חופשי של סטטוסי הלקוח</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">{editId ? 'עריכת סטטוס' : 'סטטוס חדש'}</div>
        <div className="row" style={{ alignItems: 'end' }}>
          <div className="field" style={{ marginBottom: 0, flex: 1 }}>
            <label>שם</label>
            <input className="input" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>צבע</label>
            <input type="color" className="input" style={{ width: 60, padding: 3 }}
              value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>סדר</label>
            <input type="number" className="input" style={{ width: 80 }} value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.is_won}
              onChange={(e) => setForm({ ...form, is_won: e.target.checked })} />
            סטטוס "סגר/רכש"
          </label>
          <button className="btn btn-primary" onClick={save}>{editId ? 'עדכון' : 'הוספה'}</button>
          {editId && <button className="btn" onClick={() => { setForm(EMPTY); setEditId(null); }}>ביטול</button>}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>סטטוס</th><th>לידים</th><th>סדר</th><th>סגר/רכש</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td><span className="badge" style={{ background: s.color }}>{s.name}</span></td>
                <td>{s.leads_count}</td>
                <td>{s.sort_order}</td>
                <td>{s.is_won ? '✓' : ''}</td>
                <td>
                  <div className="row">
                    <button className="btn btn-sm" onClick={() => edit(s)}>עריכה</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(s)}>מחק</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

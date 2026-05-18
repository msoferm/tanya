import { useState, useEffect } from 'react';
import { usersAPI, errMsg } from '../api';
import { useToast } from '../components/Toast.jsx';
import { ROLE_LABELS } from '../auth.jsx';

const EMPTY = { name: '', email: '', password: '', role: 'telephonist', phone: '' };

export default function Users() {
  const toast = useToast();
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(null); // {form, editId}

  const load = () => usersAPI.list().then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => setModal({ editId: null, form: { ...EMPTY } });
  const openEdit = (u) => setModal({
    editId: u.id,
    form: { name: u.name, email: u.email, password: '', role: u.role, phone: u.phone || '', is_active: u.is_active },
  });

  const save = async () => {
    const { editId, form } = modal;
    try {
      if (editId) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await usersAPI.update(editId, payload);
        toast.success('המשתמש עודכן');
      } else {
        await usersAPI.create(form);
        toast.success('המשתמש נוצר');
      }
      setModal(null);
      load();
    } catch (err) { toast.error(errMsg(err)); }
  };

  const remove = async (u) => {
    if (!window.confirm(`למחוק את ${u.name}?`)) return;
    try {
      await usersAPI.remove(u.id);
      toast.success('נמחק');
      load();
    } catch (err) { toast.error(errMsg(err)); }
  };

  const setF = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">משתמשים</div>
          <div className="page-subtitle">טלפנים, מנהלים ומשתמשי על</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ משתמש חדש</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>שם</th><th>מייל</th><th>תפקיד</th><th>טלפון</th><th>לידים</th><th>פעיל</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td data-label="שם"><strong>{u.name}</strong></td>
                <td data-label="מייל" dir="ltr">{u.email}</td>
                <td data-label="תפקיד"><span className="role-pill">{ROLE_LABELS[u.role]}</span></td>
                <td data-label="טלפון" dir="ltr">{u.phone || '—'}</td>
                <td data-label="לידים">{u.leads_count}</td>
                <td data-label="פעיל">{u.is_active ? '✓' : '—'}</td>
                <td data-label="פעולות">
                  <div className="row">
                    <button className="btn btn-sm" onClick={() => openEdit(u)}>עריכה</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(u)}>מחק</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>{modal.editId ? 'עריכת משתמש' : 'משתמש חדש'}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>שם מלא</label>
                <input className="input" value={modal.form.name}
                  onChange={(e) => setF('name', e.target.value)} />
              </div>
              <div className="field">
                <label>כתובת מייל</label>
                <input className="input" dir="ltr" value={modal.form.email}
                  onChange={(e) => setF('email', e.target.value)} />
              </div>
              <div className="form-row">
                <div className="field">
                  <label>תפקיד</label>
                  <select className="select" value={modal.form.role}
                    onChange={(e) => setF('role', e.target.value)}>
                    <option value="telephonist">טלפן</option>
                    <option value="manager">מנהל</option>
                    <option value="super_admin">משתמש על</option>
                  </select>
                </div>
                <div className="field">
                  <label>טלפון</label>
                  <input className="input" dir="ltr" value={modal.form.phone}
                    onChange={(e) => setF('phone', e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>{modal.editId ? 'סיסמה חדשה (אופציונלי)' : 'סיסמה'}</label>
                <input className="input" type="text" value={modal.form.password}
                  onChange={(e) => setF('password', e.target.value)}
                  placeholder={modal.editId ? 'להשארה ריקה ללא שינוי' : ''} />
              </div>
              {modal.editId && (
                <label className="checkbox-row">
                  <input type="checkbox" checked={modal.form.is_active}
                    onChange={(e) => setF('is_active', e.target.checked)} />
                  משתמש פעיל
                </label>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={save}>שמירה</button>
              <button className="btn" onClick={() => setModal(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

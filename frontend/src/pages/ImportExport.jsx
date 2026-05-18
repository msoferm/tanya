import { useState, useEffect } from 'react';
import { importExportAPI, statusesAPI, downloadBlob, errMsg } from '../api';
import { useToast } from '../components/Toast.jsx';

export default function ImportExport() {
  const toast = useToast();
  const [fields, setFields] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [logs, setLogs] = useState([]);

  // ----- ייבוא -----
  const [file, setFile] = useState(null);
  const [columnMap, setColumnMap] = useState({});
  const [autoAssign, setAutoAssign] = useState(true);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);

  // ----- ייצוא -----
  const [exportFields, setExportFields] = useState([]);
  const [exportFilters, setExportFilters] = useState({ status_id: '', date_from: '', date_to: '' });

  useEffect(() => {
    importExportAPI.fields().then((r) => {
      setFields(r.data);
      setExportFields(r.data.map((f) => f.key)); // ברירת מחדל: ייצוא כל השדות
    });
    statusesAPI.list().then((r) => setStatuses(r.data));
    loadLogs();
  }, []);

  const loadLogs = () => importExportAPI.logs().then((r) => setLogs(r.data)).catch(() => {});

  const downloadTemplate = async () => {
    const r = await importExportAPI.templateFile();
    downloadBlob(r.data, 'leads-template.xlsx');
  };

  const buildForm = (dryRun) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('dryRun', String(dryRun));
    fd.append('autoAssign', String(autoAssign));
    if (Object.keys(columnMap).length) fd.append('columnMap', JSON.stringify(columnMap));
    return fd;
  };

  const preview = async () => {
    if (!file) return toast.error('בחרו קובץ');
    setBusy(true);
    try {
      const r = await importExportAPI.importFile(buildForm(true));
      setReport(r.data);
      // אתחול מיפוי עמודות לפי הכותרות שזוהו (ריק = זיהוי אוטומטי)
      if (!Object.keys(columnMap).length && r.data.headers) {
        const init = {};
        r.data.headers.forEach((h) => { init[h] = ''; });
        setColumnMap(init);
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await importExportAPI.importFile(buildForm(false));
      setReport(r.data);
      toast.success(`יובאו ${r.data.imported} לידים`);
      loadLogs();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const resetImport = () => { setFile(null); setReport(null); setColumnMap({}); };

  const doExport = async () => {
    try {
      const params = { fields: exportFields.join(',') };
      Object.entries(exportFilters).forEach(([k, v]) => { if (v) params[k] = v; });
      const r = await importExportAPI.exportFile(params);
      downloadBlob(r.data, `leads-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('הקובץ הורד');
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const toggleExportField = (key) => {
    setExportFields((f) => f.includes(key) ? f.filter((x) => x !== key) : [...f, key]);
  };

  const errors = report?.errors || [];
  const realErrors = errors.filter((e) => !e.warning);
  const warnings = errors.filter((e) => e.warning);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">ייבוא / ייצוא לידים</div>
      </div>

      {/* ===== ייבוא ===== */}
      <div className="card">
        <div className="card-title">ייבוא מאקסל</div>
        <p className="hint" style={{ marginBottom: 12 }}>
          הייבוא לא דורס לידים קיימים. כפילויות (לפי טלפון או מייל) מדולגות ומדווחות.
        </p>

        <div className="row" style={{ marginBottom: 12 }}>
          <input type="file" accept=".xlsx,.xls,.csv"
            onChange={(e) => { setFile(e.target.files[0]); setReport(null); setColumnMap({}); }} />
          <button className="btn btn-sm" onClick={downloadTemplate}>הורדת תבנית</button>
          <label className="checkbox-row" style={{ marginInlineStart: 'auto' }}>
            <input type="checkbox" checked={autoAssign}
              onChange={(e) => setAutoAssign(e.target.checked)} />
            חלוקה אוטומטית בין הטלפנים
          </label>
        </div>

        {file && (
          <div className="row" style={{ marginBottom: 12 }}>
            <button className="btn btn-dark" onClick={preview} disabled={busy}>
              {busy ? 'מנתח...' : '🔍 תצוגה מקדימה'}
            </button>
            {report?.dryRun && (
              <button className="btn btn-primary" onClick={runImport} disabled={busy}>
                ✓ בצע ייבוא ({report.total - report.skipped} לידים)
              </button>
            )}
            <button className="btn btn-ghost" onClick={resetImport}>נקה</button>
          </div>
        )}

        {/* מיפוי עמודות */}
        {report?.headers && (
          <div style={{ marginBottom: 14 }}>
            <div className="card-title" style={{ fontSize: 13 }}>מיפוי עמודות (ריק = זיהוי אוטומטי)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 8 }}>
              {report.headers.map((h) => (
                <div key={h} className="row" style={{ gap: 6 }}>
                  <span style={{ minWidth: 90, fontSize: 12 }} className="muted">{h}</span>
                  <select className="select" value={columnMap[h] || ''}
                    onChange={(e) => setColumnMap({ ...columnMap, [h]: e.target.value })}>
                    <option value="">אוטומטי</option>
                    <option value="__ignore__">להתעלם</option>
                    {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={preview} disabled={busy}>
              עדכן תצוגה מקדימה
            </button>
          </div>
        )}

        {/* דוח ייבוא */}
        {report && (
          <div>
            <div className="row" style={{ gap: 16, marginBottom: 10 }}>
              <span>סה"כ שורות: <strong>{report.total}</strong></span>
              <span className="success-msg">
                {report.dryRun ? 'ייובאו' : 'יובאו'}: {report.imported || (report.total - report.skipped)}
              </span>
              <span className="error-msg">דולגו: {report.skipped}</span>
            </div>

            {realErrors.length > 0 && (
              <div className="table-wrap" style={{ marginBottom: 10 }}>
                <table>
                  <thead><tr><th>שורה</th><th>בעיה</th><th>ערך</th></tr></thead>
                  <tbody>
                    {realErrors.map((e, i) => (
                      <tr key={i}>
                        <td>{e.row || '—'}</td>
                        <td>{e.reason}</td>
                        <td dir="ltr">{e.value || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="hint">
                ⚠️ {warnings.length} אזהרות (למשל סטטוס לא מזוהה - יוגדר ברירת מחדל).
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== ייצוא ===== */}
      <div className="card">
        <div className="card-title">ייצוא לאקסל</div>
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>סטטוס</label>
            <select className="select" value={exportFilters.status_id}
              onChange={(e) => setExportFilters({ ...exportFilters, status_id: e.target.value })}>
              <option value="">הכל</option>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>מתאריך</label>
            <input className="input" type="date" value={exportFilters.date_from}
              onChange={(e) => setExportFilters({ ...exportFilters, date_from: e.target.value })} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>עד תאריך</label>
            <input className="input" type="date" value={exportFilters.date_to}
              onChange={(e) => setExportFilters({ ...exportFilters, date_to: e.target.value })} />
          </div>
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 600 }}>שדות לייצוא:</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 4, margin: '8px 0 14px' }}>
          {fields.map((f) => (
            <label key={f.key} className="checkbox-row">
              <input type="checkbox" checked={exportFields.includes(f.key)}
                onChange={() => toggleExportField(f.key)} />
              {f.label}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" onClick={doExport}
          disabled={!exportFields.length}>⬇ ייצוא לאקסל</button>
      </div>

      {/* ===== יומן ייבוא ===== */}
      {logs.length > 0 && (
        <div className="card">
          <div className="card-title">יומן ייבוא</div>
          <table>
            <thead>
              <tr><th>תאריך</th><th>קובץ</th><th>משתמש</th><th>שורות</th><th>יובאו</th><th>דולגו</th></tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString('he-IL')}</td>
                  <td>{l.filename}</td>
                  <td>{l.user_name || '—'}</td>
                  <td>{l.total_rows}</td>
                  <td>{l.imported}</td>
                  <td>{l.skipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

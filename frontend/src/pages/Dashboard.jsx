import { useState, useEffect } from 'react';
import { dashboardAPI, errMsg } from '../api';
import { useToast } from '../components/Toast.jsx';

export default function Dashboard() {
  const toast = useToast();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    dashboardAPI.stats()
      .then((r) => setStats(r.data))
      .catch((err) => toast.error(errMsg(err)));
  }, []);

  if (!stats) return <div className="loading">טוען נתונים...</div>;

  const { totals, byStatus, bySource, byAgent, remindersToday } = stats;
  const maxStatus = Math.max(1, ...byStatus.map((s) => Number(s.count)));
  const maxSource = Math.max(1, ...bySource.map((s) => Number(s.count)));

  const cards = [
    { label: 'סך הכל לידים', value: totals.total },
    { label: 'נכנסו היום', value: totals.today },
    { label: 'נכנסו השבוע', value: totals.this_week },
    { label: 'רכשו', value: totals.customers },
    { label: 'אחוז המרה', value: totals.conversion + '%' },
    { label: 'תזכורות להיום', value: remindersToday },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">דשבורד</div>
      </div>

      <div className="stat-grid">
        {cards.map((c) => (
          <div className="stat-card" key={c.label}>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-title">לידים לפי סטטוס</div>
          {byStatus.map((s) => (
            <div key={s.name} style={{ marginBottom: 10 }}>
              <div className="spread" style={{ marginBottom: 3 }}>
                <span>{s.name}</span><strong>{s.count}</strong>
              </div>
              <div style={{ background: 'var(--gray-100)', borderRadius: 6, height: 8 }}>
                <div style={{
                  width: `${(s.count / maxStatus) * 100}%`, height: '100%',
                  background: s.color || 'var(--green)', borderRadius: 6,
                }} />
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">מקורות תנועה מובילים</div>
          {bySource.map((s) => (
            <div key={s.source} style={{ marginBottom: 10 }}>
              <div className="spread" style={{ marginBottom: 3 }}>
                <span>{s.source}</span><strong>{s.count}</strong>
              </div>
              <div style={{ background: 'var(--gray-100)', borderRadius: 6, height: 8 }}>
                <div style={{
                  width: `${(s.count / maxSource) * 100}%`, height: '100%',
                  background: 'var(--green)', borderRadius: 6,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {byAgent.length > 0 && (
        <div className="card">
          <div className="card-title">ביצועי טלפנים</div>
          <table>
            <thead>
              <tr><th>טלפן</th><th>סך לידים</th><th>נכנסו היום</th><th>רכשו</th></tr>
            </thead>
            <tbody>
              {byAgent.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.name}</strong></td>
                  <td>{a.total}</td>
                  <td>{a.today}</td>
                  <td>{a.customers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

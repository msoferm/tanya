import { NavLink } from 'react-router-dom';
import { useAuth, ROLE_LABELS } from '../auth.jsx';

// כל פריטי התפריט עם התפקידים שמורשים לראות אותם
const NAV = [
  { to: '/dashboard', icon: '📊', label: 'דשבורד', roles: ['manager', 'super_admin'] },
  { to: '/leads', icon: '👥', label: 'לידים', roles: ['telephonist', 'manager', 'super_admin'] },
  { to: '/reminders', icon: '⏰', label: 'תזכורות', roles: ['telephonist', 'manager', 'super_admin'] },
  { to: '/statuses', icon: '🏷️', label: 'סטטוסים', roles: ['manager', 'super_admin'] },
  { to: '/users', icon: '🧑‍💼', label: 'משתמשים', roles: ['super_admin'] },
  { to: '/import-export', icon: '📁', label: 'ייבוא / ייצוא', roles: ['super_admin'] },
  { to: '/settings', icon: '⚙️', label: 'הגדרות ואינטגרציות', roles: ['super_admin'] },
];

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <span className="dot" />
        <span>אקדמיה לתניא</span>
        <button className="sidebar-x" aria-label="סגירה" onClick={onClose}>×</button>
      </div>
      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        מערכת ניהול לידים<br />
        {ROLE_LABELS[user.role]}
      </div>
    </aside>
  );
}

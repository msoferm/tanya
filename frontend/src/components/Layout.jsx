import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Sidebar from './Sidebar.jsx';
import { ToastProvider } from './Toast.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = (user.name || '?').trim().charAt(0);

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar />
        <div className="main-area">
          <header className="topbar">
            <div className="muted">שלום, {user.name}</div>
            <div className="topbar-user">
              <button className="btn btn-sm btn-ghost" onClick={() => navigate('/account')}>
                ⚙️ החשבון שלי
              </button>
              <button className="btn btn-sm" onClick={logout}>יציאה</button>
              <div className="avatar">{initials}</div>
            </div>
          </header>
          <Outlet />
        </div>
      </div>
    </ToastProvider>
  );
}

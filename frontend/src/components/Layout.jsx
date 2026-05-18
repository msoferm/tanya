import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Sidebar from './Sidebar.jsx';
import { ToastProvider } from './Toast.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const initials = (user.name || '?').trim().charAt(0);

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        {navOpen && <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} />}

        <div className="main-area">
          <header className="topbar">
            <div className="topbar-left">
              <button className="hamburger" aria-label="תפריט"
                onClick={() => setNavOpen(true)}>☰</button>
              <div className="muted greeting">שלום, {user.name}</div>
            </div>
            <div className="topbar-user">
              <button className="btn btn-sm btn-ghost" onClick={() => navigate('/account')}>
                ⚙️<span className="btn-account-text"> החשבון שלי</span>
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

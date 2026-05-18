import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Leads from './pages/Leads.jsx';
import Reminders from './pages/Reminders.jsx';
import Statuses from './pages/Statuses.jsx';
import Users from './pages/Users.jsx';
import ImportExport from './pages/ImportExport.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">טוען...</div>;
  }

  // עמוד הבית לפי תפקיד
  const home = user
    ? (user.role === 'telephonist' ? '/leads' : '/dashboard')
    : '/login';

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home} /> : <Login />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Navigate to={home} />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/reminders" element={<Reminders />} />
        <Route path="/account" element={<Settings />} />

        <Route element={<ProtectedRoute roles={['manager', 'super_admin']} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/statuses" element={<Statuses />} />
        </Route>

        <Route element={<ProtectedRoute roles={['super_admin']} />}>
          <Route path="/users" element={<Users />} />
          <Route path="/import-export" element={<ImportExport />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={home} />} />
    </Routes>
  );
}

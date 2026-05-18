import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

/**
 * שומר נתיב.
 * - children: מרונדר רק למשתמש מחובר.
 * - roles: אם הוגדר, מגביל את הגישה לתפקידים מסוימים (במצב layout route).
 */
export default function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user.role)) {
    const home = user.role === 'telephonist' ? '/leads' : '/dashboard';
    return <Navigate to={home} replace />;
  }

  return children || <Outlet />;
}

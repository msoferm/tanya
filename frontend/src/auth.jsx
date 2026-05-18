import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authAPI } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // טעינת המשתמש מהטוקן השמור
  useEffect(() => {
    const token = localStorage.getItem('tanya_token');
    if (!token) { setLoading(false); return; }
    authAPI.me()
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem('tanya_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login(email, password);
    localStorage.setItem('tanya_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('tanya_token');
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// תוויות התפקידים בעברית
export const ROLE_LABELS = {
  telephonist: 'טלפן',
  manager: 'מנהל',
  super_admin: 'משתמש על',
};

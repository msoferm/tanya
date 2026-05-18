import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { errMsg } from '../api';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(errMsg(err, 'ההתחברות נכשלה'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">
          <div className="mark">ת</div>
          <h1>אקדמיה לתניא</h1>
          <p>מערכת ניהול לידים</p>
        </div>

        {error && <div className="error-msg" style={{ marginBottom: 14 }}>{error}</div>}

        <div className="field">
          <label>כתובת מייל</label>
          <input
            className="input" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@tanya.local" required autoFocus
          />
        </div>
        <div className="field">
          <label>סיסמה</label>
          <input
            className="input" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} required
          />
        </div>

        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
          disabled={busy}>
          {busy ? 'מתחבר...' : 'כניסה למערכת'}
        </button>
      </form>
    </div>
  );
}

import { useState } from 'react';
import './PasswordGate.css';

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD;

export function isAuthenticated() {
  if (!APP_PASSWORD) return true; // no password set = open access
  return sessionStorage.getItem('council_auth') === 'true';
}

export function PasswordGate({ onSuccess }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (value === APP_PASSWORD) {
      sessionStorage.setItem('council_auth', 'true');
      onSuccess();
    } else {
      setError(true);
      setValue('');
    }
  }

  return (
    <div className="gate">
      <div className="gate-content">
        <h1 className="gate-title">The Council</h1>
        <p className="gate-subtitle">Authorized access only</p>
        <form className="gate-form" onSubmit={handleSubmit}>
          <input
            type="password"
            className={`gate-input${error ? ' gate-input--error' : ''}`}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false); }}
            placeholder="Enter password"
            autoFocus
          />
          <button type="submit" className="gate-btn">Enter</button>
        </form>
        {error && <p className="gate-error">Incorrect password</p>}
      </div>
    </div>
  );
}

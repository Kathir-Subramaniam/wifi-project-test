import React, { useState } from 'react';
import './AuthPage.css';

export default function AuthPage({ onAuthed }) {
  // modes: login | signup
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const isEmailValid = (val) => /\S+@\S+\.\S+/.test(val);
  const isPasswordStrong = (val) => val.length >= 6;

  const clearAlerts = () => {
    setMessage(null);
    setError(null);
  };

  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

  const postJSON = async (path, body) => {
    const res = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // include cookies from your server
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error || data?.message || 'Request failed';
      throw new Error(msg);
    }
    return data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearAlerts();

    if (!isEmailValid(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!isPasswordStrong(password)) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup' && (!firstName.trim() || !lastName.trim())) {
      setError('Please provide both your first and last name.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await postJSON('/api/login', { email, password });
        setMessage('Logged in successfully.');
        setTimeout(() => {
          window.location.href = '/home';
        }, 250);
      } else if (mode === 'signup') {
        await postJSON('/api/register', { email, password, firstName: firstName.trim(), lastName: lastName.trim() });
        setMessage('Account created successfully!');
        // Auto-switch to login mode after successful signup
        setTimeout(() => {
          setMode('login');
          setMessage(null);
        }, 2000);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      {/* Main Content */}
      <div className="auth-content">
        {/* Enhanced Header with subtle animation */}
        <div className="auth-header">
          <div className="auth-title-container">
            <h1 className="auth-title">
              {mode === 'login' ? 'FloorTrack' : 'FloorTrack'}
            </h1>
            <div className="auth-title-accent"></div>
          </div>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Access your network dashboard'
              : 'Join the FloorTrack community'
            }
          </p>
        </div>

        {/* Enhanced Form Panel */}
        <div className="ft-panel auth-panel-enhanced">
          <div className="ft-panel-header">
            <div className="ft-panel-title">
              Welcome
            </div>
            <div className="ft-panel-sub">Sign in to your account</div>
          </div>

          {/* Enhanced Tab Navigation */}
          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => setMode('login')}
            >
              Login
            </button>
            <button
              className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => setMode('signup')}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'signup' && (
              <>
                <div className="auth-field">
                  <label className="auth-label">
                    First Name
                  </label>
                  <div className="input-container">
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className="auth-input"
                      required
                    />
                    <div className="input-glow"></div>
                  </div>
                </div>
                <div className="auth-field">
                  <label className="auth-label">
                    Last Name
                  </label>
                  <div className="input-container">
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="auth-input"
                      required
                    />
                    <div className="input-glow"></div>
                  </div>
                </div>
              </>
            )}

            <div className="auth-field">
              <label className="auth-label">
                Email
              </label>
              <div className="input-container">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`auth-input ${email && !isEmailValid(email) ? 'is-invalid' : ''}`}
                  required
                />
                <div className="input-glow"></div>
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">
                Password
              </label>
              <div className="input-container">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`auth-input ${password && !isPasswordStrong(password) ? 'is-invalid' : ''}`}
                  required
                />
                <div className="input-glow"></div>
              </div>
            </div>

            {error && (
              <div className="auth-alert auth-alert-error">
                {error}
              </div>
            )}
            {message && (
              <div className="auth-alert auth-alert-success">
                {message}
              </div>
            )}

            <button type="submit" disabled={loading} className="auth-submit-btn">
              <span className="btn-content">
                {loading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Please wait...
                  </>
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                  </>
                )}
              </span>
              <div className="btn-glow"></div>
            </button>
          </form>
        </div>

        {/* Subtle background decoration */}
        <div className="auth-decoration">
          <div className="decoration-circle circle-1"></div>
          <div className="decoration-circle circle-2"></div>
          <div className="decoration-circle circle-3"></div>
        </div>
      </div>
    </div>
  );
}

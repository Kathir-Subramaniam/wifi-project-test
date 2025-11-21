import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

async function verifySession(signal) {
  const res = await fetch(`${API_BASE}/api/profile`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
  });
  if (!res.ok) throw new Error('Unauthorized');
  return res.json();
}

export default function RequireAuth({ children }) {
  const [status, setStatus] = useState('checking');
  const location = useLocation();

  useEffect(() => {
    const controller = new AbortController();

    verifySession(controller.signal)
      .then(() => setStatus('authed'))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setStatus('rejected');
      });

    return () => controller.abort();
  }, []);

  if (status === 'checking') return null;
  if (status === 'rejected') {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }
  return children;
}
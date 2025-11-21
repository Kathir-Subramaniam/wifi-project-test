import React, { useEffect, useState } from 'react';
import './FloorDashboard.css';
import './AuthPage.css';
import logo from './assets/logo.png';
import UserMenu from './components/UserMenu';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

export default function ProfilePage() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [devices, setDevices] = useState([]);
  const [devName, setDevName] = useState('');
  const [devMac, setDevMac] = useState('');
  const [editDevice, setEditDevice] = useState({}); // { id: { name, mac } }

  const clearAlerts = () => { setError(null); setMessage(null); };

  const reload = async () => {
    clearAlerts();
    setLoading(true);
    try {
      const meResp = await api('/api/me');
      setMe(meResp);
      const u = meResp?.user;
      setFirstName(u?.firstName || '');
      setLastName(u?.lastName || '');

      const myDevs = await api('/api/profile/devices');
      setDevices(myDevs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const saveProfile = async () => {
    setBusy(true); clearAlerts();
    try {
      await api('/api/profile', { method: 'PUT', body: JSON.stringify({ firstName, lastName }) });
      setEditing(false);
      setMessage('Profile updated');
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendPasswordReset = async () => {
    setBusy(true); clearAlerts();
    try {
      const email = me?.user?.email;
      if (!email) throw new Error('No email on file');
      await api('/api/reset-password', { method: 'POST', body: JSON.stringify({ email }) });
      setMessage('Password reset email sent');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const createDevice = async () => {
    setBusy(true); clearAlerts();
    try {
      if (!devName || !devMac) throw new Error('name and mac required');
      await api('/api/profile/devices', { method: 'POST', body: JSON.stringify({ name: devName, mac: devMac }) });
      setDevName(''); setDevMac('');
      setMessage('Device added');
      const myDevs = await api('/api/profile/devices');
      setDevices(myDevs);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveUserDevice = async (id) => {
    const payload = editDevice[id];
    if (!payload) return;
    setBusy(true); clearAlerts();
    try {
      await api(`/api/profile/devices/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: payload.name, mac: payload.mac }),
      });
      setEditDevice(prev => { const p = { ...prev }; delete p[id]; return p; });
      setMessage('Device updated');
      const myDevs = await api('/api/profile/devices');
      setDevices(myDevs);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteUserDevice = async (id) => {
    setBusy(true); clearAlerts();
    try {
      await api(`/api/profile/devices/${id}`, { method: 'DELETE' });
      setMessage('Device deleted');
      const myDevs = await api('/api/profile/devices');
      setDevices(myDevs);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteMyAccount = async () => {
    const sure = window.confirm(
      'This will permanently delete your account, your devices, and group memberships. This action cannot be undone. Do you want to proceed?'
    );
    if (!sure) return;

    setBusy(true); clearAlerts();
    try {
      await api('/api/profile', { method: 'DELETE' });
      // Redirect to auth page (or landing)
      window.location.href = '/';
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="ft-root">
        <div className="ft-appbar">
          <div className="ft-brand"><div className="ft-brand-icon" /><div className="ft-brand-text">Profile</div></div>
          <a className="ft-live-btn" href="/">Dashboard</a>
        </div>
        <div className="ft-panel"><div className="ft-panel-title">Loading…</div></div>
      </div>
    );
  }

  const u = me?.user;
  const roleName = u?.role?.name || 'User';
  const canSeeAdmin = roleName === 'Owner' || roleName === 'Organization Admin' || roleName === 'Site Admin';
  const displayName = `${u?.firstName || ''} ${u?.lastName || ''}`.trim();

  return (
    <div className="ft-root">
      {/* App bar */}
      <div className="ft-appbar">
        <div className="ft-brand">
          <a href="/home">
            <div className="ft-brand-icon"><img src={logo} className="ft-brand-icon" /></div>
          </a>
          <div className="ft-brand-text">Profile</div>
        </div>
        <UserMenu
          onLogout={async () => {
            try { await api('/api/logout', { method: 'POST' }); window.location.href = '/'; } catch { }
          }}
          canSeeAdmin={canSeeAdmin}
          email={u?.email}
          name={displayName}
          currentPath="/profile"
        />
      </div>

      {error && <div className="auth-alert auth-alert-error" style={{ marginBottom: 12 }}>{String(error)}</div>}
      {message && <div className="auth-alert auth-alert-success" style={{ marginBottom: 12 }}>{String(message)}</div>}

      <div className="ft-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Profile panel */}
        <div className="ft-panel">
          <div className="ft-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="ft-panel-title">Your Profile</div>
              <div className="ft-panel-sub">Manage your personal information</div>
            </div>
            {!editing ? (
              <button className="auth-submit-btn" disabled={busy} onClick={() => setEditing(true)}>Edit</button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="auth-submit-btn" disabled={busy} onClick={saveProfile}>Save</button>
                <button className="auth-submit-btn" disabled={busy} onClick={() => { setEditing(false); setFirstName(u?.firstName || ''); setLastName(u?.lastName || ''); }}>Cancel</button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div className="ft-stat-card" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <div>Email</div>
              <div style={{ fontWeight: 700 }}>{u?.email}</div>
            </div>
            <div className="ft-stat-card" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <div>Role</div>
              <div style={{ fontWeight: 700 }}>{roleName}</div>
            </div>

            <div className="ft-stat-card" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <div>First name</div>
              {!editing ? <div style={{ fontWeight: 700 }}>{u?.firstName || '-'}</div> : (
                <input className="auth-input" value={firstName} onChange={e => setFirstName(e.target.value)} />
              )}
            </div>
            <div className="ft-stat-card" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <div>Last name</div>
              {!editing ? <div style={{ fontWeight: 700 }}>{u?.lastName || '-'}</div> : (
                <input className="auth-input" value={lastName} onChange={e => setLastName(e.target.value)} />
              )}
            </div>

            <div className="ft-stat-card" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <div>Password</div>
              <button className="auth-submit-btn" disabled={busy} onClick={sendPasswordReset}>Send reset email</button>
            </div>
            <div className="ft-panel" style={{ marginTop: 16, borderColor: '#3a1a1a' }}>
              <div className="ft-panel-header">
                <div className="ft-panel-title" style={{ color: '#FCA5A5' }}>Danger zone</div>
                <div className="ft-panel-sub">Irreversible actions</div>
              </div>
              <div className="ft-stat-card" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <div>Delete your account and all related data</div>
                <button
                  className="auth-submit-btn"
                  style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: '#3a1a1a', color: '#ffb3b3' }}
                  disabled={busy}
                  onClick={deleteMyAccount}
                >
                  Permanently delete
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Owned devices */}
        <div className="ft-panel">
          <div className="ft-panel-header">
            <div className="ft-panel-title">Your Devices</div>
            <div className="ft-panel-sub">Devices you own (name + MAC)</div>
          </div>

          {/* Create */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 12 }}>
            <input className="auth-input" placeholder="Device name" value={devName} onChange={e => setDevName(e.target.value)} />
            <input className="auth-input" placeholder="MAC address" value={devMac} onChange={e => setDevMac(e.target.value)} />
            <button className="auth-submit-btn" disabled={busy || !devName || !devMac} onClick={createDevice}>Add</button>
          </div>

          {/* List + edit */}
          {devices.length === 0 && <div className="ft-legend-sub">No devices linked yet.</div>}
          {devices.map(d => {
            const ed = editDevice[d.id] || null;
            return (
              <div key={d.id} className="ft-stat-card" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                {ed ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center', width: '100%' }}>
                    <input className="auth-input" placeholder="Name" value={ed.name ?? d.name ?? ''} onChange={e => setEditDevice(prev => ({ ...prev, [d.id]: { ...ed, name: e.target.value } }))} />
                    <input className="auth-input" placeholder="MAC" value={ed.mac ?? d.mac ?? ''} onChange={e => setEditDevice(prev => ({ ...prev, [d.id]: { ...ed, mac: e.target.value } }))} />
                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => saveUserDevice(d.id)}>Save</button>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => setEditDevice(prev => { const p = { ...prev }; delete p[d.id]; return p; })}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>{d.name || '(unnamed)'} — {d.mac}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => setEditDevice(prev => ({ ...prev, [d.id]: { name: d.name ?? '', mac: d.mac ?? '' } }))}>Edit</button>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => deleteUserDevice(d.id)}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

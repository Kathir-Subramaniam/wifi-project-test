import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './FloorDashboard.css';
import APMapParsed from './APMapParsed.jsx';
import ZoomableMap from './ZoomableMap.jsx';
import UserMenu from './components/UserMenu.jsx';
import logo from './assets/logo.png';
import devicesImg from './assets/devices.svg';
import occupancyImg from './assets/occupancy.svg';
import activeAPImg from './assets/activeAP.svg';
import floorStatusImg from './assets/floorStatus.svg';

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


const VIEWBOX = { w: 1355, h: 1016 };

const COLORS = { low: '#2DD4BF', medium: '#F59E0B', high: '#EF4444' };

export default function FloorDashboard() {
  const [floors, setFloors] = useState([]); // [{id, name, buildingName}]
  const [floorId, setFloorId] = useState(1);
  const [floorName, setFloorName] = useState('Floor 1');
  const [buildingName, setBuildingName] = useState('');
  const [profile, setProfile] = useState(null);
  const [myConnections, setMyConnections] = useState([]);
  const [connError, setConnError] = useState(null);
  const [connLoading, setConnLoading] = useState(false);

  const [stats, setStats] = useState({
    totalDevices: 0,
    totalAps: 0,
    buildingOccupancy: '0%',
    floorStatus: 'Active',
  });

  const [apCount, setApCount] = useState([]); // [{apId,title,cx,cy,deviceCount}]
  const [floorMapUrl, setFloorMapUrl] = useState(null);

  //0) Fetch User data
  useEffect(() => {
    (async () => {
      try {
        const p = await api('/api/profile'); // use profile endpoint
        setProfile(p);
      } catch (e) {
        console.log('profile load failed', e);
      }
    })();
  }, []);

  const onLogout = async () => {
    try {
      await api('/api/logout', { method: 'POST' });
      window.location.href = '/';
    } catch (e) {
      console.log('logout failed', e);
    }
  };

  const roleName = profile?.user?.role?.name || '';
  const canSeeAdmin = roleName === 'Owner' || roleName === 'Organization Admin' || roleName === 'Site Admin';
  const displayName = `${profile?.user?.firstName || ''} ${profile?.user?.lastName || ''}`.trim();


  // 1) Fetch floors list with building names
  useEffect(() => {
    async function fetchFloors() {
      try {
        const res = await fetch(`${API_BASE}/api/floors`, { credentials: 'include', headers: { 'Content-Type': 'application/json' } });
        const data = await res.json();
        if (Array.isArray(data)) {
          setFloors(data);
          // If current floor is not in list, default to first
          if (!data.find(f => String(f.id) === String(floorId))) {
            const first = data[0];
            if (first) {
              setFloorId(Number(first.id));
            }
          }
        }
      } catch (e) {
        console.log('Error fetching floors list', e);
      }
    }
    fetchFloors();
  }, []);

  // 2) Fetch all floor-dependent data when floorId changes
  useEffect(() => {
    if (!floorId) return;
    let revokeUrl;

    async function fetchAll() {
      try {
        // const [devicesRes, apsRes, apsCountRes, floorRes, buildingRes] = await Promise.all([
        //   fetch(`${API_BASE}/api/stats/total-devices`),
        //   fetch(`${API_BASE}/api/stats/total-aps`),
        //   fetch(`${API_BASE}/api/stats/devices-by-ap?floorId=${floorId}`),
        //   fetch(`${API_BASE}/api/floors/${floorId}`),
        //   fetch(`${API_BASE}/api/floors/${floorId}/building`),
        // ]);

        const creds = { credentials: 'include', headers: { 'Content-Type': 'application/json' } };
        const query = `floorId=${floorId}`;
        const [devicesRes, apsRes, apsCountRes, floorRes, buildingRes] = await Promise.all([
          fetch(`${API_BASE}/api/stats/total-devices?${query}`, creds),
          fetch(`${API_BASE}/api/stats/total-aps?${query}`, creds),
          fetch(`${API_BASE}/api/stats/devices-by-ap?${query}`, creds),
          fetch(`${API_BASE}/api/floors/${floorId}`, creds),
          fetch(`${API_BASE}/api/floors/${floorId}/building`, creds),
        ]);

        const devicesData = await devicesRes.json();
        const apsData = await apsRes.json();
        const apsCountData = await apsCountRes.json();
        const floorData = await floorRes.json();
        const buildingData = await buildingRes.json();

        setStats({
          totalDevices: devicesData.totalDevices ?? 0,
          totalAps: apsData.totalAps ?? 0,
          buildingOccupancy: `${Math.round((devicesData.totalDevices ?? 0) / 400 * 100)}%`,
          floorStatus: 'Active',
        });

        setApCount(Array.isArray(apsCountData.aps) ? apsCountData.aps : []);

        setFloorName(floorData?.name ? floorData.name : `Floor ${floorId}`);
        setBuildingName(buildingData?.name || '');

        const map = floorData?.svgMap;
        if (map) {
          if (/^https?:\/\//i.test(map)) {
            setFloorMapUrl(map);
          } else {
            const blob = new Blob([map], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            revokeUrl = url;
            setFloorMapUrl(url);
          }
        } else {
          setFloorMapUrl(null);
        }
      } catch (err) {
        console.log('Error fetching data', err);
      }
    }

    fetchAll();
    return () => {
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [floorId]);

  useEffect(() => {
    (async () => {
      try {
        if (!profile?.user?.id) return; // wait for profile to load
        setConnLoading(true);
        setConnError(null);

        const res = await fetch(`${API_BASE}/api/users/${profile.user.id}/ap-connection`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load connections');

        setMyConnections(Array.isArray(data.connections) ? data.connections : []);
      } catch (e) {
        setConnError(e.message);
      } finally {
        setConnLoading(false);
      }
    })();
  }, [profile?.user?.id]);

  const statCards = useMemo(() => [
    { label: 'Total Devices', value: stats.totalDevices, icon: devicesImg },
    { label: 'Active APs', value: stats.totalAps, icon: activeAPImg },
    { label: 'Building Occupancy', value: stats.buildingOccupancy, icon: occupancyImg },
    { label: 'Floor Status', value: stats.floorStatus, icon: floorStatusImg },
  ], [stats]);

  // 3) Reusable selector UI (used in app bar and panel header)
  const FloorSelector = (
    <div className="ft-floor-selector">
      <label className="ft-floor-label" htmlFor="floor-select">Floor</label>
      <select
        id="floor-select"
        className="ft-floor-select"
        value={floorId}
        onChange={(e) => setFloorId(Number(e.target.value))}
      >
        {floors.map(f => (
          <option key={f.id} value={Number(f.id)}>
            {f.name}{f.buildingName ? ` — ${f.buildingName}` : ''}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="ft-root">
      {/* App bar */}
      <div className="ft-appbar">
        <div className="ft-brand">
          <div className="ft-brand-icon"><img src={logo} className="ft-brand-icon" /></div>
          <div className="ft-brand-text">FloorTrack</div>
        </div>

        {/* Replace Live button with user menu */}
        <UserMenu
          onLogout={onLogout}
          canSeeAdmin={canSeeAdmin}
          email={profile?.user?.email}
          name={displayName}
          currentPath="/home"
        />
      </div>


      {/* Stats Row */}
      <div className="ft-stats-row">
        {statCards.map((c, i) => (
          <div key={i} className="ft-stat-card">
            <div className="ft-stat-icon">
              <img src={c.icon} alt={c.label} className="ft-stat-icon" />
            </div>
            <div className="ft-stat-meta">
              <div className="ft-stat-label">{c.label}</div>
              <div className="ft-stat-value">{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="ft-grid">
        {/* Map Panel */}
        <div className="ft-panel">
          <div className="ft-panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div className="ft-panel-title">
                {floorName}{buildingName ? ` • ${buildingName}` : ''}
              </div>
              <div className="ft-panel-sub">Real-time connection heatmap</div>
            </div>
            {/* And also next to the title */}
            {FloorSelector}
          </div>

          <div className="ft-map-frame">
            <ZoomableMap viewBox={VIEWBOX}>
              <APMapParsed
                floorId={floorId}
                apCount={apCount}
                floorMapUrl={floorMapUrl}
              />
            </ZoomableMap>
          </div>
        </div>

        {/* Legend Panel etc... */}
        <div className="ft-legend-panel">
          <div className="ft-legend-title">Connection Density</div>
          <div className="ft-legend-items">
            <div className="ft-legend-item">
              <span className="ft-dot-swatch" style={{ background: COLORS.high }} />
              <div>
                <div className="ft-legend-label">High density</div>
                <div className="ft-legend-sub">20+ devices</div>
              </div>
            </div>
            <div className="ft-legend-item">
              <span className="ft-dot-swatch" style={{ background: COLORS.medium }} />
              <div>
                <div className="ft-legend-label">Medium density</div>
                <div className="ft-legend-sub">10–20 devices</div>
              </div>
            </div>
            <div className="ft-legend-item">
              <span className="ft-dot-swatch" style={{ background: COLORS.low }} />
              <div>
                <div className="ft-legend-label">Low density</div>
                <div className="ft-legend-sub">1–10 devices</div>
              </div>
            </div>

            <div className="ft-legend-divider" />

            <div className="ft-legend-metrics">
              <div className="ft-legend-metric">
                <span className="ft-metric-label">Total devices</span>
                <span className="ft-metric-value">{stats.totalDevices}</span>
              </div>
              <div className="ft-legend-metric">
                <span className="ft-metric-label">Hotspots (≥20)</span>
                <span className="ft-metric-value">{stats.totalAps}</span>
              </div>
            </div>
          </div>
        </div>
        {/* My Device Connections */}
        <div className="ft-panel" style={{ marginTop: 16 }}>
          <div className="ft-panel-header">
            <div className="ft-panel-title">My Device Connections</div>
            <div className="ft-panel-sub">Latest AP per registered device</div>
          </div>

          {connLoading && <div className="ft-legend-sub">Loading…</div>}
          {connError && <div className="auth-alert auth-alert-error" style={{ marginBottom: 8 }}>{String(connError)}</div>}

          {!connLoading && !connError && (
            <>
              {myConnections.length === 0 && (
                <div className="ft-legend-sub">No registered devices found.</div>
              )}

              {myConnections.map((c, i) => (
                <div key={i} className="ft-stat-card" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontWeight: 700 }}>
                      {c.mac?.toUpperCase?.() || '(unknown MAC)'}
                    </div>
                    {c.ap ? (
                      <div className="ft-legend-sub">
                        Connected to {c.ap.name} {c.ap.floorId ? `(Floor #${c.ap.floorId})` : ''}
                      </div>
                    ) : (
                      <div className="ft-legend-sub">Not currently connected</div>
                    )}
                  </div>
                  <div className="ft-legend-sub" title={c.updatedAt || ''}>
                    {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : ''}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

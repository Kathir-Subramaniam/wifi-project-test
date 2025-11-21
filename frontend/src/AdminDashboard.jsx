import React, { useEffect, useMemo, useRef, useState } from 'react';
import './FloorDashboard.css';
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

async function fetchFloorDetail(floorId) {
  return api(`/api/floors/${floorId}`);
}

// debounce helper for text inputs
function useDebounce(fn, delay = 300) {
  const timer = useRef(null);
  return (value) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(value), delay);
  };
}

// Themed file picker
function FilePicker({ onPick, label = 'Upload SVG', accept = '.svg,image/svg+xml', disabled }) {
  const inputRef = useRef(null);
  return (
    <div className="ft-filepicker">
      <button
        type="button"
        className="auth-submit-btn"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="ft-filepicker-input"
        onChange={onPick}
      />
    </div>
  );
}


// Sorting utils
function by(getter, dir = 'asc') {
  return (a, b) => {
    const av = getter(a);
    const bv = getter(b);
    if (av == null && bv != null) return dir === 'asc' ? 1 : -1;
    if (av != null && bv == null) return dir === 'asc' ? -1 : 1;
    if (av == null && bv == null) return 0;
    if (typeof av === 'number' && typeof bv === 'number') {
      return dir === 'asc' ? av - bv : bv - av;
    }
    const as = String(av).toLowerCase();
    const bs = String(bv).toLowerCase();
    if (as < bs) return dir === 'asc' ? -1 : 1;
    if (as > bs) return dir === 'asc' ? 1 : -1;
    return 0;
  };
}
function sortWith(list, ...comparators) {
  if (!Array.isArray(list)) return [];
  const cmp = (a, b) => {
    for (const c of comparators) {
      const r = c(a, b);
      if (r !== 0) return r;
    }
    return 0;
  };
  return [...list].sort(cmp);
}

// Unified Sort dropdown
function SortDropdown({ fields, value, order, onChange }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!open) return;
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onEsc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const currentFieldLabel = fields.find(f => f.value === value)?.label || fields[0]?.label || 'Sort';
  const currentOrderLabel = order === 'desc' ? 'Descending' : 'Ascending';

  return (
    <div className="ft-sort-dd">
      <button
        ref={btnRef}
        type="button"
        className="auth-submit-btn ft-sort-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {currentFieldLabel} • {currentOrderLabel}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 6, opacity: 0.8 }}>
          <path d="M7 10l5 5 5-5" stroke="#CDE8FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div ref={menuRef} role="menu" className="ft-sort-menu">
          <div className="ft-sort-section">
            <div className="ft-legend-sub" style={{ padding: '6px 10px' }}>Field</div>
            {fields.map(f => {
              const selected = f.value === value;
              return (
                <button
                  key={f.value}
                  role="menuitemradio"
                  aria-checked={selected}
                  className={`ft-sort-item ${selected ? 'selected' : ''}`}
                  onClick={() => { onChange({ field: f.value, order }); setOpen(false); }}
                >
                  <span className="ft-sort-check">{selected ? '✓' : ''}</span>
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

          <div className="ft-sort-divider" />

          <div className="ft-sort-section">
            <div className="ft-legend-sub" style={{ padding: '6px 10px' }}>Order</div>
            {[
              { v: 'asc', label: 'Ascending' },
              { v: 'desc', label: 'Descending' },
            ].map(o => {
              const selected = o.v === order;
              return (
                <button
                  key={o.v}
                  role="menuitemradio"
                  aria-checked={selected}
                  className={`ft-sort-item ${selected ? 'selected' : ''}`}
                  onClick={() => { onChange({ field: value, order: o.v }); setOpen(false); }}
                >
                  <span className="ft-sort-check">{selected ? '✓' : ''}</span>
                  <span>{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SortBar({ fields, value, order, onField, onOrder }) {
  const handleChange = ({ field, order }) => {
    onField(field);
    onOrder(order);
  };
  return (
    <div className="ft-sortbar">
      <div className="ft-legend-sub">Sort</div>
      <SortDropdown
        fields={fields}
        value={value}
        order={order}
        onChange={handleChange}
      />
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('buildings');


  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors] = useState([]);
  const [aps, setAps] = useState([]);
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [globalPerms, setGlobalPerms] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Floors editor state
  const [floorEditMap, setFloorEditMap] = useState({}); // { [id]: { name, svgMap, __fileName, __error } }
  const floorDebounceTimers = useRef({}); // { [id]: number }
  const debouncedSetFloorSvg = (id, value) => {
    if (floorDebounceTimers.current[id]) {
      clearTimeout(floorDebounceTimers.current[id]);
    }
    floorDebounceTimers.current[id] = setTimeout(() => {
      setFloorEditField(id, { svgMap: value });
      delete floorDebounceTimers.current[id];
    }, 300);
  };
  const setFloorEditField = (id, patch) => {
    setFloorEditMap(prev => {
      const cur = prev[id] || {};
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  };
  const beginEditFloor = async (f) => {
    const id = f?.id;
    if (!id) return;
    setFloorEditMap(prev => ({
      ...prev,
      [id]: { name: f.name || '', svgMap: prev[id]?.svgMap ?? '', __fileName: null, __error: null }
    }));
    try {
      const detail = await fetchFloorDetail(id);
      const svgMap = (detail && typeof detail.svgMap === 'string') ? detail.svgMap : '';
      setFloorEditField(id, { svgMap, __error: null });
    } catch (err) {
      setFloorEditField(id, { __error: 'Failed to load floor details', svgMap: '' });
    }
  };

  // Sort states
  const [sortBuildings, setSortBuildings] = useState({ field: 'name', order: 'asc' });
  const [sortFloors, setSortFloors] = useState({ field: 'buildingName', order: 'asc' });
  const [sortAPs, setSortAPs] = useState({ field: 'buildingId', order: 'asc' });
  const [sortDevices, setSortDevices] = useState({ field: 'apId', order: 'asc' });
  const [sortGroups, setSortGroups] = useState({ field: 'name', order: 'asc' });
  const [sortGlobalPerms, setSortGlobalPerms] = useState({ field: 'groupName', order: 'asc' });
  const [sortPending, setSortPending] = useState({ field: 'email', order: 'asc' });

  // Edit state
  const [editBuilding, setEditBuilding] = useState({});
  const [editFloor, setEditFloor] = useState({});
  const [editAP, setEditAP] = useState({});
  const [editDevice, setEditDevice] = useState({});
  const [editGroup, setEditGroup] = useState({});

  // Create fields
  const [bName, setBName] = useState('');
  const [fName, setFName] = useState('');
  const [fSvg, setFSvg] = useState('');
  const [fBuildingId, setFBuildingId] = useState('');
  const [apName, setApName] = useState('');
  const [apCx, setApCx] = useState('');
  const [apCy, setApCy] = useState('');
  const [apFloorId, setApFloorId] = useState('');
  const [devMac, setDevMac] = useState('');
  const [devApId, setDevApId] = useState('');

  // Groups create
  const [grpName, setGrpName] = useState('');

  // GlobalPermissions create
  const [gpGroupId, setGpGroupId] = useState('');
  const [gpBuildingId, setGpBuildingId] = useState('');
  const [gpFloorId, setGpFloorId] = useState('');

  // Pending Users assignment: { [userId]: { roleId: string, groupIds: string[] } }
  const [assignPending, setAssignPending] = useState({});

  // Profile for user menu
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const p = await api('/api/profile');
        setProfile(p);
      } catch { }
    })();
  }, []);
  const onLogout = async () => {
    try {
      await api('/api/logout', { method: 'POST' });
      window.location.href = '/';
    } catch { }
  };
  const displayName = `${profile?.user?.firstName || ''} ${profile?.user?.lastName || ''}`.trim();
  const email = profile?.user?.email;

  const roleName = profile?.user?.role?.name || '';
  const isOwner = roleName === 'Owner';
  const isSiteAdmin = roleName === 'Site Admin';
  const isOrgAdmin = roleName === 'Organization Admin';
  const myGroupIds = useMemo(
    () => (profile?.user?.groups || []).map(g => String(g.id)),
    [profile]
  );



  useEffect(() => {
    // Always block these for non-owners
    if (!isOwner && (tab === 'groups' || tab === 'pendingUsers')) {
      setTab('buildings');
      return;
    }
    // Block GlobalPermissions for Site Admin
    if (isSiteAdmin && tab === 'globalPermissions') {
      setTab('buildings');
    }
  }, [isOwner, isSiteAdmin, tab]);


  // Map helpers for quick inclusion checks
  const gpForMyGroups = useMemo(() => {
    if (!isOrgAdmin) return [];
    return (globalPerms || []).filter(rec => myGroupIds.includes(String(rec.groupId)));
  }, [globalPerms, isOrgAdmin, myGroupIds]);
  const allowedBuildingIdsSet = useMemo(() => {
    if (isOwner) return null; // null means "no filtering"
    if (!isOrgAdmin) return new Set(); // site admin hidden; defensive
    return new Set(gpForMyGroups.map(rec => String(rec.buildingId)));
  }, [gpForMyGroups, isOwner, isOrgAdmin]);

  const allowedFloorIdsSet = useMemo(() => {
    if (isOwner) return null;
    if (!isOrgAdmin) return new Set();
    // floors whitelisted directly by GP
    const directFloorIds = gpForMyGroups.map(rec => String(rec.floorId));
    // also include floors under allowed buildings
    const buildingScopedFloorIds = floors
      .filter(f => allowedBuildingIdsSet.has(String(f.buildingId)))
      .map(f => String(f.id));
    return new Set([...directFloorIds, ...buildingScopedFloorIds]);
  }, [gpForMyGroups, isOwner, isOrgAdmin, floors, allowedBuildingIdsSet]);

  // Filtered lists for dropdowns
  const groupsForDropdown = useMemo(() => {
    if (isOwner) return groups;
    if (isOrgAdmin) {
      // Use the groups embedded in profile for Org Admin
      return (profile?.user?.groups || []).map(g => ({ id: String(g.id), name: g.name }));
    }
    return []; // Site Admins don't see this tab
  }, [isOwner, isOrgAdmin, profile, groups]);

  

  const buildingsForDropdown = useMemo(() => {
    if (isOwner) return buildings;
    if (isOrgAdmin) {
      return buildings.filter(b => allowedBuildingIdsSet.has(String(b.id)));
    }
    return [];
  }, [isOwner, isOrgAdmin, buildings, allowedBuildingIdsSet]);

  const floorsForDropdown = useMemo(() => {
    if (isOwner) return floors;
    if (isOrgAdmin) {
      return floors.filter(f => allowedFloorIdsSet.has(String(f.id)));
    }
    return [];
  }, [isOwner, isOrgAdmin, floors, allowedFloorIdsSet]);

  const floorsShown = useMemo(() => {
    if (!gpBuildingId) return floorsForDropdown;
    return floorsForDropdown.filter(f => String(f.buildingId) === String(gpBuildingId));
  }, [floorsForDropdown, gpBuildingId]);


  useEffect(() => {
    // Clear group if not in filtered list
    if (gpGroupId && !groupsForDropdown.some(g => String(g.id) === String(gpGroupId))) {
      setGpGroupId('');
    }
    // Clear building if not in filtered list
    if (gpBuildingId && !buildingsForDropdown.some(b => String(b.id) === String(gpBuildingId))) {
      setGpBuildingId('');
    }
    // Clear floor if not in filtered list
    if (gpFloorId && !floorsForDropdown.some(f => String(f.id) === String(gpFloorId))) {
      setGpFloorId('');
    }
  }, [groupsForDropdown, buildingsForDropdown, floorsForDropdown, gpGroupId, gpBuildingId, gpFloorId]);

  // Sorted lists
  const buildingsSorted = useMemo(() =>
    sortWith(
      buildings,
      by(b => (sortBuildings.field === 'name' ? b.name : Number(b.id)), sortBuildings.order),
      by(b => Number(b.id), 'asc')
    ), [buildings, sortBuildings]);

  const floorsSorted = useMemo(() =>
    sortWith(
      floors,
      ...(function () {
        const f = sortFloors.field;
        const ord = sortFloors.order;
        if (f === 'name') return [by(x => x.name, ord)];
        if (f === 'id') return [by(x => Number(x.id), ord)];
        if (f === 'buildingId') return [by(x => Number(x.buildingId), ord)];
        return [by(x => x.buildingName || '', ord), by(x => Number(x.buildingId), ord)];
      })(),
      by(x => x.name, 'asc'),
      by(x => Number(x.id), 'asc')
    ), [floors, sortFloors]);

  const apsSorted = useMemo(() =>
    sortWith(
      aps,
      ...(function () {
        const f = sortAPs.field;
        const ord = sortAPs.order;
        if (f === 'name') return [by(x => x.name, ord)];
        if (f === 'id') return [by(x => Number(x.id), ord)];
        if (f === 'floorId') return [by(x => Number(x.floorId), ord)];
        if (f === 'cx') return [by(x => Number(x.cx), ord)];
        if (f === 'cy') return [by(x => Number(x.cy), ord)];
        return [by(x => Number(x.buildingId), ord)];
      })(),
      by(x => Number(x.floorId), 'asc'),
      by(x => x.name, 'asc'),
      by(x => Number(x.id), 'asc')
    ), [aps, sortAPs]);

  const devicesSorted = useMemo(() =>
    sortWith(
      devices,
      ...(function () {
        const f = sortDevices.field;
        const ord = sortDevices.order;
        if (f === 'id') return [by(x => Number(x.id), ord)];
        if (f === 'mac') return [by(x => x.mac, ord)];
        if (f === 'apId') return [by(x => Number(x.apId), ord)];
        if (f === 'floorId') return [by(x => Number(x.floorId), ord)];
        if (f === 'buildingId') return [by(x => Number(x.buildingId), ord)];
        return [by(x => Number(x.apId), ord)];
      })(),
      by(x => x.mac, 'asc'),
      by(x => Number(x.id), 'asc')
    ), [devices, sortDevices]);

  const groupsSorted = useMemo(() =>
    sortWith(
      groups,
      ...(function () {
        const f = sortGroups.field;
        const ord = sortGroups.order;
        if (f === 'name') return [by(x => x.name, ord)];
        return [by(x => Number(x.id), ord)];
      })(),
      by(x => x.name, 'asc'),
      by(x => Number(x.id), 'asc')
    ), [groups, sortGroups]
  );

  const globalPermsSorted = useMemo(() =>
    sortWith(
      globalPerms,
      ...(function () {
        const f = sortGlobalPerms.field;
        const ord = sortGlobalPerms.order;
        if (f === 'groupName') return [by(x => x.groupName || '', ord)];
        if (f === 'buildingName') return [by(x => x.buildingName || '', ord)];
        if (f === 'floorName') return [by(x => x.floorName || '', ord)];
        if (f === 'groupId') return [by(x => Number(x.groupId), ord)];
        if (f === 'buildingId') return [by(x => Number(x.buildingId), ord)];
        if (f === 'floorId') return [by(x => Number(x.floorId), ord)];
        return [by(x => Number(x.id), ord)];
      })(),
      by(x => x.groupName || '', 'asc'),
      by(x => x.buildingName || '', 'asc'),
      by(x => x.floorName || '', 'asc'),
      by(x => Number(x.id), 'asc')
    ), [globalPerms, sortGlobalPerms]
  );

  const globalPermsForDisplay = useMemo(() => {
    if (isOwner) return globalPermsSorted;
    if (isOrgAdmin) {
      // show only entries for this admin’s groups
      const allowedSet = new Set(myGroupIds);
      const filtered = (globalPerms || []).filter(rec => allowedSet.has(String(rec.groupId)));
      // reuse your sorter to keep UX consistent
      return sortWith(
        filtered,
        ...(function () {
          const f = sortGlobalPerms.field;
          const ord = sortGlobalPerms.order;
          if (f === 'groupName') return [by(x => x.groupName || '', ord)];
          if (f === 'buildingName') return [by(x => x.buildingName || '', ord)];
          if (f === 'floorName') return [by(x => x.floorName || '', ord)];
          if (f === 'groupId') return [by(x => Number(x.groupId), ord)];
          if (f === 'buildingId') return [by(x => Number(x.buildingId), ord)];
          if (f === 'floorId') return [by(x => Number(x.floorId), ord)];
          return [by(x => Number(x.id), ord)];
        })(),
        by(x => x.groupName || '', 'asc'),
        by(x => x.buildingName || '', 'asc'),
        by(x => x.floorName || '', 'asc'),
        by(x => Number(x.id), 'asc')
      );
    }
    return []; // Site Admin hidden; defensive
  }, [isOwner, isOrgAdmin, globalPerms, myGroupIds, globalPermsSorted, sortGlobalPerms]);


  const pendingSorted = useMemo(() =>
    sortWith(
      pendingUsers,
      ...(function () {
        const f = sortPending.field;
        const ord = sortPending.order;
        if (f === 'email') return [by(x => x.email || '', ord)];
        if (f === 'id') return [by(x => Number(x.id), ord)];
        if (f === 'createdAt') return [by(x => new Date(x.createdAt).getTime(), ord)];
        return [by(x => x.email || '', ord)];
      })(),
      by(x => x.email || '', 'asc'),
      by(x => Number(x.id), 'asc')
    ), [pendingUsers, sortPending]
  );

  const reload = async () => {
    setError(null);
    try {
      const canSeeGlobalPerms = isOwner || roleName === 'Organization Admin';

      const calls = [
        api('/api/admin/buildings'),
        api('/api/admin/floors'),
        api('/api/admin/aps'),
        api('/api/admin/devices'),
        isOwner ? api('/api/admin/groups') : Promise.resolve([]),
        canSeeGlobalPerms ? api('/api/admin/global-permissions') : Promise.resolve([]),
        isOwner ? api('/api/admin/pending-users') : Promise.resolve([]),
        api('/api/admin/roles'),
      ];

      const [b, f, a, d, g, gp, pu, rl] = await Promise.allSettled(calls);

      if (b.status === 'fulfilled') setBuildings(b.value);
      if (f.status === 'fulfilled') setFloors(f.value);
      if (a.status === 'fulfilled') setAps(a.value);
      if (d.status === 'fulfilled') setDevices(d.value);
      if (g.status === 'fulfilled') setGroups(g.value || []);
      if (gp.status === 'fulfilled') setGlobalPerms(gp.value || []);
      if (pu.status === 'fulfilled') setPendingUsers(pu.value || []);
      if (rl.status === 'fulfilled') setRoles(rl.value);
    } catch (e) {
      setError(e.message);
    }
  };


  // Reload whenever profile (and thus isOwner) is known
  useEffect(() => {
    if (profile) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, isOwner]);


  // Create handlers
  const onCreateBuilding = async (name) => {
    setBusy(true); setError(null);
    try {
      await api('/api/admin/buildings', { method: 'POST', body: JSON.stringify({ name }) });
      await reload();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const onCreateFloor = async (name, svgMap, buildingId) => {
    setBusy(true); setError(null);
    try {
      await api('/api/admin/floors', { method: 'POST', body: JSON.stringify({ name, svgMap, buildingId }) });
      await reload();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const onCreateAP = async (name, cx, cy, floorId) => {
    setBusy(true); setError(null);
    try {
      await api('/api/admin/aps', { method: 'POST', body: JSON.stringify({ name, cx: Number(cx), cy: Number(cy), floorId }) });
      await reload();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const onCreateDevice = async (mac, apId) => {
    setBusy(true); setError(null);
    try {
      await api('/api/admin/devices', { method: 'POST', body: JSON.stringify({ mac, apId }) });
      await reload();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const onCreateGroup = async (name) => {
    setBusy(true); setError(null);
    try {
      await api('/api/admin/groups', { method: 'POST', body: JSON.stringify({ name }) });
      setGrpName('');
      await reload();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const onCreateGlobalPermission = async (groupId, buildingId, floorId) => {
    setBusy(true); setError(null);
    try {
      if (!groupId || !buildingId || !floorId) throw new Error('group, building, and floor are required');
      await api('/api/admin/global-permissions', { method: 'POST', body: JSON.stringify({ groupId, buildingId, floorId }) });
      setGpGroupId(''); setGpBuildingId(''); setGpFloorId('');
      await reload();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  // Delete
  const onDelete = async (kind, id) => {
    setBusy(true); setError(null);
    try {
      await api(`/api/admin/${kind}/${id}`, { method: 'DELETE' });
      await reload();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const onDeleteGroup = async (id) => onDelete('groups', id);
  const onDeleteGlobalPermission = async (id) => onDelete('global-permissions', id);

  // Save edits
  const saveBuilding = async (id) => {
    const payload = editBuilding[id];
    if (!payload) return;
    setBusy(true); setError(null);
    try {
      await api(`/api/admin/buildings/${id}`, { method: 'PUT', body: JSON.stringify({ name: payload.name }) });
      setEditBuilding(prev => { const p = { ...prev }; delete p[id]; return p; });
      await reload();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const saveFloor = async (id) => {
    const payload = editFloor[id];
    if (!payload) return;
    setBusy(true); setError(null);
    try {
      const body = {};
      if (payload.name != null) body.name = payload.name;
      if (payload.svgMap != null) body.svgMap = payload.svgMap;
      await api(`/api/admin/floors/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      setEditFloor(prev => { const p = { ...prev }; delete p[id]; return p; });
      await reload();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const saveAP = async (id) => {
    const payload = editAP[id];
    if (!payload) return;
    setBusy(true); setError(null);
    try {
      const body = {};
      if (payload.name != null) body.name = payload.name;
      if (payload.cx != null) body.cx = Number(payload.cx);
      if (payload.cy != null) body.cy = Number(payload.cy);
      await api(`/api/admin/aps/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      setEditAP(prev => { const p = { ...prev }; delete p[id]; return p; });
      await reload();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const saveDevice = async (id) => {
    const payload = editDevice[id];
    if (!payload) return;
    setBusy(true); setError(null);
    try {
      const body = {};
      if (payload.mac != null) body.mac = payload.mac;
      if (payload.apId != null) body.apId = String(payload.apId); // backend expects an id; String ok

      if (Object.keys(body).length === 0) {
        throw new Error('No changes to save');
      }

      await api(`/api/admin/devices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      setEditDevice(prev => { const p = { ...prev }; delete p[id]; return p; });
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveGroup = async (id) => {
    const payload = editGroup[id];
    if (!payload) return;
    setBusy(true); setError(null);
    try {
      await api(`/api/admin/groups/${id}`, { method: 'PUT', body: JSON.stringify({ name: payload.name }) });
      setEditGroup(prev => { const p = { ...prev }; delete p[id]; return p; });
      await reload();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  // Assign pending user: role + multiple groups
  const assignUserRoleAndGroup = async (userId) => {
    const payload = assignPending[userId];
    if (!payload || !payload.roleId || !Array.isArray(payload.groupIds) || payload.groupIds.length === 0) {
      setError('Please select a role and at least one group');
      return;
    }
    setBusy(true); setError(null);
    try {
      console.log(payload.roleId)
      console.log(payload.groupIds.map(String))
      await api(`/api/admin/pending-users/${userId}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          roleId: payload.roleId,
          groupIds: payload.groupIds.map(String),
        }),
      });
      setAssignPending(prev => { const next = { ...prev }; delete next[userId]; return next; });
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const TabButton = ({ id, label }) => (
    <button className={`auth-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
  );

  return (
    <div className="ft-root">
      <div className="ft-appbar">
        <div className="ft-brand">
          <a href="/home">
            <div className="ft-brand-icon"><img src={logo} className="ft-brand-icon" /></div>
          </a>
          <div className="ft-brand-text">Admin</div>
        </div>
        <UserMenu
          onLogout={onLogout}
          canSeeAdmin={true}     // or compute like FloorDashboard if preferred
          email={email}
          name={displayName}
          currentPath="/admin"
        />
      </div>

      <div className="auth-tabs" style={{ marginBottom: 16 }}>
        <TabButton id="buildings" label="Buildings" />
        <TabButton id="floors" label="Floors" />
        <TabButton id="aps" label="APs" />
        <TabButton id="devices" label="Devices" />
        {isOwner && <TabButton id="groups" label="Groups" />}
        {(isOwner || roleName === 'Organization Admin') && (
          <TabButton id="globalPermissions" label="GlobalPermissions" />
        )}
        {isOwner && <TabButton id="pendingUsers" label="Pending Users" />}
      </div>



      {error && <div className="auth-alert auth-alert-error" style={{ marginBottom: 12 }}>{String(error)}</div>}

      {/* Buildings */}
      {tab === 'buildings' && (
        <div className="ft-panel">
          <div className="ft-panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div className="ft-panel-title">Buildings</div>
              <div className="ft-panel-sub">Create, edit, or delete buildings</div>
            </div>
            <SortBar
              fields={[
                { value: 'name', label: 'Name' },
                { value: 'id', label: 'ID' },
              ]}
              value={sortBuildings.field}
              order={sortBuildings.order}
              onField={v => setSortBuildings(s => ({ ...s, field: v }))}
              onOrder={v => setSortBuildings(s => ({ ...s, order: v }))}
            />
          </div>

          {/* Create */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input className="auth-input" placeholder="Building name" value={bName} onChange={e => setBName(e.target.value)} />
            <button className="auth-submit-btn" disabled={busy || !bName} onClick={() => onCreateBuilding(bName)}>Add</button>
          </div>

          {/* List + edit */}
          {buildingsSorted.map(b => {
            const editing = editBuilding[b.id] || null;
            return (
              <div key={b.id} className="ft-stat-card" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                {editing ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                    <input className="auth-input" value={editing.name ?? b.name} onChange={e => setEditBuilding(prev => ({ ...prev, [b.id]: { ...editing, name: e.target.value } }))} />
                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => saveBuilding(b.id)}>Save</button>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => setEditBuilding(prev => { const p = { ...prev }; delete p[b.id]; return p; })}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>{b.name} (#{b.id})</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => setEditBuilding(prev => ({ ...prev, [b.id]: { name: b.name } }))}>Edit</button>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => onDelete('buildings', b.id)}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Floors */}
      {tab === 'floors' && (
        <div className="ft-panel">
          <div className="ft-panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div className="ft-panel-title">Floors</div>
              <div className="ft-panel-sub">Create, edit, or delete floors</div>
            </div>
            <SortBar
              fields={[
                { value: 'buildingName', label: 'Building name' },
                { value: 'buildingId', label: 'Building ID' },
                { value: 'name', label: 'Floor name' },
                { value: 'id', label: 'Floor ID' },
              ]}
              value={sortFloors.field}
              order={sortFloors.order}
              onField={v => setSortFloors(s => ({ ...s, field: v }))}
              onOrder={v => setSortFloors(s => ({ ...s, order: v }))}
            />
          </div>

          {/* Create */}
          <div className="ft-row gap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', marginBottom: 12 }}>
            <input className="auth-input" placeholder="Floor name" value={fName} onChange={e => setFName(e.target.value)} />
            <select className="auth-input" value={fBuildingId} onChange={e => setFBuildingId(e.target.value)}>
              <option value="">Select building</option>
              {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input className="auth-input" placeholder="SVG map (Raw SVG text)" value={fSvg} onChange={e => setFSvg(e.target.value)} />
            <FilePicker
              disabled={busy}
              label="Upload SVG"
              onPick={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setBusy(true);
                  const text = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ''));
                    reader.onerror = () => reject(new Error('Failed to read file'));
                    reader.readAsText(file, 'utf-8');
                  });
                  const trimmed = text.trim();
                  if (!/^\s*<\s*svg[\s>]/i.test(trimmed)) throw new Error('Selected file is not an SVG');
                  setFSvg(trimmed);
                  setEditFloor(prev => ({ ...prev, __createFile__: { name: file.name } }));
                } catch (err) {
                  setError(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            />
            <button className="auth-submit-btn" disabled={busy || !fName || !fSvg || !fBuildingId} onClick={() => onCreateFloor(fName, fSvg, fBuildingId)}>Add</button>
          </div>

          {editFloor.__createFile__?.name && (
            <div className="ft-badge">Loaded: {editFloor.__createFile__.name}</div>
          )}

          {/* List + edit */}
          {floorsSorted.map(f => {
            const id = f?.id;
            const editing = id && floorEditMap[id];

            return (
              <div key={id} className="ft-stat-card ft-card-spaced" style={{ alignItems: 'flex-start' }}>
                {editing ? (
                  <div className="ft-edit-grid" style={{ width: '100%' }}>
                    <div className="ft-edit-row">
                      <input
                        className="auth-input"
                        value={editing.name ?? f.name ?? ''}
                        onChange={e => setFloorEditField(id, { name: e.target.value })}
                        placeholder="Floor name"
                      />
                      <div className="ft-actions">
                        <button
                          className="auth-submit-btn"
                          disabled={busy}
                          onClick={() => {
                            const payload = floorEditMap[id] || {};
                            const body = {};
                            if (payload.name != null) body.name = payload.name;
                            if (payload.svgMap != null) body.svgMap = payload.svgMap;
                            setBusy(true);
                            api(`/api/admin/floors/${id}`, { method: 'PUT', body: JSON.stringify(body) })
                              .then(() => {
                                setFloorEditMap(prev => { const p = { ...prev }; delete p[id]; return p; });
                                return reload();
                              })
                              .catch(e => setError(e.message))
                              .finally(() => setBusy(false));
                          }}
                        >
                          Save
                        </button>
                        <button
                          className="auth-submit-btn"
                          disabled={busy}
                          onClick={() => setFloorEditMap(prev => { const p = { ...prev }; delete p[id]; return p; })}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                    <div className="ft-svg-block">
                      <div className="ft-legend-sub">SVG map (Raw SVG)</div>

                      <textarea
                        className="auth-input ft-textarea"
                        value={editing.svgMap ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          setFloorEditField(id, { svgMap: val });
                          debouncedSetFloorSvg(id, val);
                        }}
                        placeholder="<svg ...>...</svg>"
                      />

                      <div className="ft-row gap" style={{ marginTop: 8 }}>
                        <FilePicker
                          disabled={busy}
                          label="Replace with file"
                          onPick={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              setBusy(true);
                              const text = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => resolve(String(reader.result || ''));
                                reader.onerror = () => reject(new Error('Failed to read file'));
                                reader.readAsText(file, 'utf-8');
                              });
                              const trimmed = text.trim();
                              if (!/^\s*<\s*svg[\s>]/i.test(trimmed)) throw new Error('Selected file is not an SVG');
                              setFloorEditField(id, { svgMap: trimmed, __fileName: file.name, __error: null });
                            } catch (err) {
                              setFloorEditField(id, { __error: err.message });
                            } finally {
                              setBusy(false);
                            }
                          }}
                        />
                        {editing.__fileName && <div className="ft-badge">Loaded: {editing.__fileName}</div>}
                        {editing.__error && <div className="ft-badge" style={{ color: '#FCA5A5', borderColor: '#512', background: '#200' }}>{editing.__error}</div>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="ft-row between" style={{ width: '100%' }}>
                    <div>
                      <div className="ft-title-line">{f?.name || '(unnamed)'} — {f?.buildingName || `B#${f?.buildingId}`} (#{id})</div>
                      <div className="ft-legend-sub">Click Edit to view and modify the SVG map</div>
                    </div>
                    <div className="ft-actions">
                      <button className="auth-submit-btn" disabled={busy} onClick={() => beginEditFloor(f)}>Edit</button>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => onDelete('floors', id)}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* APs */}
      {tab === 'aps' && (
        <div className="ft-panel">
          <div className="ft-panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div className="ft-panel-title">Access Points</div>
              <div className="ft-panel-sub">Create, edit, or delete APs</div>
            </div>
            <SortBar
              fields={[
                { value: 'buildingId', label: 'Building ID' },
                { value: 'floorId', label: 'Floor ID' },
                { value: 'name', label: 'AP name' },
                { value: 'id', label: 'AP ID' },
                { value: 'cx', label: 'cx' },
                { value: 'cy', label: 'cy' },
              ]}
              value={sortAPs.field}
              order={sortAPs.order}
              onField={v => setSortAPs(s => ({ ...s, field: v }))}
              onOrder={v => setSortAPs(s => ({ ...s, order: v }))}
            />
          </div>

          {/* Create */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 1fr auto', gap: 8, marginBottom: 12 }}>
            <input className="auth-input" placeholder="AP name" value={apName} onChange={e => setApName(e.target.value)} />
            <input className="auth-input" placeholder="cx" value={apCx} onChange={e => setApCx(e.target.value)} />
            <input className="auth-input" placeholder="cy" value={apCy} onChange={e => setApCy(e.target.value)} />
            <select className="auth-input" value={apFloorId} onChange={e => setApFloorId(e.target.value)}>
              <option value="">Select floor</option>
              {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button className="auth-submit-btn" disabled={busy || !apName || !apCx || !apCy || !apFloorId} onClick={() => onCreateAP(apName, apCx, apCy, apFloorId)}>Add</button>
          </div>

          {/* List + edit */}
          {apsSorted.map(a => {
            const editing = editAP[a.id] || null;
            return (
              <div key={a.id} className="ft-stat-card" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                {editing ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px auto', gap: 8, alignItems: 'center', width: '100%' }}>
                    <input className="auth-input" value={editing.name ?? a.name} onChange={e => setEditAP(prev => ({ ...prev, [a.id]: { ...editing, name: e.target.value } }))} />
                    <input className="auth-input" placeholder="cx" value={editing.cx ?? a.cx} onChange={e => setEditAP(prev => ({ ...prev, [a.id]: { ...editing, cx: e.target.value } }))} />
                    <input className="auth-input" placeholder="cy" value={editing.cy ?? a.cy} onChange={e => setEditAP(prev => ({ ...prev, [a.id]: { ...editing, cy: e.target.value } }))} />
                    <div className="ft-actions" style={{ marginLeft: 'auto' }}>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => saveAP(a.id)}>Save</button>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => setEditAP(prev => { const p = { ...prev }; delete p[a.id]; return p; })}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>{a.name} — Floor #{a.floorId} (#{a.id})</div>
                    <div className="ft-actions">
                      <button className="auth-submit-btn" disabled={busy} onClick={() => setEditAP(prev => ({ ...prev, [a.id]: { name: a.name, cx: a.cx, cy: a.cy } }))}>Edit</button>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => onDelete('aps', a.id)}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Devices */}
      {tab === 'devices' && (
        <div className="ft-panel">
          <div className="ft-panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div className="ft-panel-title">Devices</div>
              <div className="ft-panel-sub">Attach devices (clients) to APs</div>
            </div>
            <SortBar
              fields={[
                { value: 'apId', label: 'AP ID' },
                { value: 'floorId', label: 'Floor ID' },
                { value: 'mac', label: 'MAC' },
                { value: 'id', label: 'Device ID' },
              ]}
              value={sortDevices.field}
              order={sortDevices.order}
              onField={v => setSortDevices(s => ({ ...s, field: v }))}
              onOrder={v => setSortDevices(s => ({ ...s, order: v }))}
            />
          </div>

          {/* Create */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 12 }}>
            <input className="auth-input" placeholder="MAC address" value={devMac} onChange={e => setDevMac(e.target.value)} />
            <select className="auth-input" value={devApId} onChange={e => setDevApId(e.target.value)}>
              <option value="">Select AP</option>
              {aps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button className="auth-submit-btn" disabled={busy || !devMac || !devApId} onClick={() => onCreateDevice(devMac, devApId)}>Add</button>
          </div>

          {/* List + edit */}
          {devicesSorted.map(d => {
            const editing = editDevice[d.id] || null;
            return (
              <div key={d.id} className="ft-stat-card" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                {editing ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center', width: '100%' }}>
                    <input className="auth-input" placeholder="MAC" value={editing.mac ?? d.mac} onChange={e => setEditDevice(prev => ({ ...prev, [d.id]: { ...editing, mac: e.target.value } }))} />
                    <select className="auth-input" value={editing.apId ?? d.apId} onChange={e => setEditDevice(prev => ({ ...prev, [d.id]: { ...editing, apId: e.target.value } }))}>
                      <option value="">Select AP</option>
                      {aps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <div className="ft-actions" style={{ marginLeft: 'auto' }}>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => saveDevice(d.id)}>Save</button>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => setEditDevice(prev => { const p = { ...prev }; delete p[d.id]; return p; })}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>{d.mac} — AP #{d.apId} (#{d.id})</div>
                    <div className="ft-actions">
                      <button className="auth-submit-btn" disabled={busy} onClick={() => setEditDevice(prev => ({ ...prev, [d.id]: { mac: d.mac, apId: d.apId } }))}>Edit</button>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => onDelete('devices', d.id)}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Groups */}
      {tab === 'groups' && (
        <div className="ft-panel">
          <div className="ft-panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div className="ft-panel-title">Groups</div>
              <div className="ft-panel-sub">Create, edit, or delete groups</div>
            </div>
            <SortBar
              fields={[
                { value: 'name', label: 'Name' },
                { value: 'id', label: 'ID' },
              ]}
              value={sortGroups.field}
              order={sortGroups.order}
              onField={v => setSortGroups(s => ({ ...s, field: v }))}
              onOrder={v => setSortGroups(s => ({ ...s, order: v }))}
            />
          </div>

          {/* Create */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input className="auth-input" placeholder="Group name" value={grpName} onChange={e => setGrpName(e.target.value)} />
            <button className="auth-submit-btn" disabled={busy || !grpName} onClick={() => onCreateGroup(grpName)}>Add</button>
          </div>

          {/* List + edit */}
          {groupsSorted.map(g => {
            const editing = editGroup[g.id] || null;
            return (
              <div key={g.id} className="ft-stat-card" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                {editing ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                    <input className="auth-input" value={editing.name ?? g.name}
                      onChange={e => setEditGroup(prev => ({ ...prev, [g.id]: { ...editing, name: e.target.value } }))} />
                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => saveGroup(g.id)}>Save</button>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => setEditGroup(prev => { const p = { ...prev }; delete p[g.id]; return p; })}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>{g.name} (#{g.id})</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => setEditGroup(prev => ({ ...prev, [g.id]: { name: g.name } }))}>Edit</button>
                      <button className="auth-submit-btn" disabled={busy} onClick={() => onDeleteGroup(g.id)}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* GlobalPermissions */}
      {tab === 'globalPermissions' && (
        <div className="ft-panel">
          <div className="ft-panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div className="ft-panel-title">Global Permissions</div>
              <div className="ft-panel-sub">Map a Group to Building and Floor</div>
            </div>
            <SortBar
              fields={[
                { value: 'groupName', label: 'Group name' },
                { value: 'buildingName', label: 'Building name' },
                { value: 'floorName', label: 'Floor name' },
                { value: 'groupId', label: 'Group ID' },
                { value: 'buildingId', label: 'Building ID' },
                { value: 'floorId', label: 'Floor ID' },
                { value: 'id', label: 'Record ID' },
              ]}
              value={sortGlobalPerms.field}
              order={sortGlobalPerms.order}
              onField={v => setSortGlobalPerms(s => ({ ...s, field: v }))}
              onOrder={v => setSortGlobalPerms(s => ({ ...s, order: v }))}
            />
          </div>

          {/* Create */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 12 }}>
            <select className="auth-input" value={gpGroupId} onChange={e => setGpGroupId(e.target.value)}>
              <option value="">Select group</option>
              {groupsForDropdown.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>

            <select className="auth-input" value={gpBuildingId} onChange={e => setGpBuildingId(e.target.value)}>
              <option value="">Select building</option>
              {buildingsForDropdown.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>

            <select className="auth-input" value={gpFloorId} onChange={e => setGpFloorId(e.target.value)}>
              <option value="">Select floor</option>
              {floorsShown.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>

            <button
              className="auth-submit-btn"
              disabled={busy || !gpGroupId || !gpBuildingId || !gpFloorId}
              onClick={() => onCreateGlobalPermission(gpGroupId, gpBuildingId, gpFloorId)}
            >
              Add
            </button>
          </div>

          {/* List */}
          {globalPermsForDisplay.map(rec => (
            <div key={rec.id} className="ft-stat-card" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="ft-title-line">
                  Group: {rec.groupName || `G#${rec.groupId}`} • Building: {rec.buildingName || `B#${rec.buildingId}`} • Floor: {rec.floorName || `F#${rec.floorId}`}
                </div>
                <div className="ft-legend-sub">Record #{rec.id}</div>
              </div>
              <div className="ft-actions">
                <button className="auth-submit-btn" disabled={busy} onClick={() => onDeleteGlobalPermission(rec.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Users */}
      {tab === 'pendingUsers' && (
        <div className="ft-panel">
          <div className="ft-panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div className="ft-panel-title">Pending Users</div>
              <div className="ft-panel-sub">Owners can assign role and groups to new users</div>
            </div>
            <SortBar
              fields={[
                { value: 'email', label: 'Email' },
                { value: 'id', label: 'User ID' },
                { value: 'createdAt', label: 'Created At' },
              ]}
              value={sortPending.field}
              order={sortPending.order}
              onField={v => setSortPending(s => ({ ...s, field: v }))}
              onOrder={v => setSortPending(s => ({ ...s, order: v }))}
            />
          </div>

          {pendingSorted.length === 0 && <div className="ft-legend-sub">No pending users.</div>}

          {pendingSorted.map(u => {
            const cur = assignPending[u.id] || {};
            const selectedGroupIds = cur.groupIds ?? [];

            return (
              <div key={u.id} className="ft-stat-card" style={{ alignItems: 'stretch', gap: 12 }}>
                <div style={{ display: 'grid', gap: 4, flex: 1 }}>
                  <div className="ft-title-line">
                    {u.email} (#{u.id})
                  </div>
                  <div className="ft-legend-sub">
                    Signed up: {u.createdAt ? new Date(u.createdAt).toLocaleString() : '-'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center', flex: 2 }}>
                  {/* Role dropdown */}
                  <div style={{ display: 'grid', gap: 4 }}>
                    <label className="ft-floor-label">Role</label>
                    <select
                      className="auth-input"
                      value={cur.roleId ?? ''}
                      onChange={e => setAssignPending(prev => ({ ...prev, [u.id]: { ...cur, roleId: e.target.value } }))}
                    >
                      <option value="">Select role</option>
                      {roles
                        .filter(r => r.name !== 'Pending User')
                        .map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                  </div>

                  {/* Groups multi-select */}
                  <div style={{ display: 'grid', gap: 4 }}>
                    <label className="ft-floor-label">Groups</label>
                    <select
                      multiple
                      className="auth-input"
                      value={selectedGroupIds}
                      onChange={e => {
                        const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                        setAssignPending(prev => ({ ...prev, [u.id]: { ...cur, groupIds: selected } }));
                      }}
                      style={{ minHeight: 140 }}
                    >
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <div className="ft-legend-sub" style={{ marginTop: 4 }}>
                      Hold Ctrl (Windows) or Cmd (Mac) to select multiple items.
                    </div>

                    {/* Selected group badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {selectedGroupIds.length === 0 && (
                        <span className="ft-legend-sub">No groups selected</span>
                      )}
                      {selectedGroupIds.map(id => {
                        const g = groups.find(x => String(x.id) === String(id));
                        return (
                          <span key={id} className="ft-badge">
                            {g?.name || `Group #${id}`}
                          </span>
                        );
                      })}
                    </div>

                    {/* Clear button */}
                    <div style={{ marginTop: 6 }}>
                      <button
                        className="auth-submit-btn"
                        disabled={busy || selectedGroupIds.length === 0}
                        onClick={() => setAssignPending(prev => ({ ...prev, [u.id]: { ...cur, groupIds: [] } }))}
                      >
                        Clear selected groups
                      </button>
                    </div>
                  </div>

                  {/* Assign */}
                  <div style={{ display: 'grid', alignContent: 'end' }}>
                    <button
                      className="auth-submit-btn"
                      disabled={busy || !cur.roleId || selectedGroupIds.length === 0}
                      onClick={() => assignUserRoleAndGroup(u.id)}
                    >
                      Assign
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

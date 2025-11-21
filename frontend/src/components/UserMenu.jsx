// import React, { useEffect, useRef, useState } from 'react';

// export default function UserMenu({ onLogout, canSeeAdmin = true, email, name }) {
//   const [open, setOpen] = useState(false);
//   const btnRef = useRef(null);
//   const menuRef = useRef(null);

//   useEffect(() => {
//     const onDocClick = (e) => {
//       if (!open) return;
//       if (
//         menuRef.current && !menuRef.current.contains(e.target) &&
//         btnRef.current && !btnRef.current.contains(e.target)
//       ) {
//         setOpen(false);
//       }
//     };
//     const onEsc = (e) => e.key === 'Escape' && setOpen(false);
//     document.addEventListener('mousedown', onDocClick);
//     document.addEventListener('keydown', onEsc);
//     return () => {
//       document.removeEventListener('mousedown', onDocClick);
//       document.removeEventListener('keydown', onEsc);
//     };
//   }, [open]);

//   const displayName = name || (email ? email.split('@')[0] : 'User');
//   const initials = displayName?.slice(0, 2).toUpperCase();

//   return (
//     <div style={{ position: 'relative' }}>
//       <button
//         ref={btnRef}
//         className="ft-live-btn"
//         aria-haspopup="menu"
//         aria-expanded={open}
//         onClick={() => setOpen(v => !v)}
//         style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
//       >
//         <span className="ft-avatar">{initials}</span>
//         <span className="ft-user-label" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
//           {displayName}
//         </span>
//         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.8 }}>
//           <path d="M7 10l5 5 5-5" stroke="#CDE8FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
//         </svg>
//       </button>

//       {open && (
//         <div
//           ref={menuRef}
//           role="menu"
//           className="ft-user-menu"
//           style={{
//             position: 'absolute',
//             right: 0,
//             marginTop: 8,
//             width: 220,
//             background: '#0F141C',
//             border: '1px solid #1F2937',
//             borderRadius: 10,
//             boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
//             padding: 8,
//             zIndex: 30,
//           }}
//         >
//           <div className="ft-user-menu-header" style={{ padding: '8px 10px', borderBottom: '1px solid #1F2937', marginBottom: 6 }}>
//             <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
//               <span className="ft-avatar" style={{ width: 28, height: 28, fontSize: 12 }}>{initials}</span>
//               <div style={{ display: 'grid' }}>
//                 <div style={{ fontWeight: 700, fontSize: 13 }}>{displayName}</div>
//                 <div style={{ fontSize: 11, color: '#8CA0B3' }}>{email}</div>
//               </div>
//             </div>
//           </div>

//           <a href="/profile" role="menuitem" className="ft-user-menu-item">Profile</a>
//           {canSeeAdmin && <a href="/admin" role="menuitem" className="ft-user-menu-item">Admin Dashboard</a>}
//           <button role="menuitem" className="ft-user-menu-item danger" onClick={onLogout}>Log out</button>
//         </div>
//       )}
//     </div>
//   );
// }
// src/components/UserMenu.jsx
import React, { useEffect, useRef, useState } from 'react';

export default function UserMenu({
  onLogout,
  canSeeAdmin = true,
  email,
  name,
  currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
}) {
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

  const displayName = name || (email ? email.split('@')[0] : 'User');
  const initials = displayName?.slice(0, 2).toUpperCase();

  const isOn = (path) => String(currentPath || '').toLowerCase() === String(path).toLowerCase();

  // Target paths
  const profileHref = '/profile';
  const adminHref = '/admin';
  const dashboardHref = '/home';

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        className="ft-live-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
      >
        <span className="ft-avatar">{initials}</span>
        <span
          className="ft-user-label"
          style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {displayName}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.8 }}>
          <path d="M7 10l5 5 5-5" stroke="#CDE8FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="ft-user-menu"
          style={{
            position: 'absolute',
            right: 0,
            marginTop: 8,
            width: 220,
            background: '#0F141C',
            border: '1px solid #1F2937',
            borderRadius: 10,
            boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
            padding: 8,
            zIndex: 30,
          }}
        >
          <div
            className="ft-user-menu-header"
            style={{ padding: '8px 10px', borderBottom: '1px solid #1F2937', marginBottom: 6 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="ft-avatar" style={{ width: 28, height: 28, fontSize: 12 }}>{initials}</span>
              <div style={{ display: 'grid' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{displayName}</div>
                <div style={{ fontSize: 11, color: '#8CA0B3' }}>{email}</div>
              </div>
            </div>
          </div>

          {/* Hide link if we are already on that page */}
          {!isOn(profileHref) && (
            <a href={profileHref} role="menuitem" className="ft-user-menu-item">Profile</a>
          )}

          {!isOn(dashboardHref) && (
            <a href={dashboardHref} role="menuitem" className="ft-user-menu-item">Floor Dashboard</a>
          )}

          {canSeeAdmin && !isOn(adminHref) && (
            <a href={adminHref} role="menuitem" className="ft-user-menu-item">Admin Dashboard</a>
          )}

          <button role="menuitem" className="ft-user-menu-item danger" onClick={onLogout}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Stylized Medieval Fantasy Vector SVG Icons for Eldoria Idle
 * Replaces all emojis with authentic, crisp, responsive RPG vector icons.
 */

export const ICONS: Record<string, string> = {
  // === Currencies & Core Resources ===
  gold: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="goldGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#fff1aa"/>
          <stop offset="45%" stop-color="#e5b338"/>
          <stop offset="90%" stop-color="#9a6e12"/>
          <stop offset="100%" stop-color="#593e04"/>
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="9.5" fill="url(#goldGrad)" stroke="#fcd462" stroke-width="1"/>
      <circle cx="12" cy="12" r="7" fill="none" stroke="#7a5509" stroke-width="0.8" stroke-dasharray="1.5 1"/>
      <path d="M12 7.5v9M9.5 9.5h3.8a1.6 1.6 0 0 1 0 3.2H10.5a1.6 1.6 0 0 0 0 3.2h4" stroke="#463104" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
  `,

  gems: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#a5f3fc"/>
          <stop offset="40%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#0369a1"/>
        </linearGradient>
      </defs>
      <polygon points="6,4 18,4 22,10 12,21 2,10" fill="url(#gemGrad)" stroke="#7dd3fc" stroke-width="1"/>
      <polygon points="6,4 18,4 15,10 9,10" fill="#bae6fd" opacity="0.6"/>
      <polygon points="9,10 15,10 12,21" fill="#0284c7" opacity="0.7"/>
      <line x1="6" y1="4" x2="9" y2="10" stroke="#bae6fd" stroke-width="0.8"/>
      <line x1="18" y1="4" x2="15" y2="10" stroke="#bae6fd" stroke-width="0.8"/>
      <line x1="2" y1="10" x2="9" y2="10" stroke="#0284c7" stroke-width="0.8"/>
      <line x1="22" y1="10" x2="15" y2="10" stroke="#0284c7" stroke-width="0.8"/>
      <line x1="2" y1="10" x2="12" y2="21" stroke="#38bdf8" stroke-width="0.8"/>
      <line x1="22" y1="10" x2="12" y2="21" stroke="#38bdf8" stroke-width="0.8"/>
    </svg>
  `,

  anima: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="animaGrad" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stop-color="#f0abfc"/>
          <stop offset="50%" stop-color="#c084fc"/>
          <stop offset="100%" stop-color="#6b21a8"/>
        </linearGradient>
      </defs>
      <polygon points="12,2 17,9 12,22 7,9" fill="url(#animaGrad)" stroke="#e879f9" stroke-width="1"/>
      <polygon points="12,2 17,9 12,14" fill="#fae8ff" opacity="0.6"/>
      <polygon points="12,2 7,9 12,14" fill="#a855f7" opacity="0.5"/>
      <polygon points="12,14 17,9 12,22" fill="#7e22ce" opacity="0.7"/>
      <circle cx="12" cy="10" r="1.5" fill="#ffffff" opacity="0.9"/>
      <circle cx="5" cy="14" r="1" fill="#e879f9" opacity="0.7"/>
      <circle cx="19" cy="8" r="0.8" fill="#f0abfc" opacity="0.8"/>
    </svg>
  `,

  // === Navigation Tabs ===
  skills: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="1.8"/>
      <path d="M9 7h7M9 11h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="16.5" cy="15.5" r="2" fill="currentColor"/>
    </svg>
  `,

  inventory: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9V7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2" stroke="currentColor" stroke-width="1.8"/>
      <path d="M4 9h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="1.8"/>
      <path d="M2 13h20" stroke="currentColor" stroke-width="1.4"/>
      <rect x="10" y="11" width="4" height="4" rx="1" fill="currentColor"/>
      <path d="M7 13v7M17 13v7" stroke="currentColor" stroke-width="1.4"/>
    </svg>
  `,

  equipment: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l8 3.5v6.5c0 5.5-3.5 10-8 12-4.5-2-8-6.5-8-12V5.5L12 2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M12 6v12M8 10h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
  `,

  chat: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="8" cy="10" r="1" fill="currentColor"/>
      <circle cx="12" cy="10" r="1" fill="currentColor"/>
      <circle cx="16" cy="10" r="1" fill="currentColor"/>
    </svg>
  `,

  boss: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l3 5 5 1-4 4 1 6-5-3-5 3 1-6-4-4 5-1 3-5z" fill="#dc2626" stroke="#fca5a5" stroke-width="1.2" stroke-linejoin="round"/>
      <circle cx="9.5" cy="11.5" r="1" fill="#fff"/>
      <circle cx="14.5" cy="11.5" r="1" fill="#fff"/>
    </svg>
  `,

  speed: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
  `,

  mount: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 20h14M7 16l1-5 4-4 4 2 2 4-2 3H7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="14" cy="9" r="1" fill="currentColor"/>
      <path d="M12 7l1-3h3l-1 3" stroke="currentColor" stroke-width="1.4"/>
    </svg>
  `,

  heart: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#ef4444" stroke="#f87171" stroke-width="1"/>
    </svg>
  `,

  stop: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/>
    </svg>
  `,

  hearth: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 10.5L12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-9z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M9 21v-7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7" stroke="currentColor" stroke-width="1.8"/>
      <path d="M12 15c.5-1 1.5-1.5 1.5-2.5a1.5 1.5 0 0 0-3 0c0 1 1 1.5 1.5 2.5z" fill="#f59e0b"/>
    </svg>
  `,

  storage: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="currentColor" stroke-width="1.8"/>
      <path d="M2 7l2-3h16l2 3" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M3 12h18" stroke="currentColor" stroke-width="1.4"/>
      <rect x="10" y="10" width="4" height="4" rx="1" fill="#fcd462" stroke="currentColor" stroke-width="1.2"/>
    </svg>
  `,

  lock: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/>
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="1.8"/>
      <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
    </svg>
  `,

  check: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 6L9 17l-5-5" stroke="#48bb78" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  close: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `,

  // === All 16 Skills ===
  mining: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.5 3.5c3.5 1 5.5 3.5 6 6-2-.5-4.5-.5-7-1.5l1.5-3 2-1z" fill="currentColor" opacity="0.3"/>
      <path d="M4 20l10-10M14 10l3.5-3.5M3 13c1.5-3 5-6 9-7 0 2.5-1 6-3 8-1 1-3.5 1.5-6-1z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M15 4l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  `,

  woodcutting: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 19L17 7M15 5l4 4M14 4c2.5 0 6 1.5 6 5-1 1-3 1.5-5 1l-1-6z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M15 9l-3 3M4 20l2-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  `,

  fishing: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 3v8a4 4 0 0 1-4 4H9a3 3 0 0 1-3-3v-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M6 11l-2 2 2 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M13 19c2-1 5-1 7 1-2 2-5 2-7-1z" fill="currentColor"/>
    </svg>
  `,

  herbalism: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22V12M12 12c0-5 4-8 8-8 0 4-3 8-8 8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M12 15c0-4-3-6-6-6 0 3 2 6 6 6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>
  `,

  thieving: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 11a8 8 0 0 1 16 0v2H4v-2z" stroke="currentColor" stroke-width="1.8"/>
      <path d="M9 15h6M7 18h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="9" cy="11" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="11" r="1.5" fill="currentColor"/>
    </svg>
  `,

  smithing: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 10h18l-3 4H6l-3-4zM5 14v4h14v-4" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M11 4l2-2 3 3-2 2-3-3zM13 5l-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
  `,

  cooking: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 11h16c0 5-3.5 9-8 9s-8-4-8-9z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M2 11h20M9 4v4M12 3v5M15 4v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  `,

  fletching: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 5L5 19M19 5l-5 1 4 4 1-5zM5 19l1-4 3 3-4 1z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M14 10l-4 4" stroke="currentColor" stroke-width="1.6"/>
    </svg>
  `,

  alchemy: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 3h6M10 3v5l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="10" cy="16" r="1" fill="currentColor"/>
      <circle cx="14" cy="15" r="1.5" fill="currentColor"/>
    </svg>
  `,

  crafting: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="12,2 21,9 12,22 3,9" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.4"/>
      <line x1="12" y1="2" x2="8" y2="9" stroke="currentColor" stroke-width="1.2"/>
      <line x1="12" y1="2" x2="16" y2="9" stroke="currentColor" stroke-width="1.2"/>
      <line x1="12" y1="22" x2="8" y2="9" stroke="currentColor" stroke-width="1.2"/>
      <line x1="12" y1="22" x2="16" y2="9" stroke="currentColor" stroke-width="1.2"/>
    </svg>
  `,

  attunement: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/>
      <polygon points="12,4 19,16 5,16" stroke="currentColor" stroke-width="1.6"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </svg>
  `,

  melee: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 5l-3 3-8-8-3 3 8 8-3 3 2 2 3-3 3 3 2-2-3-3 3-3 2 2 2-2-2-2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M5 19l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `,

  ranged: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
      <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.4"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
  `,

  magic: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" fill="currentColor" opacity="0.8"/>
      <path d="M19 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM5 4l.8 1.6L7.4 6.4 5.8 7.2 5 8.8 4.2 7.2 2.6 6.4 4.2 5.6 5 4z" fill="currentColor"/>
    </svg>
  `,

  defence: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3l7 3v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M12 6v13M8 10h8" stroke="currentColor" stroke-width="1.4"/>
    </svg>
  `,

  hitpoints: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="#ef4444" stroke-width="1.8" fill="#ef4444" opacity="0.3" stroke-linejoin="round"/>
      <path d="M9 11h6M12 8v6" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `,

  logo: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l7 3.5v6.5c0 5.5-3.5 10-7 11-3.5-1-7-5.5-7-11V5.5L12 2z" fill="#1e180d" stroke="#e5b338" stroke-width="1.6"/>
      <path d="M12 5l-4 7h8l-4-7zM12 12v6" stroke="#e5b338" stroke-width="1.4" stroke-linejoin="round"/>
    </svg>
  `,

  admin: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" fill="#ffd466" stroke="#e5a823" stroke-width="1.2" stroke-linejoin="round"/>
      <circle cx="12" cy="17" r="1.5" fill="#c53030"/>
      <circle cx="7" cy="17" r="1.2" fill="#2b6cb0"/>
      <circle cx="17" cy="17" r="1.2" fill="#2b6cb0"/>
    </svg>
  `,

  editor: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  character: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/>
    </svg>
  `,

  npc: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/>
    </svg>
  `,

  quest: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
      <path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    </svg>
  `,

  collision: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/>
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke="currentColor" stroke-width="1.2"/>
    </svg>
  `,

  mapPin: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" stroke-width="1.8"/>
      <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.8"/>
    </svg>
  `,
};

/**
 * Returns clean SVG markup for a requested icon.
 */
export function getIconSvg(name: string, extraClass: string = ''): string {
  const icon = ICONS[name] || ICONS['skills'];
  return `<span class="rpg-icon-wrap rpg-icon-${name} ${extraClass}">${icon.trim()}</span>`;
}

/**
 * Returns crisp, stylized medieval fantasy SVG icon markup for any item by category or ID.
 */
export function getItemIconSvg(itemId: string, category?: string): string {
  const id = itemId.toLowerCase();
  const cat = (category || '').toLowerCase();

  // Ores & Raw Minerals
  if (cat === 'ore' || id.includes('ore') || id.includes('shard')) {
    const isGold = id.includes('solar') || id.includes('pyrite');
    const isBlue = id.includes('azurite') || id.includes('starfall');
    const isDark = id.includes('nether') || id.includes('galena');
    const c1 = isGold ? '#fcd34d' : isBlue ? '#60a5fa' : isDark ? '#6b7280' : '#9ca3af';
    const c2 = isGold ? '#d97706' : isBlue ? '#2563eb' : isDark ? '#1f2937' : '#4b5563';
    return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><polygon points="6,9 12,4 18,7 21,14 16,20 8,19 3,14" fill="${c2}" stroke="${c1}" stroke-width="1.2"/><polygon points="6,9 12,4 13,11 8,13" fill="${c1}" opacity="0.6"/><polygon points="12,4 18,7 15,12 13,11" fill="${c1}" opacity="0.3"/><polygon points="13,11 15,12 21,14 16,20" fill="${c2}" opacity="0.8"/></svg>`;
  }

  // Refined Ingots
  if (cat === 'bar' || id.includes('ingot')) {
    const isGold = id.includes('dawn') || id.includes('aurum');
    const isBlue = id.includes('azurite') || id.includes('astralite');
    const c1 = isGold ? '#fde047' : isBlue ? '#93c5fd' : '#e2e8f0';
    const c2 = isGold ? '#b45309' : isBlue ? '#1d4ed8' : '#64748b';
    return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><polygon points="3,14 7,8 20,8 16,14" fill="${c1}" stroke="#1e293b" stroke-width="0.8"/><polygon points="3,14 16,14 14,19 1,19" fill="${c2}" stroke="#1e293b" stroke-width="0.8"/><polygon points="16,14 20,8 18,13 14,19" fill="${c2}" opacity="0.85" stroke="#1e293b" stroke-width="0.8"/></svg>`;
  }

  // Timbers & Logs
  if (cat === 'log' || id.includes('timber') || id.includes('wood') || id.includes('oak') || id.includes('willow')) {
    const isMagic = id.includes('ghost') || id.includes('starlight');
    const c1 = isMagic ? '#c084fc' : '#b45309';
    const c2 = isMagic ? '#581c87' : '#78350f';
    return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><rect x="3" y="8" width="14" height="8" rx="2" fill="${c1}" stroke="${c2}" stroke-width="1"/><ellipse cx="17" cy="12" rx="3.5" ry="4" fill="${c2}" stroke="${c1}" stroke-width="0.8"/><circle cx="17" cy="12" r="1.5" fill="${c1}" opacity="0.7"/></svg>`;
  }

  // Raw Fish & Crustaceans
  if (cat === 'raw_food' || id.includes('prawn') || id.includes('minnow') || id.includes('trout') || id.includes('salmon') || id.includes('albacore') || id.includes('crustacean') || id.includes('sovereign') || id.includes('mawshark')) {
    return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><path d="M2 12c4-5 12-5 16 0-4 5-12 5-16 0z" fill="#38bdf8" stroke="#0284c7" stroke-width="1"/><polygon points="18,12 22,8 22,16" fill="#0284c7"/><circle cx="6" cy="11" r="1" fill="#0f172a"/><path d="M9 10c1 1 1 3 0 4M12 10c1 1 1 3 0 4" stroke="#0284c7" stroke-width="0.8"/></svg>`;
  }

  // Cooked Provisions & Feasts
  if (cat === 'cooked_food' || id.includes('smoked') || id.includes('crisped') || id.includes('seared') || id.includes('poached') || id.includes('glazed') || id.includes('broiled') || id.includes('roast') || id.includes('feast')) {
    return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><ellipse cx="12" cy="15" rx="9" ry="4" fill="#78350f" stroke="#d97706" stroke-width="1"/><ellipse cx="12" cy="12" rx="6" ry="3.5" fill="#f59e0b"/><path d="M9 7c0-2 1-3 1-3M12 6c0-2 1-3 1-3M15 7c0-2 1-3 1-3" stroke="#fbbf24" stroke-width="1" stroke-linecap="round" opacity="0.8"/></svg>`;
  }

  // Crops & Mushrooms
  if (cat === 'crop' || id.includes('tuber') || id.includes('shroom') || id.includes('radish') || id.includes('mandrake') || id.includes('gourd') || id.includes('pepper')) {
    return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><circle cx="12" cy="14" r="6" fill="#ea580c" stroke="#9a3412" stroke-width="1"/><path d="M12 8V4M10 6l2-2 2 2" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }

  // Seeds & Spores
  if (cat === 'seed' || id.includes('seed') || id.includes('spore') || id.includes('pod')) {
    return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><path d="M5 8h14v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8z" fill="#78350f" stroke="#b45309" stroke-width="1"/><path d="M12 11v5M10 13l2-2 2 2" stroke="#4ade80" stroke-width="1.2" stroke-linecap="round"/></svg>`;
  }

  // Herbs & Reagents
  if (cat === 'herb' || id.includes('leaf') || id.includes('bell') || id.includes('frond')) {
    return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><path d="M12 21V9M12 9c-3 0-6-3-6-6 3 0 6 3 6 6zM12 13c3 0 6-3 6-6-3 0-6 3-6 6z" fill="#4ade80" stroke="#16a34a" stroke-width="1"/></svg>`;
  }

  // Potions & Elixirs
  if (cat === 'potion' || id.includes('draught') || id.includes('phial') || id.includes('elixir') || id.includes('flask')) {
    return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><rect x="10" y="3" width="4" height="3" fill="#d4af37"/><path d="M10 6h4v3l4 6a3 3 0 0 1-2.5 4.5h-7A3 3 0 0 1 6 15l4-6V6z" fill="#9333ea" stroke="#c084fc" stroke-width="1"/><ellipse cx="12" cy="15" rx="3.5" ry="1.5" fill="#f3e8ff" opacity="0.6"/></svg>`;
  }

  // Tools
  if (cat === 'tool' || id.includes('pickaxe') || id.includes('axe') || id.includes('hatchet')) {
    return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><path d="M4 20l11-11M14 8l1-1M16 10l1-1" stroke="#a16207" stroke-width="2" stroke-linecap="round"/><path d="M12 4c4-1 7 1 8 3-2 1-3 4-3 4l-4-4s3-1 4-3z" fill="#38bdf8" stroke="#0284c7" stroke-width="1"/></svg>`;
  }

  // Weapons & Bows
  if (cat === 'weapon' || id.includes('bow') || id.includes('sword') || id.includes('blade')) {
    if (id.includes('bow')) {
      return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><path d="M6 3c8 3 8 15 0 18" stroke="#92400e" stroke-width="2" fill="none"/><line x1="6" y1="3" x2="6" y2="21" stroke="#cbd5e1" stroke-width="0.8"/><line x1="4" y1="12" x2="16" y2="12" stroke="#d97706" stroke-width="1.5"/><polygon points="16,12 13,10 13,14" fill="#d97706"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><path d="M18 3l3 3-10 10-2-1-1-2 10-10z" fill="#e2e8f0" stroke="#64748b" stroke-width="1"/><path d="M6 17l-3 3M7 15l2 2M4 19l1 1" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }

  // Shields & Gear
  if (cat === 'shield' || id.includes('shield')) {
    return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><path d="M12 3l7 3v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.2"/><path d="M12 6v12M8 10h8" stroke="#93c5fd" stroke-width="1"/></svg>`;
  }

  // Relics & Gems
  if (cat === 'relic' || id.includes('gem') || id.includes('anima') || id.includes('scroll') || id.includes('core') || id.includes('scale') || id.includes('ember')) {
    return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><polygon points="12,2 19,8 16,19 8,19 5,8" fill="#ec4899" stroke="#f472b6" stroke-width="1.2"/><polygon points="12,2 19,8 12,13 5,8" fill="#fbcfe8" opacity="0.6"/></svg>`;
  }

  // Monster Trophies & Hides
  if (cat === 'trophy' || id.includes('pelt') || id.includes('hide') || id.includes('talisman') || id.includes('carapace')) {
    return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><path d="M4 6c4-3 12-3 16 0-1 6-4 13-8 15-4-2-7-9-8-15z" fill="#78350f" stroke="#b45309" stroke-width="1"/><circle cx="9" cy="11" r="1.5" fill="#fef08a"/><circle cx="15" cy="11" r="1.5" fill="#fef08a"/></svg>`;
  }

  // Default Pouch
  return `<svg viewBox="0 0 24 24" fill="none" class="dv-slot-svg"><path d="M6 9a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5V9z" fill="#92400e" stroke="#b45309" stroke-width="1"/><path d="M9 5v4M15 5v4" stroke="#fbbf24" stroke-width="1"/></svg>`;
}

// ═══════════════════════════════════════════════════════════════
// Orbin AI v4.6 — Activar cuenta Enterprise
// F12 → Console → pega esto → Enter → F5
// ═══════════════════════════════════════════════════════════════

localStorage.setItem('orbin-user-session', JSON.stringify({
  id:           'DIR-' + Date.now(),
  name:         'Eduardo Ventura',
  email:        'theboy575@gmail.com',
  plan:         'enterprise',
  company_name: 'Marcenaria Orbin Pro',
  isLoggedIn:   true,
}));
localStorage.removeItem('orbin-autosave');
localStorage.removeItem('orbin-autosave-ts');

console.log('%c✅ Cuenta Enterprise activada — theboy575@gmail.com', 'color:#F5A623;font-weight:bold;font-size:14px');
console.log('%c→ F5 para recargar.', 'color:#aaa;font-size:12px');

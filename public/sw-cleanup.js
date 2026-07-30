// Add to main.jsx as an import? No — you said no old code changes.
// Instead, run this once manually from browser console on the blank page:
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister());
});
caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
location.reload();
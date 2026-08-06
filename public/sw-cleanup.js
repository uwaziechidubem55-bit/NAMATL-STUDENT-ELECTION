(async () => {
  console.log("🔄 Starting total reset...");

  try {
    // 1. Unregister all service workers and wait for them to finish
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(async (reg) => {
      // Force immediate unregistration
      const success = await reg.unregister();
      console.log(`[SW] Unregistered: ${reg.scope} -> ${success}`);
    }));

    // 2. Wipe out all Cache Storage keys completely
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map(async (key) => {
      const deleted = await caches.delete(key);
      console.log(`[Cache] Deleted: ${key} -> ${deleted}`);
    }));

    // 3. Clear sessionStorage and localStorage for a true blank state
    localStorage.clear();
    sessionStorage.clear();
    console.log("[Storage] Local and Session storage cleared.");

    // 4. Force a hard reload from the server, bypassing browser cache
    console.log("🚀 Reset complete. Hard reloading...");
    window.location.reload(true); 
  } catch (error) {
    console.error("❌ Reset failed:", error);
    // Fallback reload if something errors out
    window.location.reload();
  }
})();

// ═══════════════════════════════════════ STORAGE NAMESPACE
// Wraps all localStorage read/write operations.
// DEFAULT_EXERCISES is a global defined in the main script before any call to Storage.loadData().
var Storage = (function () {
  function loadData() {
    return {
      exercises:   JSON.parse(localStorage.getItem('il_exercises') || 'null') || DEFAULT_EXERCISES,
      sessions:    JSON.parse(localStorage.getItem('il_sessions')  || '[]'),
      suggestCount:JSON.parse(localStorage.getItem('il_suggests')  || '0'),
      prevBadges:  JSON.parse(localStorage.getItem('il_badges')    || '[]'),
      routines:    JSON.parse(localStorage.getItem('il_routines')  || '[]'),
    };
  }

  function save(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      ilToast('⚠️ Storage full — export a backup in Settings to avoid losing data.');
    }
  }

  // Safe wrapper for direct localStorage string writes (non-JSON)
  function saveRaw(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {
      ilToast('⚠️ Storage full — export a backup in Settings to avoid losing data.');
    }
  }

  return { loadData: loadData, save: save, saveRaw: saveRaw };
}());


/**
 * js/storage.js
 * Central Data Persistence Engine for Assam Primary School Accounts
 */

const StorageEngine = {
  // Prefix to prevent collisions
  PREFIX: 'dhk_school_',

  // Set Item (converts objects to JSON automatically)
  set(key, value) {
    try {
      const fullKey = this.PREFIX + key;
      localStorage.setItem(fullKey, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage write error:', e);
      return false;
    }
  },

  // Get Item (parses JSON automatically with fallback)
  get(key, defaultValue = null) {
    try {
      const fullKey = this.PREFIX + key;
      const data = localStorage.getItem(fullKey);
      return data !== null ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error('Storage read error:', e);
      return defaultValue;
    }
  },

  // Remove Item
  remove(key) {
    try {
      localStorage.removeItem(this.PREFIX + key);
      return true;
    } catch (e) {
      console.error('Storage remove error:', e);
      return false;
    }
  },

  // Export full school dataset (used for Google Drive Backup)
  exportFullBackup() {
    const backup = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.PREFIX)) {
        backup[key] = localStorage.getItem(key);
      }
    }
    return JSON.stringify(backup);
  },

  // Restore full school dataset (used for Google Drive Restore)
  restoreBackup(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      Object.keys(data).forEach(k => {
        if (k.startsWith(this.PREFIX)) {
          localStorage.setItem(k, data[k]);
        }
      });
      return true;
    } catch (e) {
      console.error('Restore failed:', e);
      return false;
    }
  }
};

// Global helper to format currency with two decimals
function formatMoney(amount) {
  const num = parseFloat(amount) || 0;
  return num.toFixed(2);
}

// Global helper to split rupees and paise for the physical register columns
function splitRupeesPaise(amount) {
  if (amount === undefined || amount === null || amount === '' || isNaN(amount)) {
    return { rs: '-', p: '-' };
  }
  const num = parseFloat(amount);
  const parts = num.toFixed(2).split('.');
  return {
    rs: parts[0],
    p: parts[1]
  };
}

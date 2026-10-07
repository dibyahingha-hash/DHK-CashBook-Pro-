/**
 * js/daily.js
 * The Quick Daily Desk
 * Instant attendance logging with auto-Sunday locking
 */

const DailyLogModule = {
  getStorageKey(dateStr) {
    return StorageEngine.PREFIX + 'daily_' + dateStr;
  },

  getMonthData(ym) {
    const records = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(StorageEngine.PREFIX + 'daily_' + ym)) {
        const dateStr = key.replace(StorageEngine.PREFIX + 'daily_', '');
        records[dateStr] = JSON.parse(localStorage.getItem(key));
      }
    }
    return records;
  },

  saveEntry(dateStr, entry) {
    const key = this.getStorageKey(dateStr);
    localStorage.setItem(key, JSON.stringify(entry));
  },

  getEntry(dateStr) {
    const key = this.getStorageKey(dateStr);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  },

  init() {
    const today = new Date().toISOString().substring(0, 10);
    const dateInput = document.getElementById('daily-date');
    if (dateInput) {
      dateInput.value = today;
      this.loadDate();
    }
  },

  loadDate() {
    const dateStr = document.getElementById('daily-date').value;
    if (!dateStr) return;

    const dateObj = new Date(dateStr);
    const isSunday = dateObj.getDay() === 0;

    const record = this.getEntry(dateStr);
    const statusSelect = document.getElementById('daily-status');
    const reasonInput = document.getElementById('daily-reason');
    const lpInput = document.getElementById('daily-lp');
    const upInput = document.getElementById('daily-up');

    if (record) {
      statusSelect.value = record.status;
      reasonInput.value = record.reason || '';
      lpInput.value = record.lp || 0;
      upInput.value = record.up || 0;
    } else {
      if (isSunday) {
        statusSelect.value = 'CLOSED';
        reasonInput.value = 'Sunday';
        lpInput.value = 0;
        upInput.value = 0;
      } else {
        statusSelect.value = 'OPEN';
        reasonInput.value = '';
        lpInput.value = 0;
        upInput.value = 0;
      }
    }

    this.toggleStatus();
  },

  toggleStatus() {
    const status = document.getElementById('daily-status').value;
    const mealFields = document.getElementById('daily-meal-fields');
    const holidayField = document.getElementById('daily-holiday-field');

    if (status === 'OPEN') {
      mealFields.style.display = 'block';
      holidayField.style.display = 'none';
    } else {
      mealFields.style.display = 'none';
      holidayField.style.display = 'block';
    }
  },

  saveCurrentEntry() {
    const dateStr = document.getElementById('daily-date').value;
    const status = document.getElementById('daily-status').value;
    const reason = document.getElementById('daily-reason').value.trim();
    const lp = status === 'OPEN' ? (parseFloat(document.getElementById('daily-lp').value) || 0) : 0;
    const up = status === 'OPEN' ? (parseFloat(document.getElementById('daily-up').value) || 0) : 0;

    const entry = {
      date: dateStr,
      status: status,
      reason: reason,
      lp: lp,
      up: up,
      updatedAt: new Date().toISOString()
    };

    this.saveEntry(dateStr, entry);

    const msg = document.getElementById('daily-save-msg');
    msg.style.color = '#15803d';
    msg.innerText = `✅ Recorded successfully for ${dateStr}!`;
    setTimeout(() => { msg.innerText = ''; }, 3500);
  }
};

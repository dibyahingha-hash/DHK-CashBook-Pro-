/**
 * js/daily.js
 * Daily Attendance Logger & Historical Meal Tracking
 */

const DailyModule = {
  // Key generator: daily_YYYY-MM-DD
  getKey(dateStr) {
    return `daily_${dateStr}`;
  },

  // Save a single day's attendance
  saveEntry(dateStr, data) {
    StorageEngine.set(this.getKey(dateStr), data);
  },

  // Read a single day's attendance
  getEntry(dateStr) {
    return StorageEngine.get(this.getKey(dateStr), null);
  },

  // Delete a day's entry
  deleteEntry(dateStr) {
    StorageEngine.remove(this.getKey(dateStr));
  },

  // Retrieve all entries belonging to a given YYYY-MM
  getMonthEntries(ymStr) {
    const list = [];
    const prefix = StorageEngine.PREFIX + `daily_${ymStr}-`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(prefix)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            list.push(parsed);
          }
        } catch (e) {
          console.error('Error parsing daily entry:', e);
        }
      }
    }
    // Sort chronologically by date
    list.sort((a, b) => a.date.localeCompare(b.date));
    return list;
  },

  // Aggregate monthly totals directly from daily records
  getMonthlyTotals(ymStr) {
    const entries = this.getMonthEntries(ymStr);
    let workingDays = 0;
    let totalLpMeals = 0;
    let totalUpMeals = 0;
    let totalRiceKg = 0;
    let totalCostRs = 0;

    entries.forEach(e => {
      if (e.status === 'OPEN') {
        workingDays++;
        totalLpMeals += e.lp || 0;
        totalUpMeals += e.up || 0;
        totalRiceKg += e.rice || 0;
        totalCostRs += e.cost || 0;
      }
    });

    return {
      workingDays,
      totalLpMeals,
      totalUpMeals,
      totalMeals: totalLpMeals + totalUpMeals,
      totalRiceKg: Number(totalRiceKg.toFixed(3)),
      totalCostRs: Number(totalCostRs.toFixed(2))
    };
  }
};

// UI Handler: When user changes date picker
function onDailyDateChange() {
  const dateInput = document.getElementById('daily-date');
  if (!dateInput.value) return;

  const entry = DailyModule.getEntry(dateInput.value);
  if (entry) {
    document.getElementById('daily-status').value = entry.status;
    document.getElementById('daily-lp').value = entry.lp || 0;
    document.getElementById('daily-up').value = entry.up || 0;
  } else {
    // Default values if no entry exists yet
    document.getElementById('daily-status').value = 'OPEN';
    document.getElementById('daily-lp').value = '';
    document.getElementById('daily-up').value = '';
  }
  toggleDailyStatus();
}

// UI Handler: Toggle visibility of inputs on Sunday/Holiday
function toggleDailyStatus() {
  const status = document.getElementById('daily-status').value;
  const mealInputs = document.getElementById('daily-meal-inputs');
  if (status === 'OPEN') {
    mealInputs.style.display = 'grid';
  } else {
    mealInputs.style.display = 'none';
  }
}

// UI Handler: Save Daily Attendance Form
function saveDailyEntry() {
  const dateStr = document.getElementById('daily-date').value;
  if (!dateStr) {
    alert('Please pick a valid date.');
    return;
  }

  const status = document.getElementById('daily-status').value;
  const profile = ProfileModule.getProfile();

  let lp = 0, up = 0, rice = 0, cost = 0;

  if (status === 'OPEN') {
    lp = parseInt(document.getElementById('daily-lp').value) || 0;
    up = parseInt(document.getElementById('daily-up').value) || 0;

    if (lp === 0 && up === 0) {
      if (!confirm('Meals fed are set to 0. Do you want to record 0 attendance for this working day?')) {
        return;
      }
    }

    // Exact statutory math using configurable profile rates
    rice = Number(((lp * profile.rice_lp) + (up * profile.rice_up)).toFixed(3));
    cost = Number(((lp * profile.rate_lp) + (up * profile.rate_up)).toFixed(2));
  }

  const dailyRecord = {
    date: dateStr,
    status,
    lp,
    up,
    rice,
    cost
  };

  DailyModule.saveEntry(dateStr, dailyRecord);
  renderDailyLogTable();
  alert(`Attendance recorded for ${dateStr}!`);
}

// UI Handler: Delete entry
function removeDailyEntry(dateStr) {
  if (confirm(`Delete attendance record for ${dateStr}?`)) {
    DailyModule.deleteEntry(dateStr);
    renderDailyLogTable();
    onDailyDateChange();
  }
}

// Render the monthly list table below the entry form
function renderDailyLogTable() {
  const ymFilter = document.getElementById('daily-filter-ym').value;
  if (!ymFilter) return;

  const entries = DailyModule.getMonthEntries(ymFilter);
  const tbody = document.getElementById('daily-log-rows');
  tbody.innerHTML = '';

  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#64748b;">No daily entries recorded for ${ymFilter}</td></tr>`;
    return;
  }

  entries.forEach(e => {
    const isHoliday = e.status !== 'OPEN';
    const row = document.createElement('tr');
    if (isHoliday) row.style.background = '#f1f5f9';

    row.innerHTML = `
      <td><b>${e.date}</b></td>
      <td>${e.status === 'OPEN' ? '<span style="color:var(--secondary); font-weight:700;">Open</span>' : `<span style="color:var(--amber);">${e.status}</span>`}</td>
      <td class="num">${isHoliday ? '-' : e.lp}</td>
      <td class="num">${isHoliday ? '-' : e.up}</td>
      <td class="num">${isHoliday ? '-' : e.rice.toFixed(3)}</td>
      <td class="num">${isHoliday ? '-' : e.cost.toFixed(2)}</td>
      <td class="no-print" style="text-align:center;">
        <button class="btn-del" onclick="removeDailyEntry('${e.date}')">×</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Initialize Daily Module
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);

  const dateInput = document.getElementById('daily-date');
  const ymInput = document.getElementById('daily-filter-ym');

  if (dateInput) dateInput.value = today;
  if (ymInput) ymInput.value = thisMonth;

  onDailyDateChange();
  renderDailyLogTable();
});


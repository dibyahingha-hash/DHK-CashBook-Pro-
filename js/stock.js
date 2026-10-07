/**
 * js/stock.js
 * PM POSHAN Monthly Stock Almirah
 * Built-in Missing Days Scanner, Auto-Sunday Exclusion, Quick Holiday Resolver & Rollover
 */

const StockModule = {
  // Statutory Rates Lookup (April 2020 onward)
  getStatutoryRates(ym) {
    if (ym < '2020-04') ym = '2020-04';

    if (ym >= '2025-05') {
      return { lp: 6.78, up: 10.17, label: "May 2025 – Present (LP: ₹6.78, UP: ₹10.17)" };
    } else if (ym >= '2024-12') {
      return { lp: 6.19, up: 9.29, label: "Dec 2024 – Apr 2025 (LP: ₹6.19, UP: ₹9.29)" };
    } else if (ym >= '2022-10') {
      return { lp: 5.45, up: 8.17, label: "Oct 2022 – Nov 2024 (LP: ₹5.45, UP: ₹8.17)" };
    } else {
      return { lp: 4.97, up: 7.45, label: "Apr 2020 – Sep 2022 (LP: ₹4.97, UP: ₹7.45)" };
    }
  },

  getPrevMonth(ym) {
    const [year, month] = ym.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  },

  get(ym) {
    const key = StorageEngine.PREFIX + 'stock_' + ym;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  },

  save(ym, data) {
    const key = StorageEngine.PREFIX + 'stock_' + ym;
    localStorage.setItem(key, JSON.stringify(data));
  }
};

let activeMissingDate = null;

function renderStockView() {
  const container = document.getElementById('view-stock');
  if (!container) return;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = String(now.getMonth() + 1).padStart(2, '0');

  const months = [
    { num: '04', name: 'April' },
    { num: '05', name: 'May' },
    { num: '06', name: 'June' },
    { num: '07', name: 'July' },
    { num: '08', name: 'August' },
    { num: '09', name: 'September' },
    { num: '10', name: 'October' },
    { num: '11', name: 'November' },
    { num: '12', name: 'December' },
    { num: '01', name: 'January' },
    { num: '02', name: 'February' },
    { num: '03', name: 'March' }
  ];

  const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

  let monthOptions = months.map(m => 
    `<option value="${m.num}" ${m.num === currentMonthNum ? 'selected' : ''}>${m.name}</option>`
  ).join('');

  let yearOptions = years.map(y => 
    `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`
  ).join('');

  container.innerHTML = `
    <div class="card no-print">
      <h2 class="card-title">📦 PM POSHAN Stock Almirah</h2>
      
      <!-- Period Selector -->
      <div class="form-group" style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #cbd5e1;">
        <label style="font-weight:bold; color:#1e293b; margin-bottom:6px; display:block;">Select Register Period</label>
        <div style="display:flex; gap:10px;">
          <select id="stk-sel-month" onchange="onPeriodChange()" style="flex:1; font-size:1rem; padding:8px; font-weight:bold;">
            ${monthOptions}
          </select>
          <select id="stk-sel-year" onchange="onPeriodChange()" style="flex:1; font-size:1rem; padding:8px; font-weight:bold;">
            ${yearOptions}
          </select>
        </div>
      </div>

      <div id="rate-badge" style="background:#e0f2fe; color:#0369a1; padding:6px 12px; border-radius:6px; font-size:0.8rem; font-weight:600; margin-bottom:12px;"></div>

      <!-- MISSING DAYS SCANNER & HOLIDAY RESOLVER -->
      <div id="missing-days-panel" style="margin-bottom:16px;"></div>

      <div style="margin-bottom:12px;">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:600;">
          <input type="checkbox" id="stk-auto-calc" checked onchange="toggleAutoCalcDaily()">
          Auto-Calculate Meals from Daily Entries
        </label>
      </div>

      <div class="grid-2 form-group">
        <div>
          <label>Total Working Days</label>
          <input type="number" id="stk-days" min="0" value="0" oninput="calculateStockLive()">
        </div>
        <div>
          <label>LP Meals Fed (Classes 1–5)</label>
          <input type="number" id="stk-meals-lp" min="0" value="0" oninput="calculateStockLive()">
        </div>
      </div>

      <div class="grid-2 form-group">
        <div>
          <label>UP Meals Fed (Classes 6–8)</label>
          <input type="number" id="stk-meals-up" min="0" value="0" oninput="calculateStockLive()">
        </div>
        <div>
          <label>Total Meals Served</label>
          <input type="number" id="stk-meals-total" value="0" readonly style="background:#f1f5f9; font-weight:bold;">
        </div>
      </div>

      <!-- FOOD GRAIN -->
      <h3 class="section-subtitle">Food Grains (Rice in kg)</h3>
      <div class="grid-2 form-group">
        <div>
          <label>Rice Opening Stock (kg) <span style="font-size:0.75rem; color:#64748b;">(Negative allowed if borrowed, e.g. -50)</span></label>
          <input type="number" step="0.001" id="stk-op-rice" value="0" oninput="calculateStockLive()">
          <small id="hint-op-rice" style="color:#0284c7; font-size:0.75rem; display:block;"></small>
        </div>
        <div>
          <label>Rice Received Quantity (kg)</label>
          <input type="number" step="0.001" id="stk-rcvd-rice" value="0" oninput="calculateStockLive()">
        </div>
      </div>
      <div class="grid-2 form-group">
        <div>
          <label>Date of Rice Received</label>
          <input type="date" id="stk-rcvd-rice-date" onchange="calculateStockLive()">
        </div>
        <div>
          <label>Rice Challan / Issue Memo No.</label>
          <input type="text" id="stk-rcvd-rice-memo" placeholder="e.g. Memo-104 / GPSS" oninput="calculateStockLive()">
        </div>
      </div>

      <!-- COOKING COST -->
      <h3 class="section-subtitle">Cooking Cost Account (₹)</h3>
      <div class="grid-2 form-group">
        <div>
          <label>Opening Cooking Cost (₹) <span style="font-size:0.75rem; color:#64748b;">(Negative allowed if deficit, e.g. -3000)</span></label>
          <input type="number" step="0.01" id="stk-op-cost" value="0" oninput="calculateStockLive()">
          <small id="hint-op-cost" style="color:#0284c7; font-size:0.75rem; display:block;"></small>
        </div>
        <div>
          <label>Cooking Cost Grant Received (₹)</label>
          <input type="number" step="0.01" id="stk-rcvd-cost" value="0" oninput="calculateStockLive()">
        </div>
      </div>
      <div class="grid-2 form-group">
        <div>
          <label>Date of Bank Credit</label>
          <input type="date" id="stk-rcvd-cost-date" onchange="calculateStockLive()">
        </div>
        <div>
          <label>Credit Ref / Sanction Order No.</label>
          <input type="text" id="stk-rcvd-cost-memo" placeholder="e.g. SSA/PMP/2026/04" oninput="calculateStockLive()">
        </div>
      </div>

      <!-- SAVE & ROLLOVER BUTTON -->
      <button class="btn btn-secondary" onclick="saveCurrentMonthStock()" style="font-size:1rem; padding:12px; margin-top:10px;">
        💾 Save Month & Rollover Balances
      </button>
      <div id="save-status-msg" style="text-align:center; font-weight:bold; margin-top:6px; min-height:20px;"></div>
    </div>

    <!-- STATUTORY PRINTABLE SHEET -->
    <div class="card" id="stock-printable-card">
      <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom:6px; margin-bottom:12px;">
        <h2 style="margin:0; font-size:1.1rem; text-transform:uppercase;" id="stk-prt-school">ASSAM PRIMARY SCHOOL</h2>
        <div style="font-size:0.85rem;" id="stk-prt-udise">UDISE: 18150301501 | BLOCK: Khowang</div>
        <h3 style="margin:4px 0 0 0; font-size:0.95rem; color:var(--primary);">PM POSHAN (MID-DAY MEAL) MONTHLY STOCK & COST REGISTER</h3>
        <p style="margin:2px 0 0 0; font-size:0.85rem;">Month: <b id="stk-prt-ym"></b></p>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr style="background:#e2e8f0;">
              <th style="width:65%;">Particulars</th>
              <th class="num" style="width:35%;">Quantities / Values</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Total School Working Days in Month</td><td class="num" id="prt-days">0</td></tr>
            <tr><td>Lower Primary (LP) Meals Fed</td><td class="num" id="prt-lp">0</td></tr>
            <tr><td>Upper Primary (UP) Meals Fed</td><td class="num" id="prt-up">0</td></tr>
            <tr style="font-weight:bold; background:#f8fafc;"><td>Total Meals Served</td><td class="num" id="prt-total-meals">0</td></tr>

            <tr style="background:#e2e8f0; font-weight:bold;"><td colspan="2">A. FOOD GRAIN (RICE IN KG)</td></tr>
            <tr><td>1. Opening Stock / Prior Borrowed Deficit (b/f)</td><td class="num" id="prt-op-rice">0.000 kg</td></tr>
            <tr>
              <td>2. Rice Received during Month <br><small id="prt-rice-meta" style="color:#475569;"></small></td>
              <td class="num" id="prt-rcvd-rice">0.000 kg</td>
            </tr>
            <tr style="font-weight:bold;"><td>3. Total Rice Available (1 + 2)</td><td class="num" id="prt-avail-rice">0.000 kg</td></tr>
            <tr><td>4. Rice Consumed in MDM</td><td class="num" id="prt-util-rice">0.000 kg</td></tr>
            <tr style="font-weight:bold; background:#f1f5f9;" id="row-cl-rice">
              <td>5. Net Closing Rice Position (c/f)</td>
              <td class="num" id="prt-cl-rice">0.000 kg</td>
            </tr>

            <tr style="background:#e2e8f0; font-weight:bold;"><td colspan="2">B. COOKING COST ACCOUNT (₹)</td></tr>
            <tr><td>1. Opening Balance / Prior Deficit (b/f)</td><td class="num" id="prt-op-cost">₹ 0.00</td></tr>
            <tr>
              <td>2. Grant Received in Bank <br><small id="prt-cost-meta" style="color:#475569;"></small></td>
              <td class="num" id="prt-rcvd-cost">₹ 0.00</td>
            </tr>
            <tr style="font-weight:bold;"><td>3. Total Available Fund (1 + 2)</td><td class="num" id="prt-avail-cost">₹ 0.00</td></tr>
            <tr>
              <td>4. Cooking Cost Expended <br><small id="prt-rate-info" style="color:#475569;"></small></td>
              <td class="num" id="prt-util-cost">₹ 0.00</td>
            </tr>
            <tr style="font-weight:bold; background:#f1f5f9;" id="row-cl-cost">
              <td>5. Net Closing Position (c/f)</td>
              <td class="num" id="prt-cl-cost">₹ 0.00</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="display:flex; justify-content:space-between; margin-top:35px; font-size:0.8rem;">
        <div>_________________________________<br><b>Signature of Head Teacher</b></div>
        <div style="text-align:right;">_________________________________<br><b>President / Secretary, SMC</b></div>
      </div>
    </div>
  `;

  onPeriodChange();
}

function getSelectedYM() {
  const m = document.getElementById('stk-sel-month').value;
  const y = document.getElementById('stk-sel-year').value;
  return `${y}-${m}`;
}

function onPeriodChange() {
  let ym = getSelectedYM();

  if (ym < '2020-04') {
    alert("Records start from April 2020. Selecting April 2020.");
    document.getElementById('stk-sel-year').value = '2020';
    document.getElementById('stk-sel-month').value = '04';
    ym = '2020-04';
  }

  activeMissingDate = null;
  loadSelectedMonthStock(ym);
}

function loadSelectedMonthStock(ym) {
  if (!ym) ym = getSelectedYM();
  const profile = ProfileModule.getProfile();

  document.getElementById('stk-prt-school').innerText = profile.schoolName || 'ASSAM PRIMARY SCHOOL';
  document.getElementById('stk-prt-udise').innerText = `UDISE: ${profile.udise || 'Not Configured'} | BLOCK: ${profile.block || '-'}`;
  document.getElementById('stk-prt-ym').innerText = ym;

  const rateObj = StockModule.getStatutoryRates(ym);
  document.getElementById('rate-badge').innerText = `Statutory Rates: ${rateObj.label}`;

  scanMonthCalendar(ym);

  const currentRecord = StockModule.get(ym);
  const prevYm = StockModule.getPrevMonth(ym);
  const prevRecord = StockModule.get(prevYm);

  if (currentRecord) {
    document.getElementById('stk-auto-calc').checked = !!currentRecord.autoCalc;
    document.getElementById('stk-days').value = currentRecord.days || 0;
    document.getElementById('stk-meals-lp').value = currentRecord.lpMeals || 0;
    document.getElementById('stk-meals-up').value = currentRecord.upMeals || 0;
    document.getElementById('stk-op-rice').value = currentRecord.opRice ?? 0;
    document.getElementById('stk-rcvd-rice').value = currentRecord.rcvdRice || 0;
    document.getElementById('stk-rcvd-rice-date').value = currentRecord.rcvdRiceDate || '';
    document.getElementById('stk-rcvd-rice-memo').value = currentRecord.rcvdRiceMemo || '';

    document.getElementById('stk-op-cost').value = currentRecord.opCost ?? 0;
    document.getElementById('stk-rcvd-cost').value = currentRecord.rcvdCost || 0;
    document.getElementById('stk-rcvd-cost-date').value = currentRecord.rcvdCostDate || '';
    document.getElementById('stk-rcvd-cost-memo').value = currentRecord.rcvdCostMemo || '';

    document.getElementById('hint-op-rice').innerText = prevRecord ? `(Rolled over from ${prevYm} closing)` : '';
    document.getElementById('hint-op-cost').innerText = prevRecord ? `(Rolled over from ${prevYm} closing)` : '';
  } else {
    if (prevRecord) {
      document.getElementById('stk-op-rice').value = prevRecord.clRice ?? 0;
      document.getElementById('stk-op-cost').value = prevRecord.clCost ?? 0;
      document.getElementById('hint-op-rice').innerText = `✓ Carried forward from ${prevYm} (${prevRecord.clRice} kg)`;
      document.getElementById('hint-op-cost').innerText = `✓ Carried forward from ${prevYm} (₹ ${prevRecord.clCost})`;
    } else {
      document.getElementById('stk-op-rice').value = 0;
      document.getElementById('stk-op-cost').value = 0;
      document.getElementById('hint-op-rice').innerText = '(Starting fresh: enter opening/deficit if any)';
      document.getElementById('hint-op-cost').innerText = '(Starting fresh: enter opening/deficit if any)';
    }

    document.getElementById('stk-days').value = 0;
    document.getElementById('stk-meals-lp').value = 0;
    document.getElementById('stk-meals-up').value = 0;
    document.getElementById('stk-rcvd-rice').value = 0;
    document.getElementById('stk-rcvd-rice-date').value = '';
    document.getElementById('stk-rcvd-rice-memo').value = '';
    document.getElementById('stk-rcvd-cost').value = 0;
    document.getElementById('stk-rcvd-cost-date').value = '';
    document.getElementById('stk-rcvd-cost-memo').value = '';
    document.getElementById('stk-auto-calc').checked = true;
  }

  toggleAutoCalcDaily(false);
  calculateStockLive();
}

// SCANNER: Auto-excludes Sundays and identifies missing days
function scanMonthCalendar(ym) {
  const panel = document.getElementById('missing-days-panel');
  if (!panel) return;

  const [yearStr, monthStr] = ym.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyData = DailyLogModule.getMonthData(ym);

  const todayStr = new Date().toISOString().substring(0, 10);
  const isCurrentMonth = todayStr.startsWith(ym);
  const maxDayToScan = isCurrentMonth ? parseInt(todayStr.split('-')[2], 10) : daysInMonth;

  let missingDays = [];
  let openCount = 0;
  let sundayCount = 0;
  let holidayCount = 0;

  for (let d = 1; d <= maxDayToScan; d++) {
    const dayStr = String(d).padStart(2, '0');
    const fullDate = `${ym}-${dayStr}`;
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay();

    if (dayOfWeek === 0) {
      // Auto-Sunday exclusion
      sundayCount++;
      continue;
    }

    const log = dailyData[fullDate];
    if (!log) {
      missingDays.push({ date: fullDate, day: d });
    } else if (log.status === 'OPEN') {
      openCount++;
    } else {
      holidayCount++;
    }
  }

  let html = `
    <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:10px;">
      <div style="display:flex; justify-content:space-between; flex-wrap:wrap; font-size:0.85rem; color:#475569; margin-bottom:6px;">
        <span><b>📅 Calendar Status:</b> ${openCount} Days Open | ${sundayCount} Sundays (Closed) | ${holidayCount} Holidays</span>
        <span style="font-weight:bold; color:${missingDays.length > 0 ? '#b91c1c' : '#15803d'};">
          ${missingDays.length > 0 ? `⚠️ ${missingDays.length} Missing Days` : '✅ All Days Accounted For'}
        </span>
      </div>
  `;

  if (missingDays.length > 0) {
    html += `
      <div style="font-size:0.8rem; color:#64748b; margin-bottom:6px;">
        Tap any missing day below to enter meals or mark as a holiday:
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        ${missingDays.map(item => `
          <button type="button" onclick="openMissingDayEditor('${item.date}')" style="background:#fee2e2; border:1px solid #f87171; color:#991b1b; padding:4px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; font-weight:600;">
            ${item.date.substring(8)} Missing
          </button>
        `).join('')}
      </div>
    `;
  }

  // Quick Editor Drawer
  if (activeMissingDate) {
    html += `
      <div style="margin-top:10px; background:#f8fafc; border:1px solid #0284c7; padding:10px; border-radius:6px;">
        <div style="font-weight:bold; color:#0369a1; font-size:0.9rem; margin-bottom:8px;">
          Log Entry for: ${activeMissingDate}
        </div>
        <div class="grid-2 form-group" style="margin-bottom:8px;">
          <div>
            <label style="font-size:0.8rem;">LP Meals (Classes 1–5)</label>
            <input type="number" id="quick-lp" min="0" value="0" style="padding:6px;">
          </div>
          <div>
            <label style="font-size:0.8rem;">UP Meals (Classes 6–8)</label>
            <input type="number" id="quick-up" min="0" value="0" style="padding:6px;">
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-secondary" onclick="resolveMissingDay('OPEN')" style="flex:1; padding:8px; font-size:0.85rem;">
            ✓ Save Meals
          </button>
          <button type="button" class="btn" onclick="resolveMissingDay('CLOSED')" style="flex:1; background:#64748b; color:#fff; padding:8px; font-size:0.85rem;">
            🏖️ Mark as Holiday
          </button>
          <button type="button" class="btn" onclick="cancelMissingDayEditor()" style="background:#e2e8f0; color:#334155; padding:8px; font-size:0.85rem;">
            Cancel
          </button>
        </div>
      </div>
    `;
  }

  html += `</div>`;
  panel.innerHTML = html;
}

function openMissingDayEditor(dateStr) {
  activeMissingDate = dateStr;
  scanMonthCalendar(getSelectedYM());
}

function cancelMissingDayEditor() {
  activeMissingDate = null;
  scanMonthCalendar(getSelectedYM());
}

function resolveMissingDay(status) {
  if (!activeMissingDate) return;

  const lp = status === 'OPEN' ? (parseFloat(document.getElementById('quick-lp').value) || 0) : 0;
  const up = status === 'OPEN' ? (parseFloat(document.getElementById('quick-up').value) || 0) : 0;

  const entry = {
    date: activeMissingDate,
    status: status,
    lp: lp,
    up: up,
    reason: status === 'CLOSED' ? 'Holiday / Vacation' : ''
  };

  DailyLogModule.saveEntry(activeMissingDate, entry);

  activeMissingDate = null;
  const ym = getSelectedYM();
  scanMonthCalendar(ym);
  toggleAutoCalcDaily(true);
}

function toggleAutoCalcDaily(recalculate = true) {
  const isAuto = document.getElementById('stk-auto-calc').checked;
  const daysInput = document.getElementById('stk-days');
  const lpInput = document.getElementById('stk-meals-lp');
  const upInput = document.getElementById('stk-meals-up');

  if (isAuto) {
    daysInput.readOnly = true;
    lpInput.readOnly = true;
    upInput.readOnly = true;
    daysInput.style.background = '#f1f5f9';
    lpInput.style.background = '#f1f5f9';
    upInput.style.background = '#f1f5f9';

    const ym = getSelectedYM();
    const dailyData = DailyLogModule.getMonthData(ym);
    let openDays = 0, totLp = 0, totUp = 0;

    Object.values(dailyData).forEach(entry => {
      if (entry.status === 'OPEN') {
        openDays++;
        totLp += parseFloat(entry.lp) || 0;
        totUp += parseFloat(entry.up) || 0;
      }
    });

    daysInput.value = openDays;
    lpInput.value = totLp;
    upInput.value = totUp;
  } else {
    daysInput.readOnly = false;
    lpInput.readOnly = false;
    upInput.readOnly = false;
    daysInput.style.background = '#fff';
    lpInput.style.background = '#fff';
    upInput.style.background = '#fff';
  }

  if (recalculate) calculateStockLive();
}

function calculateStockLive() {
  const ym = getSelectedYM();
  const rates = StockModule.getStatutoryRates(ym);

  const days = parseFloat(document.getElementById('stk-days').value) || 0;
  const lp = parseFloat(document.getElementById('stk-meals-lp').value) || 0;
  const up = parseFloat(document.getElementById('stk-meals-up').value) || 0;
  const totalMeals = lp + up;

  document.getElementById('stk-meals-total').value = totalMeals;
  document.getElementById('prt-days').innerText = days;
  document.getElementById('prt-lp').innerText = lp;
  document.getElementById('prt-up').innerText = up;
  document.getElementById('prt-total-meals').innerText = totalMeals;

  // A. Rice Calculations
  const opRice = parseFloat(document.getElementById('stk-op-rice').value) || 0;
  const rcvdRice = parseFloat(document.getElementById('stk-rcvd-rice').value) || 0;
  const rcvdRiceDate = document.getElementById('stk-rcvd-rice-date').value;
  const rcvdRiceMemo = document.getElementById('stk-rcvd-rice-memo').value;

  const availRice = opRice + rcvdRice;
  const utilRice = (lp * 0.100) + (up * 0.150);
  const clRice = availRice - utilRice;

  document.getElementById('prt-op-rice').innerText = `${opRice.toFixed(3)} kg`;
  document.getElementById('prt-rcvd-rice').innerText = `${rcvdRice.toFixed(3)} kg`;

  let riceMetaText = '';
  if (rcvdRiceDate) riceMetaText += `Date: ${rcvdRiceDate} `;
  if (rcvdRiceMemo) riceMetaText += `(${rcvdRiceMemo})`;
  document.getElementById('prt-rice-meta').innerText = riceMetaText;

  document.getElementById('prt-avail-rice').innerText = `${availRice.toFixed(3)} kg`;
  document.getElementById('prt-util-rice').innerText = `${utilRice.toFixed(3)} kg`;

  const rowClRice = document.getElementById('row-cl-rice');
  const prtClRice = document.getElementById('prt-cl-rice');
  if (clRice < 0) {
    rowClRice.style.color = '#dc2626';
    prtClRice.innerText = `${clRice.toFixed(3)} kg (Deficit / Borrowed)`;
  } else {
    rowClRice.style.color = 'var(--primary)';
    prtClRice.innerText = `${clRice.toFixed(3)} kg (In Stock)`;
  }

  // B. Cooking Cost Calculations
  const opCost = parseFloat(document.getElementById('stk-op-cost').value) || 0;
  const rcvdCost = parseFloat(document.getElementById('stk-rcvd-cost').value) || 0;
  const rcvdCostDate = document.getElementById('stk-rcvd-cost-date').value;
  const rcvdCostMemo = document.getElementById('stk-rcvd-cost-memo').value;

  const availCost = opCost + rcvdCost;
  const utilCost = (lp * rates.lp) + (up * rates.up);
  const clCost = availCost - utilCost;

  document.getElementById('prt-op-cost').innerText = `₹ ${opCost.toFixed(2)}`;
  document.getElementById('prt-rcvd-cost').innerText = `₹ ${rcvdCost.toFixed(2)}`;

  let costMetaText = '';
  if (rcvdCostDate) costMetaText += `Date: ${rcvdCostDate} `;
  if (rcvdCostMemo) costMetaText += `(${rcvdCostMemo})`;
  document.getElementById('prt-cost-meta').innerText = costMetaText;

  document.getElementById('prt-avail-cost').innerText = `₹ ${availCost.toFixed(2)}`;
  document.getElementById('prt-rate-info').innerText = `@ ₹${rates.lp} (LP) / ₹${rates.up} (UP)`;
  document.getElementById('prt-util-cost').innerText = `₹ ${utilCost.toFixed(2)}`;

  const rowClCost = document.getElementById('row-cl-cost');
  const prtClCost = document.getElementById('prt-cl-cost');
  if (clCost < 0) {
    rowClCost.style.color = '#dc2626';
    prtClCost.innerText = `₹ ${clCost.toFixed(2)} (Deficit / Due to HT)`;
  } else {
    rowClCost.style.color = 'var(--primary)';
    prtClCost.innerText = `₹ ${clCost.toFixed(2)} (Surplus / In Hand)`;
  }

  return {
    days, lp, up, totalMeals,
    opRice, rcvdRice, rcvdRiceDate, rcvdRiceMemo, availRice, utilRice, clRice,
    opCost, rcvdCost, rcvdCostDate, rcvdCostMemo, availCost, utilCost, clCost
  };
}

function saveCurrentMonthStock() {
  const ym = getSelectedYM();
  const calc = calculateStockLive();
  const autoCalc = document.getElementById('stk-auto-calc').checked;

  const record = {
    ym,
    autoCalc,
    days: calc.days,
    lpMeals: calc.lp,
    upMeals: calc.up,
    totalMeals: calc.totalMeals,
    opRice: calc.opRice,
    rcvdRice: calc.rcvdRice,
    rcvdRiceDate: calc.rcvdRiceDate,
    rcvdRiceMemo: calc.rcvdRiceMemo,
    utilRice: calc.utilRice,
    clRice: calc.clRice,
    opCost: calc.opCost,
    rcvdCost: calc.rcvdCost,
    rcvdCostDate: calc.rcvdCostDate,
    rcvdCostMemo: calc.rcvdCostMemo,
    utilCost: calc.utilCost,
    clCost: calc.clCost,
    updatedAt: new Date().toISOString()
  };

  StockModule.save(ym, record);

  const status = document.getElementById('save-status-msg');
  status.style.color = '#15803d';
  status.innerText = `✅ ${ym} Saved! Rollover prepared for the next month.`;
  setTimeout(() => { status.innerText = ''; }, 4500);
}

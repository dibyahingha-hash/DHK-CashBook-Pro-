/**
 * js/cashbook.js
 * Almirah 2: The Dedicated 3-Drawer Statutory Cash Book Engine
 * Drawers:
 *   1. PM POSHAN (Cooking Cost Account)
 *   2. SMC Savings Account (General Fund / Community)
 *   3. Canara Bank SNA (Samagra Shiksha Zero-Balance Account)
 */

const CashBookModule = {
  activeDrawer: 'mdm', // 'mdm' | 'smc' | 'sna'

  getDrawerTitle(drawer) {
    switch (drawer) {
      case 'mdm': return '🍲 PM POSHAN (MDM Cooking Cost) Cash Book';
      case 'smc': return '🏫 SMC General Savings Account Cash Book';
      case 'sna': return '🏛️ Canara Bank SNA (Samagra Shiksha) Cash Book';
      default: return 'Statutory Cash Book';
    }
  },

  getStorageKey(drawer, ym) {
    return `${StorageEngine.PREFIX}cb_${drawer}_${ym}`;
  },

  getPrevMonth(ym) {
    const [year, month] = ym.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  },

  getMonthRecord(drawer, ym) {
    const key = this.getStorageKey(drawer, ym);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  },

  saveMonthRecord(drawer, ym, record) {
    const key = this.getStorageKey(drawer, ym);
    localStorage.setItem(key, JSON.stringify(record));
  }
};

let currentVouchers = [];

function renderCashbookView() {
  const container = document.getElementById('view-cashbook');
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
    <!-- ALMIRAH 2 DRAWER SELECTOR -->
    <div class="card no-print" style="border-top: 4px solid var(--primary); padding-bottom: 12px;">
      <h2 class="card-title">📖 Almirah 2: Statutory Cash Books</h2>
      <p style="font-size:0.85rem; color:#64748b; margin-top:-6px;">Select the dedicated account drawer to view or record financial entries.</p>
      
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
        <button type="button" id="btn-draw-mdm" class="btn" onclick="switchDrawer('mdm')" style="flex:1; padding:10px; font-weight:bold; font-size:0.85rem; background:#0284c7; color:#fff;">
          🍲 PM POSHAN (Cooking Cost)
        </button>
        <button type="button" id="btn-draw-smc" class="btn" onclick="switchDrawer('smc')" style="flex:1; padding:10px; font-weight:bold; font-size:0.85rem; background:#f1f5f9; color:#334155;">
          🏫 SMC General Savings
        </button>
        <button type="button" id="btn-draw-sna" class="btn" onclick="switchDrawer('sna')" style="flex:1; padding:10px; font-weight:bold; font-size:0.85rem; background:#f1f5f9; color:#334155;">
          🏛️ Canara SNA (SSA)
        </button>
      </div>
    </div>

    <!-- REGISTER CONTROLS & VOUCHER ENTRY FORM -->
    <div class="card no-print">
      <!-- Period Selector -->
      <div class="form-group" style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #cbd5e1;">
        <label style="font-weight:bold; color:#1e293b; margin-bottom:6px; display:block;">Accounting Period</label>
        <div style="display:flex; gap:10px;">
          <select id="cb-sel-month" onchange="onCashbookPeriodChange()" style="flex:1; font-size:1rem; padding:8px; font-weight:bold;">
            ${monthOptions}
          </select>
          <select id="cb-sel-year" onchange="onCashbookPeriodChange()" style="flex:1; font-size:1rem; padding:8px; font-weight:bold;">
            ${yearOptions}
          </select>
        </div>
      </div>

      <!-- Opening Balance Setup for this Month -->
      <div style="background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px; padding:12px; margin-bottom:16px;">
        <div style="font-weight:bold; color:#0369a1; font-size:0.9rem; margin-bottom:6px;">Opening Balance (b/f from previous month)</div>
        <div class="grid-2 form-group" style="margin-bottom:0;">
          <div>
            <label style="font-size:0.8rem;">Cash-in-Hand Opening (₹)</label>
            <input type="number" step="0.01" id="cb-op-cash" value="0" oninput="recalculateCashbook()" style="background:#fff;">
          </div>
          <div>
            <label style="font-size:0.8rem;">Bank Balance / SNA Limit Opening (₹)</label>
            <input type="number" step="0.01" id="cb-op-bank" value="0" oninput="recalculateCashbook()" style="background:#fff;">
          </div>
        </div>
        <small id="cb-op-hint" style="color:#0369a1; font-size:0.75rem; margin-top:4px; display:block;"></small>
      </div>

      <!-- Voucher Creation -->
      <h3 class="section-subtitle">Add Voucher / Transaction</h3>
      <div class="grid-2 form-group">
        <div>
          <label>Transaction Type</label>
          <select id="vch-type" style="padding:8px; font-weight:bold;" onchange="updateVoucherTypeFields()">
            <option value="PAYMENT">🔻 PAYMENT (Expenditure / Vendor / Cook)</option>
            <option value="RECEIPT">🟢 RECEIPT (Grant / Bank Interest / Deposit)</option>
            <option value="CONTRA">🔄 CONTRA (Bank Withdrawal to Cash in Hand)</option>
          </select>
        </div>
        <div>
          <label>Date</label>
          <input type="date" id="vch-date" style="padding:7px;">
        </div>
      </div>

      <div class="grid-2 form-group">
        <div>
          <label>Voucher / Bill / Ref No.</label>
          <input type="text" id="vch-no" placeholder="e.g. V-01 / PFMS Advice No.">
        </div>
        <div>
          <label>Payment Mode</label>
          <select id="vch-mode" style="padding:8px;">
            <option value="BANK">Bank Transfer / PFMS / SNA Digital</option>
            <option value="CASH">Cash in Hand</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Particulars / Narration</label>
        <input type="text" id="vch-desc" placeholder="e.g. Purchased Vegetables & Condiments / Paid Cook Honorarium">
      </div>

      <div class="form-group">
        <label>Amount (₹)</label>
        <input type="number" step="0.01" id="vch-amount" placeholder="0.00" style="font-size:1.1rem; font-weight:bold;">
      </div>

      <button type="button" class="btn btn-secondary" onclick="addVoucherEntry()" style="padding:10px; font-weight:bold;">
        + Add Entry to Cash Book
      </button>
    </div>

    <!-- OFFICIAL STATUTORY 2-PAGE CASH BOOK SPREAD -->
    <div class="card" id="cashbook-printable-card">
      <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom:6px; margin-bottom:12px;">
        <h2 style="margin:0; font-size:1.1rem; text-transform:uppercase;" id="cb-prt-school">ASSAM PRIMARY SCHOOL</h2>
        <div style="font-size:0.85rem;" id="cb-prt-udise">UDISE: 18150301501 | BLOCK: Khowang</div>
        <h3 style="margin:4px 0 0 0; font-size:0.95rem; color:var(--primary);" id="cb-prt-title">CASH BOOK</h3>
        <p style="margin:2px 0 0 0; font-size:0.85rem;">Month: <b id="cb-prt-ym"></b></p>
      </div>

      <!-- RECEIPTS TABLE (DEBIT / LEFT PAGE) -->
      <h4 style="margin:0 0 4px 0; background:#f1f5f9; padding:4px 8px; border-left:4px solid #16a34a; font-size:0.85rem;">
        RECEIPTS (DEBIT / জমা শিতান)
      </h4>
      <div class="table-container" style="margin-bottom:16px;">
        <table>
          <thead>
            <tr style="background:#e2e8f0; font-size:0.8rem;">
              <th style="width:12%;">Date</th>
              <th style="width:12%;">Ref No.</th>
              <th style="width:46%;">Particulars</th>
              <th class="num" style="width:15%;">Cash (₹)</th>
              <th class="num" style="width:15%;">Bank (₹)</th>
            </tr>
          </thead>
          <tbody id="cb-tbody-receipts"></tbody>
          <tfoot>
            <tr style="font-weight:bold; background:#f8fafc;">
              <td colspan="3">TOTAL RECEIPTS (including Opening)</td>
              <td class="num" id="cb-tot-rcpt-cash">0.00</td>
              <td class="num" id="cb-tot-rcpt-bank">0.00</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- PAYMENTS TABLE (CREDIT / RIGHT PAGE) -->
      <h4 style="margin:0 0 4px 0; background:#f1f5f9; padding:4px 8px; border-left:4px solid #dc2626; font-size:0.85rem;">
        PAYMENTS (CREDIT / খৰচ শিতান)
      </h4>
      <div class="table-container">
        <table>
          <thead>
            <tr style="background:#e2e8f0; font-size:0.8rem;">
              <th style="width:12%;">Date</th>
              <th style="width:12%;">Vchr No.</th>
              <th style="width:46%;">Particulars</th>
              <th class="num" style="width:15%;">Cash (₹)</th>
              <th class="num" style="width:15%;">Bank (₹)</th>
            </tr>
          </thead>
          <tbody id="cb-tbody-payments"></tbody>
          <tfoot>
            <tr style="font-weight:bold; background:#f8fafc;">
              <td colspan="3">TOTAL EXPENDITURE</td>
              <td class="num" id="cb-tot-pmt-cash">0.00</td>
              <td class="num" id="cb-tot-pmt-bank">0.00</td>
            </tr>
            <tr style="font-weight:bold; background:#e0f2fe; color:#0369a1;">
              <td colspan="3">CLOSING BALANCE (c/f to next month)</td>
              <td class="num" id="cb-cl-cash">0.00</td>
              <td class="num" id="cb-cl-bank">0.00</td>
            </tr>
            <tr style="font-weight:bold; background:#f1f5f9;">
              <td colspan="3">GRAND TOTAL BALANCED</td>
              <td class="num" id="cb-grand-cash">0.00</td>
              <td class="num" id="cb-grand-bank">0.00</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- SAVE & ROLLOVER BUTTON -->
      <div class="no-print" style="margin-top:16px;">
        <button class="btn btn-secondary" onclick="saveCurrentMonthCashbook()" style="padding:12px; font-weight:bold; font-size:1rem;">
          💾 Save Cash Book & Rollover to Next Month
        </button>
        <div id="cb-save-msg" style="text-align:center; font-weight:bold; margin-top:6px; min-height:20px;"></div>
      </div>

      <div style="display:flex; justify-content:space-between; margin-top:35px; font-size:0.8rem;">
        <div>_________________________________<br><b>Signature of Head Teacher</b></div>
        <div style="text-align:right;">_________________________________<br><b>President / Secretary, SMC</b></div>
      </div>
    </div>
  `;

  initDrawerUI();
  onCashbookPeriodChange();
}

function getSelectedCBYM() {
  const m = document.getElementById('cb-sel-month').value;
  const y = document.getElementById('cb-sel-year').value;
  return `${y}-${m}`;
}

function switchDrawer(drawerKey) {
  CashBookModule.activeDrawer = drawerKey;
  initDrawerUI();
  onCashbookPeriodChange();
}

function initDrawerUI() {
  const d = CashBookModule.activeDrawer;
  const btnMdm = document.getElementById('btn-draw-mdm');
  const btnSmc = document.getElementById('btn-draw-smc');
  const btnSna = document.getElementById('btn-draw-sna');

  [btnMdm, btnSmc, btnSna].forEach(b => {
    b.style.background = '#f1f5f9';
    b.style.color = '#334155';
  });

  if (d === 'mdm') {
    btnMdm.style.background = '#0284c7';
    btnMdm.style.color = '#fff';
  } else if (d === 'smc') {
    btnSmc.style.background = '#0284c7';
    btnSmc.style.color = '#fff';
  } else if (d === 'sna') {
    btnSna.style.background = '#0284c7';
    btnSna.style.color = '#fff';
  }

  document.getElementById('cb-prt-title').innerText = CashBookModule.getDrawerTitle(d).toUpperCase();
}

function updateVoucherTypeFields() {
  const type = document.getElementById('vch-type').value;
  const modeSelect = document.getElementById('vch-mode');
  if (type === 'CONTRA') {
    modeSelect.value = 'BANK';
    modeSelect.disabled = true;
  } else {
    modeSelect.disabled = false;
  }
}

function onCashbookPeriodChange() {
  let ym = getSelectedCBYM();
  if (ym < '2020-04') {
    alert("Records start from April 2020. Resetting to April 2020.");
    document.getElementById('cb-sel-year').value = '2020';
    document.getElementById('cb-sel-month').value = '04';
    ym = '2020-04';
  }

  const profile = ProfileModule.getProfile();
  document.getElementById('cb-prt-school').innerText = profile.schoolName || 'ASSAM PRIMARY SCHOOL';
  document.getElementById('cb-prt-udise').innerText = `UDISE: ${profile.udise || 'Not Configured'} | BLOCK: ${profile.block || '-'}`;
  document.getElementById('cb-prt-ym').innerText = ym;

  const drawer = CashBookModule.activeDrawer;
  const currentRecord = CashBookModule.getMonthRecord(drawer, ym);
  const prevYm = CashBookModule.getPrevMonth(ym);
  const prevRecord = CashBookModule.getMonthRecord(drawer, prevYm);

  if (currentRecord) {
    document.getElementById('cb-op-cash').value = currentRecord.opCash ?? 0;
    document.getElementById('cb-op-bank').value = currentRecord.opBank ?? 0;
    currentVouchers = currentRecord.vouchers || [];
    document.getElementById('cb-op-hint').innerText = prevRecord ? `(Rolled over from ${prevYm} closing)` : '';
  } else {
    // Unbroken rollover from previous month
    if (prevRecord) {
      document.getElementById('cb-op-cash').value = prevRecord.clCash ?? 0;
      document.getElementById('cb-op-bank').value = prevRecord.clBank ?? 0;
      document.getElementById('cb-op-hint').innerText = `✓ Carried forward from ${prevYm} closing`;
    } else {
      document.getElementById('cb-op-cash').value = 0;
      document.getElementById('cb-op-bank').value = 0;
      document.getElementById('cb-op-hint').innerText = '(Starting fresh: enter opening balances if any)';
    }
    currentVouchers = [];
  }

  // Pre-fill today's date in voucher entry
  document.getElementById('vch-date').value = `${ym}-01`;
  recalculateCashbook();
}

function addVoucherEntry() {
  const date = document.getElementById('vch-date').value;
  const type = document.getElementById('vch-type').value;
  const no = document.getElementById('vch-no').value.trim() || '-';
  const mode = document.getElementById('vch-mode').value;
  const desc = document.getElementById('vch-desc').value.trim();
  const amount = parseFloat(document.getElementById('vch-amount').value) || 0;

  if (!desc) {
    alert("Please enter a description / narration.");
    return;
  }
  if (amount <= 0) {
    alert("Please enter a valid amount.");
    return;
  }

  currentVouchers.push({
    id: Date.now(),
    date,
    type,
    no,
    mode,
    desc,
    amount
  });

  document.getElementById('vch-desc').value = '';
  document.getElementById('vch-amount').value = '';
  document.getElementById('vch-no').value = '';

  recalculateCashbook();
}

function deleteVoucherEntry(id) {
  currentVouchers = currentVouchers.filter(v => v.id !== id);
  recalculateCashbook();
}

function recalculateCashbook() {
  const opCash = parseFloat(document.getElementById('cb-op-cash').value) || 0;
  const opBank = parseFloat(document.getElementById('cb-op-bank').value) || 0;

  const tbodyRcpt = document.getElementById('cb-tbody-receipts');
  const tbodyPmt = document.getElementById('cb-tbody-payments');

  // Receipts start with Opening Balance
  let rcptHtml = `
    <tr style="background:#f8fafc; font-weight:600;">
      <td>-</td>
      <td>-</td>
      <td>To Opening Balance (b/f)</td>
      <td class="num">${opCash.toFixed(2)}</td>
      <td class="num">${opBank.toFixed(2)}</td>
    </tr>
  `;

  let pmtHtml = '';
  let totRcptCash = opCash;
  let totRcptBank = opBank;
  let totPmtCash = 0;
  let totPmtBank = 0;

  // Render transactions
  currentVouchers.forEach(v => {
    if (v.type === 'RECEIPT') {
      const isCash = v.mode === 'CASH';
      if (isCash) totRcptCash += v.amount; else totRcptBank += v.amount;
      rcptHtml += `
        <tr>
          <td>${v.date}</td>
          <td>${v.no}</td>
          <td>To ${v.desc} <span class="no-print" style="cursor:pointer; color:#dc2626;" onclick="deleteVoucherEntry(${v.id})">✖</span></td>
          <td class="num">${isCash ? v.amount.toFixed(2) : '-'}</td>
          <td class="num">${!isCash ? v.amount.toFixed(2) : '-'}</td>
        </tr>
      `;
    } else if (v.type === 'PAYMENT') {
      const isCash = v.mode === 'CASH';
      if (isCash) totPmtCash += v.amount; else totPmtBank += v.amount;
      pmtHtml += `
        <tr>
          <td>${v.date}</td>
          <td>${v.no}</td>
          <td>By ${v.desc} <span class="no-print" style="cursor:pointer; color:#dc2626;" onclick="deleteVoucherEntry(${v.id})">✖</span></td>
          <td class="num">${isCash ? v.amount.toFixed(2) : '-'}</td>
          <td class="num">${!isCash ? v.amount.toFixed(2) : '-'}</td>
        </tr>
      `;
    } else if (v.type === 'CONTRA') {
      // Bank withdrawal to cash
      totRcptCash += v.amount;
      totPmtBank += v.amount;
      rcptHtml += `
        <tr>
          <td>${v.date}</td>
          <td>${v.no}</td>
          <td>To Self (Withdrawal from Bank) <span class="no-print" style="cursor:pointer; color:#dc2626;" onclick="deleteVoucherEntry(${v.id})">✖</span></td>
          <td class="num">${v.amount.toFixed(2)}</td>
          <td class="num">-</td>
        </tr>
      `;
      pmtHtml += `
        <tr>
          <td>${v.date}</td>
          <td>${v.no}</td>
          <td>By Cash (Withdrawal for Expenses) <span class="no-print" style="cursor:pointer; color:#dc2626;" onclick="deleteVoucherEntry(${v.id})">✖</span></td>
          <td class="num">-</td>
          <td class="num">${v.amount.toFixed(2)}</td>
        </tr>
      `;
    }
  });

  const clCash = totRcptCash - totPmtCash;
  const clBank = totRcptBank - totPmtBank;

  tbodyRcpt.innerHTML = rcptHtml;
  tbodyPmt.innerHTML = pmtHtml;

  document.getElementById('cb-tot-rcpt-cash').innerText = totRcptCash.toFixed(2);
  document.getElementById('cb-tot-rcpt-bank').innerText = totRcptBank.toFixed(2);

  document.getElementById('cb-tot-pmt-cash').innerText = totPmtCash.toFixed(2);
  document.getElementById('cb-tot-pmt-bank').innerText = totPmtBank.toFixed(2);

  document.getElementById('cb-cl-cash').innerText = clCash.toFixed(2);
  document.getElementById('cb-cl-bank').innerText = clBank.toFixed(2);

  document.getElementById('cb-grand-cash').innerText = totRcptCash.toFixed(2);
  document.getElementById('cb-grand-bank').innerText = totRcptBank.toFixed(2);

  return { opCash, opBank, totRcptCash, totRcptBank, totPmtCash, totPmtBank, clCash, clBank };
}

function saveCurrentMonthCashbook() {
  const ym = getSelectedCBYM();
  const drawer = CashBookModule.activeDrawer;
  const calc = recalculateCashbook();

  const record = {
    ym,
    drawer,
    opCash: calc.opCash,
    opBank: calc.opBank,
    totRcptCash: calc.totRcptCash,
    totRcptBank: calc.totRcptBank,
    totPmtCash: calc.totPmtCash,
    totPmtBank: calc.totPmtBank,
    clCash: calc.clCash,
    clBank: calc.clBank,
    vouchers: currentVouchers,
    updatedAt: new Date().toISOString()
  };

  CashBookModule.saveMonthRecord(drawer, ym, record);

  const status = document.getElementById('cb-save-msg');
  status.style.color = '#15803d';
  status.innerText = `✅ ${CashBookModule.getDrawerTitle(drawer)} for ${ym} Saved! Closing balances will roll forward.`;
  setTimeout(() => { status.innerText = ''; }, 4500);
}

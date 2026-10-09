/**
 * js/cashbook.js
 * Almirah 2: Statutory Three-Column Cash Book & Automatic General Ledger Book (খতিয়ান বহি)
 * Complete Double-Entry Posting, Exact Dates, Voucher Refs, and Permanent Storage.
 */

const CashBookModule = {
  activeDrawer: 'mdm',     // 'mdm' | 'smc' | 'sna'
  activeSubView: 'cashbook', // 'cashbook' | 'ledger'
  selectedLedgerHead: 'ALL',

  // Standard Statutory Ledger Heads grouped by Account Drawer
  LEDGER_HEADS: {
    mdm: [
      { id: 'MDM_VEG', name: 'Vegetables, Oil & Condiments Account' },
      { id: 'MDM_FUEL', name: 'LPG Cylinder & Firewood Account' },
      { id: 'MDM_COOK', name: 'Cook-cum-Helper (CCH) Honorarium Account' },
      { id: 'MDM_TRANS', name: 'Food Grain Transportation & Handling Account' },
      { id: 'MDM_GRANT', name: 'Cooking Cost Grant Receipt Account' },
      { id: 'MDM_MISC', name: 'Miscellaneous MDM Contingency Account' },
      { id: 'MDM_INT', name: 'Bank Interest Received Account' }
    ],
    smc: [
      { id: 'SMC_DEV', name: 'School Development & Infrastructure Account' },
      { id: 'SMC_CONT', name: 'School Contingency & Office Expenses Account' },
      { id: 'SMC_DON', name: 'Community Contribution & Donation Account' },
      { id: 'SMC_INT', name: 'Bank Interest Received Account' }
    ],
    sna: [
      { id: 'SNA_CSG', name: 'Composite School Grant (CSG) Account' },
      { id: 'SNA_TLM', name: 'Teaching Learning Material (TLM) Account' },
      { id: 'SNA_SPO', name: 'Sports & Physical Education Account' },
      { id: 'SNA_LIB', name: 'Library & Reading Corner Account' },
      { id: 'SNA_OTH', name: 'Other SSA Project / Activity Account' }
    ]
  },

  getDrawerTitle(drawer) {
    switch (drawer) {
      case 'mdm': return 'PM POSHAN (MDM COOKING COST)';
      case 'smc': return 'SMC GENERAL SAVINGS ACCOUNT';
      case 'sna': return 'CANARA BANK SNA (SAMAGRA SHIKSHA)';
      default: return 'CASH BOOK';
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
let currentEntryType = 'RECEIPT'; // 'RECEIPT' | 'WITHDRAWAL' | 'PAYMENT'

function renderCashbookView() {
  const container = document.getElementById('view-cashbook');
  if (!container) return;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = String(now.getMonth() + 1).padStart(2, '0');

  const months = [
    { num: '04', name: 'April' }, { num: '05', name: 'May' },
    { num: '06', name: 'June' },  { num: '07', name: 'July' },
    { num: '08', name: 'August' },{ num: '09', name: 'September' },
    { num: '10', name: 'October' },{ num: '11', name: 'November' },
    { num: '12', name: 'December' },{ num: '01', name: 'January' },
    { num: '02', name: 'February' },{ num: '03', name: 'March' }
  ];

  const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

  let monthOptions = months.map(m => 
    `<option value="${m.num}" ${m.num === currentMonthNum ? 'selected' : ''}>${m.name}</option>`
  ).join('');

  let yearOptions = years.map(y => 
    `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`
  ).join('');

  container.innerHTML = `
    <!-- ALMIRAH 2 DRAWER SWITCHER -->
    <div class="card no-print" style="padding-bottom:10px;">
      <h2 class="card-title">📖 Almirah 2: Accounts & Audit Register</h2>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
        <button type="button" id="btn-draw-mdm" class="btn" onclick="switchDrawer('mdm')" style="flex:1; padding:8px; font-weight:bold; font-size:0.85rem; background:#0284c7; color:#fff;">
          🍲 PM POSHAN
        </button>
        <button type="button" id="btn-draw-smc" class="btn" onclick="switchDrawer('smc')" style="flex:1; padding:8px; font-weight:bold; font-size:0.85rem; background:#f1f5f9; color:#334155;">
          🏫 SMC Savings
        </button>
        <button type="button" id="btn-draw-sna" class="btn" onclick="switchDrawer('sna')" style="flex:1; padding:8px; font-weight:bold; font-size:0.85rem; background:#f1f5f9; color:#334155;">
          🏛️ Canara SNA
        </button>
      </div>

      <!-- SUB-VIEW TOGGLE: CASH BOOK vs LEDGER BOOK -->
      <div style="display:flex; gap:10px; margin-top:10px; border-top:1px solid #cbd5e1; padding-top:8px;">
        <button type="button" id="btn-sub-cashbook" class="btn" onclick="switchSubView('cashbook')" style="flex:1; background:#1e3a8a; color:#fff; font-weight:bold; padding:8px; font-size:0.85rem;">
          📖 Three-Column Cash Book
        </button>
        <button type="button" id="btn-sub-ledger" class="btn" onclick="switchSubView('ledger')" style="flex:1; background:#f1f5f9; color:#334155; font-weight:bold; padding:8px; font-size:0.85rem;">
          📑 General Ledger (খতিয়ান বহি)
        </button>
      </div>
    </div>

    <!-- VIEW CONTAINER A: CASH BOOK & TRANSACTION INPUT -->
    <div id="subview-cashbook-wrap">
      <div class="card no-print">
        <!-- Period Selector -->
        <div class="grid-2 form-group">
          <div>
            <label><b>Accounting Month</b></label>
            <select id="cb-sel-month" onchange="onCashbookPeriodChange()" style="font-weight:bold;">
              ${monthOptions}
            </select>
          </div>
          <div>
            <label><b>Accounting Year</b></label>
            <select id="cb-sel-year" onchange="onCashbookPeriodChange()" style="font-weight:bold;">
              ${yearOptions}
            </select>
          </div>
        </div>

        <!-- OPENING BALANCE (B/F on 1st of month) -->
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:10px; margin-bottom:14px;">
          <div style="font-size:0.85rem; font-weight:bold; color:#1e293b; margin-bottom:4px;">
            Opening Balance on 1st of Month (To Opening Balance b/f)
          </div>
          <div class="grid-2 form-group" style="margin-bottom:0;">
            <div>
              <label style="font-size:0.75rem;">Cash in Hand (₹)</label>
              <input type="number" step="0.01" id="cb-op-cash" value="0" oninput="recalculateCashbook()">
            </div>
            <div>
              <label style="font-size:0.75rem;">Bank Balance / SNA Limit (₹)</label>
              <input type="number" step="0.01" id="cb-op-bank" value="0" oninput="recalculateCashbook()">
            </div>
          </div>
          <small id="cb-op-hint" style="color:#0284c7; font-size:0.75rem; display:block; margin-top:2px;"></small>
        </div>

        <!-- THREE ACTION ENTRY BUTTONS -->
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
          <button type="button" id="btn-type-rcpt" class="btn" onclick="setTransactionType('RECEIPT')" style="flex:1; background:#15803d; color:#fff; font-weight:bold; padding:9px; font-size:0.85rem;">
            🟢 Add Money Received (Receipt)
          </button>
          <button type="button" id="btn-type-with" class="btn" onclick="setTransactionType('WITHDRAWAL')" style="flex:1; background:#f1f5f9; color:#334155; font-weight:bold; padding:9px; font-size:0.85rem;">
            🔄 Bank Withdrawal to Cash (Contra)
          </button>
          <button type="button" id="btn-type-pmt" class="btn" onclick="setTransactionType('PAYMENT')" style="flex:1; background:#f1f5f9; color:#334155; font-weight:bold; padding:9px; font-size:0.85rem;">
            🔴 Add Payment (Expenditure)
          </button>
        </div>

        <!-- TRANSACTION INPUT CARD -->
        <div id="tx-entry-card" style="border:2px solid #15803d; border-radius:8px; padding:12px; background:#fff;">
          <div id="tx-form-title" style="font-weight:bold; color:#15803d; margin-bottom:10px; font-size:0.95rem;">
            ➕ Enter Money Received (RECEIPT / জমা শিতান)
          </div>

          <div class="grid-2 form-group">
            <div>
              <label><b>Transaction Date *</b></label>
              <input type="date" id="tx-date" style="font-weight:bold; padding:8px;">
            </div>
            <div>
              <label id="lbl-vch-no"><b>Sanction Order / Cheque / Ref No.</b></label>
              <input type="text" id="tx-ref" placeholder="e.g. Sanction SSA/2026/01 or Chq 10452">
            </div>
          </div>

          <div class="grid-2 form-group">
            <div>
              <label><b>Ledger Account Head (Automatic Folio) *</b></label>
              <select id="tx-ledger-head" onchange="onLedgerHeadSelected()" style="font-weight:600; padding:8px;"></select>
            </div>
            <div>
              <label><b>Ledger Folio (L.F.)</b></label>
              <input type="text" id="tx-lf" placeholder="e.g. 1" style="font-weight:bold;">
            </div>
          </div>

          <div class="form-group" id="box-channel">
            <label id="lbl-channel"><b>Received Into:</b></label>
            <select id="tx-channel" style="font-weight:bold; padding:8px;">
              <option value="BANK">Bank Account (Grant / Sanction / Interest)</option>
              <option value="CASH">Cash in Hand (Donation / Hand receipt)</option>
            </select>
          </div>

          <div class="form-group">
                <label><b>Particulars / Narration (Audit Description) *</b></label>
    <select id="tx-desc-select" onchange="handleNarrationSelect(this)" style="font-weight:600; padding:8px; width:100%; font-size:0.95rem; border:1px solid #cbd5e1; border-radius:4px; margin-bottom:4px;"><option value="">-- Select Audit Narration --</option></select>

    <input type="text" id="tx-desc" style="display:none; width:100%; padding:8px; font-size:0.9rem;" placeholder="Type custom narration here...">
    
          </div>

          <div class="form-group">
            <label><b>Amount in Rupees (₹) *</b></label>
            <input type="number" step="0.01" id="tx-amount" placeholder="0.00" style="font-size:1.15rem; font-weight:bold;">
          </div>

          <button type="button" class="btn btn-secondary" onclick="addCompleteTransaction()" style="width:100%; padding:10px; font-size:1rem; font-weight:bold;">
            ✓ Write Entry in Cash Book & Post to Ledger
          </button>
        </div>
      </div>

      <!-- PRINTABLE 3-COLUMN CASH BOOK (MATCHES PHYSICAL REGISTER) -->
      <div class="card" id="cashbook-printable-card">
        <div style="text-align:center; margin-bottom:12px;">
          <h2 style="margin:0; font-size:1.25rem; font-weight:bold; text-transform:uppercase;">Cash Book</h2>
          <div style="font-size:0.95rem;">
            <b id="cb-header-title">PM POSHAN (MDM COOKING COST)</b> — for the month of <b id="cb-prt-month-name"></b>
          </div>
        </div>

        <!-- LEFT PAGE: RECEIPTS -->
        <div style="margin-bottom:18px;">
          <div style="font-weight:bold; font-size:0.9rem; border-bottom:2px solid #000; padding:2px 0;">
            RECEIPTS (জমা শিতান)
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr style="background:#f8fafc; font-size:0.78rem;">
                  <th style="width:14%;">Month & Date</th>
                  <th style="width:38%;">PARTICULARS</th>
                  <th style="width:8%; text-align:center;">Ledger Folio</th>
                  <th class="num" style="width:13%;">Amount (Rs. P.)<br><small>Cash</small></th>
                  <th class="num" style="width:13%;">Bank Amount<br><small>(Rs. P.)</small></th>
                  <th class="num" style="width:14%;">Total Amount<br><small>(Rs. P.)</small></th>
                </tr>
              </thead>
              <tbody id="cb-tbody-receipts" style="font-size:0.82rem;"></tbody>
              <tfoot>
                <tr style="font-weight:bold; background:#f1f5f9; font-size:0.82rem;">
                  <td colspan="3">TOTAL RECEIPTS (including Opening)</td>
                  <td class="num" id="tot-rcpt-cash">0.00</td>
                  <td class="num" id="tot-rcpt-bank">0.00</td>
                  <td class="num" id="tot-rcpt-total">0.00</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- RIGHT PAGE: PAYMENTS -->
        <div>
          <div style="font-weight:bold; font-size:0.9rem; border-bottom:2px solid #000; padding:2px 0;">
            PAYMENTS (খৰচ শিতান)
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr style="background:#f8fafc; font-size:0.78rem;">
                  <th style="width:14%;">Month & Date</th>
                  <th style="width:38%;">PARTICULARS</th>
                  <th style="width:8%; text-align:center;">Ledger Folio</th>
                  <th class="num" style="width:13%;">Amount (Rs. P.)<br><small>Cash</small></th>
                  <th class="num" style="width:13%;">Bank Amount<br><small>(Rs. P.)</small></th>
                  <th class="num" style="width:14%;">Total Amount<br><small>(Rs. P.)</small></th>
                </tr>
              </thead>
              <tbody id="cb-tbody-payments" style="font-size:0.82rem;"></tbody>
              <tfoot>
                <tr style="font-weight:bold; background:#f1f5f9; font-size:0.82rem;">
                  <td colspan="3">TOTAL EXPENDITURE</td>
                  <td class="num" id="tot-pmt-cash">0.00</td>
                  <td class="num" id="tot-pmt-bank">0.00</td>
                  <td class="num" id="tot-pmt-total">0.00</td>
                </tr>
                <tr style="font-weight:bold; background:#e0f2fe; color:#0369a1; font-size:0.82rem;">
                  <td colspan="3">CLOSING BALANCE (c/f to next month)</td>
                  <td class="num" id="tot-cl-cash">0.00</td>
                  <td class="num" id="tot-cl-bank">0.00</td>
                  <td class="num" id="tot-cl-total">0.00</td>
                </tr>
                <tr style="font-weight:bold; background:#f8fafc; border-top:2px solid #000; font-size:0.82rem;">
                  <td colspan="3">GRAND TOTAL (Expenditure + Closing Balance)</td>
                  <td class="num" id="tot-grand-cash">0.00</td>
                  <td class="num" id="tot-grand-bank">0.00</td>
                  <td class="num" id="tot-grand-total">0.00</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="no-print" style="margin-top:16px;">
          <button class="btn btn-secondary" onclick="saveCurrentMonthCashbook()" style="padding:12px; font-weight:bold; font-size:1rem; width:100%;">
            💾 Save Cash Book & Ledger Records
          </button>
          <div id="cb-save-msg" style="text-align:center; font-weight:bold; margin-top:6px; min-height:20px;"></div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:35px; font-size:0.8rem;">
          <div>_________________________________<br><b>Signature of Head Teacher</b></div>
          <div style="text-align:right;">_________________________________<br><b>President / Secretary, SMC</b></div>
        </div>
      </div>
    </div>

    <!-- VIEW CONTAINER B: GENERAL LEDGER BOOK (খতিয়ান বহি) -->
    <div id="subview-ledger-wrap" style="display:none;">
      <div class="card no-print">
        <h3 class="card-title" style="margin-bottom:4px;">📑 General Ledger (খতিয়ান বহি)</h3>
        <p style="font-size:0.85rem; color:#64748b; margin-top:0;">
          All Cash Book entries post automatically into these statutory budget accounts. Select a head to inspect.
        </p>

        <div class="form-group">
          <label><b>Select Account Head</b></label>
          <select id="sel-filter-ledger" onchange="renderLedgerSheet()" style="font-size:1rem; font-weight:bold; padding:8px; width:100%;"></select>
        </div>
      </div>

      <div class="card" id="ledger-printable-card">
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:6px; margin-bottom:12px;">
          <h2 style="margin:0; font-size:1.15rem; font-weight:bold; text-transform:uppercase;">GENERAL LEDGER (খতিয়ান বহি)</h2>
          <div style="font-size:0.95rem; font-weight:bold; color:var(--primary);" id="led-header-head-name">ALL ACCOUNTS</div>
          <div style="font-size:0.85rem;" id="led-header-drawer-name">PM POSHAN ACCOUNT</div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr style="background:#f1f5f9; font-size:0.8rem;">
                <th style="width:14%;">Date</th>
                <th style="width:10%; text-align:center;">C.B. Folio</th>
                <th style="width:36%;">Particulars</th>
                <th class="num" style="width:13%;">Debit (Dr.) ₹</th>
                <th class="num" style="width:13%;">Credit (Cr.) ₹</th>
                <th class="num" style="width:14%;">Net Balance ₹</th>
              </tr>
            </thead>
            <tbody id="led-tbody" style="font-size:0.82rem;"></tbody>
            <tfoot>
              <tr style="font-weight:bold; background:#e2e8f0; font-size:0.85rem;">
                <td colspan="3">TOTAL OF SELECTED HEAD</td>
                <td class="num" id="led-tot-dr">0.00</td>
                <td class="num" id="led-tot-cr">0.00</td>
                <td class="num" id="led-tot-bal">0.00</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:35px; font-size:0.8rem;">
          <div>_________________________________<br><b>Head Teacher / In-charge</b></div>
          <div style="text-align:right;">_________________________________<br><b>Verified by SMC / Auditor</b></div>
        </div>
      </div>
    </div>
  `;

  initDrawerUI();
  populateLedgerDropdowns();
  onCashbookPeriodChange();
}

function switchSubView(view) {
  CashBookModule.activeSubView = view;
  const btnCb = document.getElementById('btn-sub-cashbook');
  const btnLed = document.getElementById('btn-sub-ledger');
  const wrapCb = document.getElementById('subview-cashbook-wrap');
  const wrapLed = document.getElementById('subview-ledger-wrap');

  if (view === 'cashbook') {
    btnCb.style.background = '#1e3a8a';
    btnCb.style.color = '#fff';
    btnLed.style.background = '#f1f5f9';
    btnLed.style.color = '#334155';
    wrapCb.style.display = 'block';
    wrapLed.style.display = 'none';
  } else {
    btnLed.style.background = '#1e3a8a';
    btnLed.style.color = '#fff';
    btnCb.style.background = '#f1f5f9';
    btnCb.style.color = '#334155';
    wrapCb.style.display = 'none';
    wrapLed.style.display = 'block';
    renderLedgerSheet();
  }
}

function populateLedgerDropdowns() {
  const d = CashBookModule.activeDrawer;
  const heads = CashBookModule.LEDGER_HEADS[d] || [];

  const entrySelect = document.getElementById('tx-ledger-head');
  if (entrySelect) {
    entrySelect.innerHTML = heads.map((h, idx) => 
      `<option value="${h.id}" data-folio="${idx + 1}">${h.name} (Folio: ${idx + 1})</option>`
    ).join('');
    onLedgerHeadSelected();
  }

  const filterSelect = document.getElementById('sel-filter-ledger');
  if (filterSelect) {
    let opts = `<option value="ALL">Show All Heads (Consolidated)</option>`;
    opts += heads.map((h, idx) => 
      `<option value="${h.id}">Folio ${idx + 1}: ${h.name}</option>`
    ).join('');
    filterSelect.innerHTML = opts;
  }
}

function onLedgerHeadSelected() {
  const sel = document.getElementById('tx-ledger-head');
  const lfInput = document.getElementById('tx-lf');
  if (sel && lfInput && currentEntryType !== 'WITHDRAWAL') {
    const selectedOpt = sel.options[sel.selectedIndex];
    if (selectedOpt) {
      lfInput.value = selectedOpt.getAttribute('data-folio') || '1';
    }
  }
}

function setTransactionType(type) {
  currentEntryType = type;
    if (typeof refreshNarrationDropdown === 'function') refreshNarrationDropdown(type);
  
  const btnRcpt = document.getElementById('btn-type-rcpt');
  const btnWith = document.getElementById('btn-type-with');
  const btnPmt = document.getElementById('btn-type-pmt');

  const card = document.getElementById('tx-entry-card');
  const title = document.getElementById('tx-form-title');
  const lblVch = document.getElementById('lbl-vch-no');
  const boxChan = document.getElementById('box-channel');
  const lblChan = document.getElementById('lbl-channel');
  const selChan = document.getElementById('tx-channel');
  const lfInput = document.getElementById('tx-lf');
  const descInput = document.getElementById('tx-desc');

  [btnRcpt, btnWith, btnPmt].forEach(b => {
    b.style.background = '#f1f5f9';
    b.style.color = '#334155';
  });

  if (type === 'RECEIPT') {
    btnRcpt.style.background = '#15803d';
    btnRcpt.style.color = '#fff';
    card.style.borderColor = '#15803d';
    title.innerText = '➕ Enter Money Received (RECEIPT / জমা শিতান)';
    title.style.color = '#15803d';
    lblVch.innerText = 'Sanction Order / Cheque / Bank Ref No.';
    boxChan.style.display = 'block';
    lblChan.innerText = 'Received Into:';
    selChan.innerHTML = `
      <option value="BANK">Bank Account (Grant / Sanction / Interest)</option>
      <option value="CASH">Cash in Hand (Donation / Hand receipt)</option>
    `;
    onLedgerHeadSelected();
    descInput.placeholder = 'e.g. Cooking Cost grant received vide Order SSA/...';
  } else if (type === 'WITHDRAWAL') {
    btnWith.style.background = '#0284c7';
    btnWith.style.color = '#fff';
    card.style.borderColor = '#0284c7';
    title.innerText = '🔄 Bank Withdrawal to Cash (Contra Transaction / বেংকৰ পৰা নগদ তুলন)';
    title.style.color = '#0284c7';
    lblVch.innerText = 'Self Cheque No. / Withdrawal Slip No.';
    boxChan.style.display = 'none';
    lfInput.value = 'C';
    descInput.value = 'To Bank (Self Cheque for MDM Expenses)';
  } else if (type === 'PAYMENT') {
    btnPmt.style.background = '#dc2626';
    btnPmt.style.color = '#fff';
    card.style.borderColor = '#dc2626';
    title.innerText = '🔴 Enter Payment / Expenditure (PAYMENT / খৰচ শিতান)';
    title.style.color = '#dc2626';
    lblVch.innerText = 'Voucher No. / Cash Memo No.';
    boxChan.style.display = 'block';
    lblChan.innerText = 'Paid Out Of:';
    selChan.innerHTML = `
      <option value="CASH">Cash in Hand (Vegetables, Grocery, Fuel, Labor)</option>
      <option value="BANK">Bank Account (Cheque / Direct PFMS Vendor Payment)</option>
    `;
    onLedgerHeadSelected();
    descInput.placeholder = 'e.g. Purchased Vegetables & Condiments (Voucher No. 01)';
  }
}

function getSelectedCBYM() {
  const m = document.getElementById('cb-sel-month').value;
  const y = document.getElementById('cb-sel-year').value;
  return `${y}-${m}`;
}

function switchDrawer(drawerKey) {
  CashBookModule.activeDrawer = drawerKey;
  initDrawerUI();
  populateLedgerDropdowns();
  onCashbookPeriodChange();
  if (CashBookModule.activeSubView === 'ledger') {
    renderLedgerSheet();
  }
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

  const titleText = CashBookModule.getDrawerTitle(d);
  document.getElementById('cb-header-title').innerText = titleText;
  const ledDrawer = document.getElementById('led-header-drawer-name');
  if (ledDrawer) ledDrawer.innerText = titleText;
}

function onCashbookPeriodChange() {
  let ym = getSelectedCBYM();
  if (ym < '2020-04') {
    alert("Records start from April 2020. Selecting April 2020.");
    document.getElementById('cb-sel-year').value = '2020';
    document.getElementById('cb-sel-month').value = '04';
    ym = '2020-04';
  }

  const [y, m] = ym.split('-');
  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  document.getElementById('cb-prt-month-name').innerText = `${monthNames[parseInt(m, 10)]} ${y}`;

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
    if (prevRecord) {
      document.getElementById('cb-op-cash').value = prevRecord.clCash ?? 0;
      document.getElementById('cb-op-bank').value = prevRecord.clBank ?? 0;
      document.getElementById('cb-op-hint').innerText = `✓ Carried forward from ${prevYm} closing`;
    } else {
      document.getElementById('cb-op-cash').value = 0;
      document.getElementById('cb-op-bank').value = 0;
      document.getElementById('cb-op-hint').innerText = '(Starting fresh: enter opening balances)';
    }
    currentVouchers = [];
  }

  document.getElementById('tx-date').value = `${ym}-01`;
  recalculateCashbook();
}

function addCompleteTransaction() {
  const date = document.getElementById('tx-date').value;
  const ref = document.getElementById('tx-ref').value.trim() || '-';
  const lf = document.getElementById('tx-lf').value.trim() || '-';
  const desc = document.getElementById('tx-desc').value.trim();
  const amount = parseFloat(document.getElementById('tx-amount').value) || 0;
  const channel = document.getElementById('tx-channel') ? document.getElementById('tx-channel').value : 'BANK';
  const headId = document.getElementById('tx-ledger-head') ? document.getElementById('tx-ledger-head').value : 'MDM_MISC';

  if (!date) {
    alert("Please select the exact transaction date.");
    return;
  }
  if (!desc) {
    alert("Please enter narration / description for the audit record.");
    return;
  }
  if (amount <= 0) {
    alert("Please enter a valid amount.");
    return;
  }

  currentVouchers.push({
    id: Date.now(),
    date,
    type: currentEntryType, // 'RECEIPT' | 'WITHDRAWAL' | 'PAYMENT'
    channel,
    headId,
    ref,
    lf,
    desc,
    amount
  });

  document.getElementById('tx-desc').value = '';
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-ref').value = '';

  recalculateCashbook();
}


    // --- 1. GLOBAL DELETE HANDLER (FIXES DELETE BUTTON CLICK) ---
window.deleteTransaction = function(id) {
  currentVouchers = currentVouchers.filter(v => String(v.id) !== String(id));
  recalculateCashbook();
  if (typeof saveCurrentMonthCashbook === 'function') {
    saveCurrentMonthCashbook();
  }
};
// --- DUAL-SCHEME STATUTORY NARRATION REGISTRY ---
const AUDIT_SCHEMAS = {
  // 1. MDM / PM POSHAN REGISTER
  mdm: {
    RECEIPT: [
      { text: "To Cooking Cost Grant received via PFMS/SNA into Bank Account", lf: "5" },
      { text: "To Bank Interest credited in MDM Savings Bank Account as per passbook", lf: "7" },
      { text: "To Bank (Contra - Self Cheque drawn for MDM daily marketing)", lf: "C" },
      { text: "To Temporary Advance from In-charge/Teacher (MDM out-of-pocket funding)", lf: "8" }
    ],
    WITHDRAWAL: [
      { text: "To Bank (Contra - Self Cheque drawn for MDM daily marketing)", lf: "C" }
    ],
    PAYMENT: [
      { text: "By Cooking Cost (Purchased fresh green vegetables, mustard oil, salt, spices & fuel)", lf: "1" },
      { text: "By LPG Cylinder / Firewood supply refilling charges for MDM kitchen", lf: "2" },
      { text: "By Cook-cum-Helper monthly engagement honorarium payment", lf: "3" },
      { text: "By Kitchen Devices & Utensils purchased under MDM Grant", lf: "4" },
      { text: "By Carrying & transportation charges for lifting FCI food grains", lf: "5" },
      { text: "By Kitchen Garden seeds, manure & minor repair expenses", lf: "6" },
      { text: "By Statutory Bank Charges / SMS alert charges in SNA Account", lf: "7" },
      { text: "By Reimbursement of In-charge out-of-pocket advance (Ledger Folio 8)", lf: "8" }
    ]
  },

  // 2. SMC / COMPOSITE GRANT / CANARA BANK REGISTER
  smc: {
    RECEIPT: [
      { text: "To Composite School Grant received under Samagra Shiksha via PFMS/SNA", lf: "1" },
      { text: "To Sports & Physical Education Grant received via PFMS/SNA", lf: "2" },
      { text: "To Library Books & Learning Materials Grant received", lf: "3" },
      { text: "To Bank Interest credited in SMC Savings / SNA Account as per passbook", lf: "4" },
      { text: "To Community Contribution / Public Donation for School Development", lf: "5" }
    ],
    WITHDRAWAL: [
      { text: "To Bank (Contra - Self Cheque drawn for school maintenance)", lf: "C" }
    ],
    PAYMENT: [
      { text: "By Composite Grant: Minor civil repairs, white-washing & painting of school", lf: "1" },
      { text: "By Swachhta Action Plan: Disinfectants, brooms, toilet cleaning materials", lf: "2" },
      { text: "By Drinking Water & Electricity: Filter servicing, bulbs & wiring maintenance", lf: "3" },
      { text: "By Teaching Learning Materials (TLM): Chart papers, markers & learning aids", lf: "4" },
      { text: "By Sports Equipment & Physical Education materials for students", lf: "5" },
      { text: "By Library Books, Children's Story Books & Newspaper subscription", lf: "6" },
      { text: "By SMC Community Mobilization, Meeting Refreshments & Register Stationery", lf: "7" },
      { text: "By First Aid Box Medicines, Student Health & Hygiene replenishment", lf: "8" },
      { text: "By Statutory Bank Charges / SMS charges deducted by bank", lf: "9" }
    ]
  }
};

window.handleNarrationSelect = function(selectEl) {
  const customInput = document.getElementById('tx-desc');
  const lfInput = document.getElementById('tx-lf');
  const selectedOption = selectEl.options[selectEl.selectedIndex];

  if (selectEl.value === 'CUSTOM') {
    if (customInput) {
      customInput.style.display = 'block';
      customInput.value = '';
      customInput.focus();
    }
  } else {
    if (customInput) {
      customInput.style.display = 'none';
      customInput.value = selectEl.value;
    }
    if (lfInput && selectedOption && selectedOption.dataset.lf) {
      lfInput.value = selectedOption.dataset.lf;
    }
  }
};

window.refreshNarrationDropdown = function(entryType = 'PAYMENT') {
  const selectEl = document.getElementById('tx-desc-select');
  const customInput = document.getElementById('tx-desc');
  const lfInput = document.getElementById('tx-lf');
  if (!selectEl) return;

  const isSmc = (typeof CashBookModule !== 'undefined' && CashBookModule.activeDrawer === 'smc');
  const activeDrawerKey = isSmc ? 'smc' : 'mdm';
  const schema = AUDIT_SCHEMAS[activeDrawerKey][entryType] || AUDIT_SCHEMAS[activeDrawerKey]['PAYMENT'];

  let html = `<option value="">-- Select Audit Narration (${isSmc ? 'SMC / Grant' : 'PM POSHAN MDM'}) --</option>`;
  schema.forEach(item => {
    html += `<option value="${item.text}" data-lf="${item.lf}">${item.text}</option>`;
  });
  html += `<option value="CUSTOM">✏️ Type Custom Narration...</option>`;

  selectEl.innerHTML = html;

  if (schema.length > 0) {
    selectEl.selectedIndex = 1;
    if (customInput) customInput.value = schema[0].text;
    if (lfInput) lfInput.value = schema[0].lf;
  }
};


  if (selectEl.value === 'CUSTOM') {
    customInput.style.display = 'block';
    customInput.value = '';
    customInput.focus();
  } else {
    customInput.style.display = 'none';
    customInput.value = selectEl.value;
  }
};

// Helper: Split Rupee & Paise into distinct stationery sub-columns
function splitAmount(val) {
  if (val === 0 || !val || isNaN(val)) return { rs: '-', p: '-' };
  const parts = Number(val).toFixed(2).split('.');
  return { rs: parts[0], p: parts[1] };
}

// --- 2. AUDIT-GRADE RECALCULATE ENGINE (TWO-PAGE FOLIO) ---
function recalculateCashbook() {
  const rawOpCash = parseFloat(document.getElementById('cb-op-cash')?.value) || 0;
  const rawOpBank = parseFloat(document.getElementById('cb-op-bank')?.value) || 0;
  const monthName = document.getElementById('cb-month-select')?.value || 'Month';
  const yearName = document.getElementById('cb-year-select')?.value || '2026';

  const container = document.getElementById('cashbook-printable-area') || document.getElementById('cashbook-printable-card');

  currentVouchers.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Statutory Rule: Physical cash cannot be negative on paper (< 0).
  // Any negative opening balance is an un-reimbursed liability owed to the teacher.
  const historicalDebt = rawOpCash < 0 ? Math.abs(rawOpCash) : 0;
  const physicalOpCash = Math.max(0, rawOpCash);
  const physicalOpBank = Math.max(0, rawOpBank);

  let totRcptCash = physicalOpCash;
  let totRcptBank = physicalOpBank;
  let totPmtCash = 0;
  let totPmtBank = 0;

  let userCashSpent = 0;
  let cashDrawnFromBank = 0;

  let rcptRows = [];
  let pmtRows = [];

  // Opening Balance Row
  const opC = splitAmount(physicalOpCash);
  const opB = splitAmount(physicalOpBank);
  const opT = splitAmount(physicalOpCash + physicalOpBank);

  rcptRows.push(`
    <tr style="font-weight:600;">
      <td class="text-center">1st</td>
      <td><strong>To Opening Balance (b/f)</strong><br><small style="color:#555;">(Unspent closing balance of previous month brought forward)</small></td>
      <td class="text-center">-</td>
      <td class="col-rs col-divide-left">${opC.rs}</td><td class="col-p">${opC.p}</td>
      <td class="col-rs col-divide-left">${opB.rs}</td><td class="col-p">${opB.p}</td>
      <td class="col-rs col-divide-left">${opT.rs}</td><td class="col-p">${opT.p}</td>
    </tr>
  `);

  // Process All Normal Vouchers
  currentVouchers.forEach(v => {
    const amt = parseFloat(v.amount) || 0;
    const isBank = (v.channel === 'BANK' || v.paidFrom === 'BANK');
    const day = v.date ? (v.date.split('-')[2] || v.date) : '';
    const delBtn = `<span class="no-print" style="margin-left:6px;"><button type="button" onclick="deleteTransaction('${v.id}')" style="background:none;border:none;cursor:pointer;font-size:13px;">🗑️</button></span>`;

    if (v.type === 'RECEIPT') {
      const cAmt = isBank ? 0 : amt;
      const bAmt = isBank ? amt : 0;
      totRcptCash += cAmt;
      totRcptBank += bAmt;

      const spC = splitAmount(cAmt);
      const spB = splitAmount(bAmt);
      const spT = splitAmount(amt);

      rcptRows.push(`
        <tr>
          <td class="text-center">${day}</td>
          <td><strong>To ${v.desc || 'Govt. Grant Received'}</strong><br><small style="color:#555;">${v.narration || 'Received PM POSHAN Cooking Cost allocation via PFMS/SNA'}</small>${delBtn}</td>
          <td class="text-center">${v.lf || v.folio || '5'}</td>
          <td class="col-rs col-divide-left">${spC.rs}</td><td class="col-p">${spC.p}</td>
          <td class="col-rs col-divide-left">${spB.rs}</td><td class="col-p">${spB.p}</td>
          <td class="col-rs col-divide-left">${spT.rs}</td><td class="col-p">${spT.p}</td>
        </tr>
      `);
    } else if (v.type === 'WITHDRAWAL') {
      cashDrawnFromBank += amt;
      totRcptCash += amt;
      totPmtBank += amt;

      const sp = splitAmount(amt);

      // Receipts Side (Cash In)
      rcptRows.push(`
        <tr>
          <td class="text-center">${day}</td>
          <td><strong>To Bank (Contra)</strong><br><small style="color:#555;">Self Cheque No. ${v.ref || '-'} encashed for daily MDM cash market expenditure</small>${delBtn}</td>
          <td class="text-center" style="font-weight:bold;">C</td>
          <td class="col-rs col-divide-left">${sp.rs}</td><td class="col-p">${sp.p}</td>
          <td class="col-rs col-divide-left">-</td><td class="col-p">-</td>
          <td class="col-rs col-divide-left">${sp.rs}</td><td class="col-p">${sp.p}</td>
        </tr>
      `);

      // Payments Side (Bank Out)
      pmtRows.push(`
        <tr>
          <td class="text-center">${day}</td>
          <td><strong>By Cash (Contra)</strong><br><small style="color:#555;">Self Cheque No. ${v.ref || '-'} drawn to replenish cash in hand</small>${delBtn}</td>
          <td class="text-center" style="font-weight:bold;">C</td>
          <td class="col-rs col-divide-left">-</td><td class="col-p">-</td>
          <td class="col-rs col-divide-left">${sp.rs}</td><td class="col-p">${sp.p}</td>
          <td class="col-rs col-divide-left">${sp.rs}</td><td class="col-p">${sp.p}</td>
        </tr>
      `);
    } else if (v.type === 'PAYMENT') {
      const cAmt = isBank ? 0 : amt;
      const bAmt = isBank ? amt : 0;
      if (!isBank) userCashSpent += amt;
      totPmtCash += cAmt;
      totPmtBank += bAmt;

      const spC = splitAmount(cAmt);
      const spB = splitAmount(bAmt);
      const spT = splitAmount(amt);

      pmtRows.push(`
        <tr>
          <td class="text-center">${day}</td>
          <td><strong>By ${v.desc || 'Cooking Cost Account'}</strong><br><small style="color:#555;">${v.narration || 'Paid daily market expenditure for MDM'}</small>${delBtn}</td>
          <td class="text-center">${v.lf || v.folio || '1'}</td>
          <td class="col-rs col-divide-left">${spC.rs}</td><td class="col-p">${spC.p}</td>
          <td class="col-rs col-divide-left">${spB.rs}</td><td class="col-p">${spB.p}</td>
          <td class="col-rs col-divide-left">${spT.rs}</td><td class="col-p">${spT.p}</td>
        </tr>
      `);
    }
  });

  // Calculate Cumulative Deficit (Current Deficit + Prior Unpaid Debt)
  const physicalCashInHand = physicalOpCash + cashDrawnFromBank;
  const currentMonthDeficit = Math.max(0, userCashSpent - physicalCashInHand);
  const totalCumulativeAdvance = historicalDebt + currentMonthDeficit;

  if (totalCumulativeAdvance > 0) {
    totRcptCash += totalCumulativeAdvance;
    const advSp = splitAmount(totalCumulativeAdvance);
    rcptRows.push(`
      <tr style="background:#fffbeb; font-weight:bold;">
        <td class="text-center">End</td>
        <td><strong>To Temporary Advance from In-charge/Teacher</strong><br><small style="color:#b45309;font-weight:normal;">(Out-of-pocket funding arranged to serve uninterrupted MDM pending grant credit; includes prior un-reimbursed balance)</small></td>
        <td class="text-center">8</td>
        <td class="col-rs col-divide-left">${advSp.rs}</td><td class="col-p">${advSp.p}</td>
        <td class="col-rs col-divide-left">-</td><td class="col-p">-</td>
        <td class="col-rs col-divide-left">${advSp.rs}</td><td class="col-p">${advSp.p}</td>
      </tr>
    `);
  }

  // Closing Balances
  const clCash = Math.max(0, totRcptCash - totPmtCash);
  const clBank = Math.max(0, totRcptBank - totPmtBank);

  const clSpC = splitAmount(clCash);
  const clSpB = splitAmount(clBank);
  const clSpT = splitAmount(clCash + clBank);

  pmtRows.push(`
    <tr style="font-weight:600;">
      <td class="text-center">End</td>
      <td><strong>By Closing Balance (c/f to next month)</strong><br><small style="color:#555;">(Cash in hand and Bank balance carried forward)</small></td>
      <td class="text-center">-</td>
      <td class="col-rs col-divide-left">${clSpC.rs}</td><td class="col-p">${clSpC.p}</td>
      <td class="col-rs col-divide-left">${clSpB.rs}</td><td class="col-p">${clSpB.p}</td>
      <td class="col-rs col-divide-left">${clSpT.rs}</td><td class="col-p">${clSpT.p}</td>
    </tr>
  `);

  // Fill up blank lines to maintain genuine physical register appearance
  const MIN_ROWS = 14;
  const emptyRow = `<tr><td>&nbsp;</td><td></td><td></td><td class="col-divide-left"></td><td></td><td class="col-divide-left"></td><td></td><td class="col-divide-left"></td><td></td></tr>`;
  while (rcptRows.length < MIN_ROWS) rcptRows.push(emptyRow);
  while (pmtRows.length < MIN_ROWS) pmtRows.push(emptyRow);

  const finalRcptC = splitAmount(totRcptCash);
  const finalRcptB = splitAmount(totRcptBank);
  const finalRcptT = splitAmount(totRcptCash + totRcptBank);

  const finalPmtC = splitAmount(totPmtCash + clCash);
  const finalPmtB = splitAmount(totPmtBank + clBank);
  const finalPmtT = splitAmount(totPmtCash + clCash + totPmtBank + clBank);

  // Render the authentic 2-Page Folio into DOM
  if (container) {
    container.innerHTML = `
      <!-- PAGE 1: RECEIPTS (LEFT FOLIO) -->
      <div class="cashbook-folio-page page-receipts">
        <div style="text-align:center; margin-bottom:4px; overflow:hidden;">
          <span style="font-weight:bold; font-size:11pt; float:left;">RECEIPTS</span>
          <span style="font-weight:bold; font-size:15pt; letter-spacing:1px;">Cash Book</span>
          <span style="font-size:10pt; margin-left:12px;">for the month of <u>${monthName} ${yearName}</u></span>
        </div>

        <table class="ledger-table">
          <thead>
            <tr>
              <th rowspan="2" style="width:42px;">Month<br>& Date</th>
              <th rowspan="2">PARTICULARS</th>
              <th rowspan="2" style="width:28px;">Ledger<br>Folio</th>
              <th colspan="2" class="col-divide-left">Amount</th>
              <th colspan="2" class="col-divide-left">Bank Amount</th>
              <th colspan="2" class="col-divide-left">Total Amount</th>
            </tr>
            <tr>
              <th style="width:52px;" class="col-divide-left">Rs.</th><th class="col-p">P.</th>
              <th style="width:52px;" class="col-divide-left">Rs.</th><th class="col-p">P.</th>
              <th style="width:52px;" class="col-divide-left">Rs.</th><th class="col-p">P.</th>
            </tr>
          </thead>
          <tbody>
            ${rcptRows.join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:bold; background:#f3f4f6;">
              <td colspan="3" class="text-center">TOTAL RECEIPTS</td>
              <td class="col-rs col-divide-left">${finalRcptC.rs}</td><td class="col-p">${finalRcptC.p}</td>
              <td class="col-rs col-divide-left">${finalRcptB.rs}</td><td class="col-p">${finalRcptB.p}</td>
              <td class="col-rs col-divide-left">${finalRcptT.rs}</td><td class="col-p">${finalRcptT.p}</td>
            </tr>
          </tfoot>
        </table>

        <div class="ledger-signatures">
          <div>Prepared by: Assistant Teacher</div>
          <div>Verified: Head Teacher</div>
        </div>
      </div>

      <!-- PAGE 2: PAYMENTS (RIGHT FOLIO) -->
      <div class="cashbook-folio-page page-payments">
        <div style="text-align:center; margin-bottom:4px; overflow:hidden;">
          <span style="font-weight:bold; font-size:15pt; letter-spacing:1px;">Cash Book</span>
          <span style="font-weight:bold; font-size:11pt; float:right;">PAYMENTS</span>
        </div>

        <table class="ledger-table">
          <thead>
            <tr>
              <th rowspan="2" style="width:42px;">Month<br>& Date</th>
              <th rowspan="2">PARTICULARS</th>
              <th rowspan="2" style="width:28px;">Ledger<br>Folio</th>
              <th colspan="2" class="col-divide-left">Amount</th>
              <th colspan="2" class="col-divide-left">Bank Amount</th>
              <th colspan="2" class="col-divide-left">Total Amount</th>
            </tr>
            <tr>
              <th style="width:52px;" class="col-divide-left">Rs.</th><th class="col-p">P.</th>
              <th style="width:52px;" class="col-divide-left">Rs.</th><th class="col-p">P.</th>
              <th style="width:52px;" class="col-divide-left">Rs.</th><th class="col-p">P.</th>
            </tr>
          </thead>
          <tbody>
            ${pmtRows.join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:bold; background:#f3f4f6;">
              <td colspan="3" class="text-center">GRAND TOTAL (Payments + Closing)</td>
              <td class="col-rs col-divide-left">${finalPmtC.rs}</td><td class="col-p">${finalPmtC.p}</td>
              <td class="col-rs col-divide-left">${finalPmtB.rs}</td><td class="col-p">${finalPmtB.p}</td>
              <td class="col-rs col-divide-left">${finalPmtT.rs}</td><td class="col-p">${finalPmtT.p}</td>
            </tr>
          </tfoot>
        </table>

        <div class="ledger-signatures">
          <div>Signature of Head Teacher</div>
          <div>President / Secretary, SMC</div>
        </div>
      </div>
    `;
  }

  // Also maintain backward-compatibility with UI screen elements if present
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val.toFixed(2);
  };
  setEl('tot-rcpt-cash', totRcptCash);
  setEl('tot-rcpt-bank', totRcptBank);
  setEl('tot-rcpt-total', totRcptCash + totRcptBank);
  setEl('tot-pmt-cash', totPmtCash);
  setEl('tot-pmt-bank', totPmtBank);
  setEl('tot-pmt-total', totPmtCash + totPmtBank);
  setEl('tot-cl-cash', clCash);
  setEl('tot-cl-bank', clBank);
  setEl('tot-cl-total', clCash + clBank);
  setEl('tot-grand-cash', totPmtCash + clCash);
  setEl('tot-grand-bank', totPmtBank + clBank);
  setEl('tot-grand-total', totPmtCash + clCash + totPmtBank + clBank);

  if (typeof CashBookModule !== 'undefined' && CashBookModule.activeSubView === 'ledger') {
    renderLedgerSheet();
  }

  return {
    opCash: physicalOpCash,
    opBank: physicalOpBank,
    totRcptCash,
    totRcptBank,
    totPmtCash,
    totPmtBank,
    clCash,
    clBank,
    totalCumulativeAdvance
  };
}



// GENERAL LEDGER SHEET GENERATOR (খতিয়ান বহি)
function renderLedgerSheet() {

  const d = CashBookModule.activeDrawer;
  const selHead = document.getElementById('sel-filter-ledger') ? document.getElementById('sel-filter-ledger').value : 'ALL';
  const tbody = document.getElementById('led-tbody');
  if (!tbody) return;

  const headList = CashBookModule.LEDGER_HEADS[d] || [];
  const headMap = {};
  headList.forEach(h => { headMap[h.id] = h.name; });

  const titleEl = document.getElementById('led-header-head-name');
  if (titleEl) {
    titleEl.innerText = selHead === 'ALL' ? 'CONSOLIDATED GENERAL LEDGER' : (headMap[selHead] || 'ACCOUNT HEAD').toUpperCase();
  }

  let runningBal = 0;
  let totDr = 0;
  let totCr = 0;
  let rowsHtml = '';

  currentVouchers.forEach((v, idx) => {
    // Contra transactions do not touch personal/nominal ledger expenditure heads
    if (v.type === 'WITHDRAWAL') return;

    if (selHead !== 'ALL' && v.headId !== selHead) return;

    const cbf = `Page ${v.date.substring(5, 7)}`;
    const headTitle = headMap[v.headId] || 'General Head';

    let drAmt = 0;
    let crAmt = 0;

    if (v.type === 'PAYMENT') {
      // Expenditure is Debited (Dr.) to the expense ledger head
      drAmt = v.amount;
      totDr += drAmt;
      runningBal += drAmt;
    } else if (v.type === 'RECEIPT') {
      // Grants / Receipts are Credited (Cr.) to the revenue head
      crAmt = v.amount;
      totCr += crAmt;
      runningBal -= crAmt;
    }

    rowsHtml += `
      <tr>
        <td><b>${v.date}</b></td>
        <td style="text-align:center;">${cbf}</td>
        <td>
          <b>${v.desc}</b> <br>
          <small style="color:#64748b;">[Head: ${headTitle} | Ref: ${v.ref}]</small>
        </td>
        <td class="num">${drAmt ? drAmt.toFixed(2) : '-'}</td>
        <td class="num">${crAmt ? crAmt.toFixed(2) : '-'}</td>
        <td class="num" style="font-weight:bold; color:#1e3a8a;">₹ ${Math.abs(runningBal).toFixed(2)} ${runningBal >= 0 ? 'Dr' : 'Cr'}</td>
      </tr>
    `;
  });

  if (rowsHtml === '') {
    rowsHtml = `<tr><td colspan="6" style="text-align:center; padding:16px; color:#64748b;">No transactions recorded under this Ledger Head for this month.</td></tr>`;
  }

  tbody.innerHTML = rowsHtml;
  document.getElementById('led-tot-dr').innerText = `₹ ${totDr.toFixed(2)}`;
  document.getElementById('led-tot-cr').innerText = `₹ ${totCr.toFixed(2)}`;
  document.getElementById('led-tot-bal').innerText = `₹ ${Math.abs(runningBal).toFixed(2)} ${runningBal >= 0 ? 'Dr' : 'Cr'}`;
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
    clCash: calc.clCash,
    clBank: calc.clBank,
    vouchers: currentVouchers,
    updatedAt: new Date().toISOString()
  };

  CashBookModule.saveMonthRecord(drawer, ym, record);

  const status = document.getElementById('cb-save-msg');
  status.style.color = '#15803d';
  status.innerText = `✅ Both Cash Book & General Ledger for ${ym} Saved! Closing Balances rolled into next month.`;

  setTimeout(() => { status.innerText = ''; }, 4500);
}

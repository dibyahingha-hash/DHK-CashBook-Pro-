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
// STATUTORY MATERIAL (COOKING) COST RATE TIMELINE (2020 - PRESENT)
const STATUTORY_MDM_RATES = [
  { from: '2020-04-01', to: '2022-09-30', primary: 4.97, upper_primary: 7.45 },
  { from: '2022-10-01', to: '2024-11-30', primary: 5.45, upper_primary: 8.17 },
  { from: '2024-12-01', to: '2025-04-30', primary: 6.19, upper_primary: 9.29 },
  { from: '2025-05-01', to: '2099-12-31', primary: 6.78, upper_primary: 10.17 }
];

function getStatutoryRate(year, monthNumStr, category = 'PRIMARY') {
  const checkDate = `${year}-${String(monthNumStr).padStart(2, '0')}-15`;
  const matched = STATUTORY_MDM_RATES.find(r => checkDate >= r.from && checkDate <= r.to)
                  || STATUTORY_MDM_RATES[STATUTORY_MDM_RATES.length - 1];
  return category === 'UPPER_PRIMARY' ? matched.upper_primary : matched.primary;
}

function syncStatutoryRateToUI() {
  const year = document.getElementById('cb-sel-year')?.value || new Date().getFullYear();
  const month = document.getElementById('cb-sel-month')?.value || '04';
  const cat = document.getElementById('cb-mandate-cat')?.value || 'PRIMARY';

  const defaultRate = getStatutoryRate(year, month, cat);
  const rateInput = document.getElementById('cb-cooking-rate');
  if (rateInput) {
    rateInput.value = defaultRate.toFixed(2);
  }
  onMandateTargetChanged('RATE');
}

function resetStatutoryRateToDefault() {
  syncStatutoryRateToUI();
}

function onMandateCategoryChange() {
  syncStatutoryRateToUI();
}


function onMandateTargetChanged(trigger) {
  const rateInput = document.getElementById('cb-cooking-rate');
  const expInput = document.getElementById('cb-mandate-target');
  const mealsInput = document.getElementById('cb-mandate-meals');

  const rate = parseFloat(rateInput?.value) || 0;
  let exp = parseFloat(expInput?.value) || 0;
  let meals = parseInt(mealsInput?.value) || 0;

  if (rate <= 0) return;

  if (trigger === 'AMOUNT' || trigger === 'RATE') {
    if (exp > 0) {
      meals = Math.round(exp / rate);
      if (mealsInput) mealsInput.value = meals;
    }
  } else if (trigger === 'MEALS') {
    if (meals > 0) {
      exp = parseFloat((meals * rate).toFixed(2));
      if (expInput) expInput.value = exp.toFixed(2);
    }
  }

  // Auto-generate the complete statutory narration
  
  

  updateMandateTallyStatus();
}

function updateMandateTallyStatus() {
  const targetExp = parseFloat(document.getElementById('cb-mandate-target')?.value) || 0;
  const enteredExp = (currentVouchers || [])
    .filter(v => v.type === 'PAYMENT')
    .reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);

  const diff = targetExp - enteredExp;

  const lblTarget = document.getElementById('lbl-target-exp');
  const lblEntered = document.getElementById('lbl-entered-exp');
  const lblDiff = document.getElementById('lbl-tally-diff');

  if (lblTarget) lblTarget.innerText = `₹${targetExp.toFixed(2)}`;
  if (lblEntered) lblEntered.innerText = `₹${enteredExp.toFixed(2)}`;

  if (lblDiff) {
    if (targetExp === 0) {
      lblDiff.style.color = '#64748b';
      lblDiff.innerText = 'Pending Setup';
    } else if (Math.abs(diff) < 0.01) {
      lblDiff.style.color = '#15803d';
      lblDiff.innerHTML = '✓ Exact Mandate Match (₹0.00 difference)';
    } else if (diff > 0) {
      lblDiff.style.color = '#b91c1c';
      lblDiff.innerText = `Vouchers Short by ₹${diff.toFixed(2)}`;
    } else {
      lblDiff.style.color = '#b91c1c';
      lblDiff.innerText = `Vouchers Exceed Mandate by ₹${Math.abs(diff).toFixed(2)}`;
    }
  }
}

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
  const heads = (CashBookModule.LEDGER_HEADS || LEDGER_HEADS)[d] || [];
  

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
      populateLedgerDropdowns();
  
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
  const y = (document.getElementById('cb-sel-year') || document.getElementById('cb-year-select'))?.value || '2026';
  const m = (document.getElementById('cb-sel-month') || document.getElementById('cb-month-select'))?.value || '04';
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
  const d = CashBookModule.activeDrawer || 'mdm';
  const btnMdm = document.getElementById('btn-drawer-mdm');
  const btnSmc = document.getElementById('btn-drawer-smc');
  const btnSna = document.getElementById('btn-drawer-sna');

  [btnMdm, btnSmc, btnSna].forEach(b => {
    if (b) {
      b.style.background = '#f1f5f9';
      b.style.color = '#334155';
    }
  });

  if (d === 'mdm' && btnMdm) {
    btnMdm.style.background = '#0284c7';
    btnMdm.style.color = '#fff';
  } else if (d === 'smc' && btnSmc) {
    btnSmc.style.background = '#0284c7';
    btnSmc.style.color = '#fff';
  } else if (d === 'sna' && btnSna) {
    btnSna.style.background = '#0284c7';
    btnSna.style.color = '#fff';
  }

  const titleText = CashBookModule.getDrawerTitle(d);
  const cbHeader = document.getElementById('cb-header-title');
  if (cbHeader) cbHeader.innerText = titleText;
  const ledDrawer = document.getElementById('led-header-drawer-name');
  if (ledDrawer) ledDrawer.innerText = titleText;
}


function onCashbookPeriodChange() {
  let ym = getSelectedCBYM();
  if (ym < '2020-04') {
    const yEl = document.getElementById('cb-sel-year') || document.getElementById('cb-year-select');
const mEl = document.getElementById('cb-sel-month') || document.getElementById('cb-month-select');
if (yEl) yEl.value = '2020';
if (mEl) mEl.value = '04';
    ym = '2020-04';
  }

  const [y, m] = ym.split('-');
  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const prtMonthEl = document.getElementById('cb-prt-month-name');
  if (prtMonthEl) {
    prtMonthEl.innerText = `${monthNames[parseInt(m, 10)]} ${y}`;
  }

  // 1. Automatically fetch & display the correct Statutory Rate for this selected date
  syncStatutoryRateToUI();

  const drawer = CashBookModule.activeDrawer;
  const currentRecord = CashBookModule.getMonthRecord(drawer, ym);
  const prevYm = CashBookModule.getPrevMonth(ym);
  const prevRecord = CashBookModule.getMonthRecord(drawer, prevYm);

  const opCashEl = document.getElementById('cb-op-cash');
  const opBankEl = document.getElementById('cb-op-bank');
  const opAdvEl = document.getElementById('cb-op-advance');
  const opHintEl = document.getElementById('cb-op-hint');
  const opBadgeEl = document.getElementById('cb-op-status-badge');
  const mandateTargetEl = document.getElementById('cb-mandate-target');
  const mandateMealsEl = document.getElementById('cb-mandate-meals');
  const rateInputEl = document.getElementById('cb-cooking-rate');

  if (currentRecord) {
    // A. Month was already saved -> Load exact saved state & lock opening balances
    if (opCashEl) opCashEl.value = (currentRecord.opCash ?? 0).toFixed(2);
    if (opBankEl) opBankEl.value = (currentRecord.opBank ?? 0).toFixed(2);
    if (opAdvEl) opAdvEl.value = (currentRecord.opAdvance ?? 0).toFixed(2);

    if (rateInputEl && currentRecord.rateUsed) {
      rateInputEl.value = Number(currentRecord.rateUsed).toFixed(2);
    }
    if (mandateTargetEl && currentRecord.targetExp) {
      mandateTargetEl.value = Number(currentRecord.targetExp).toFixed(2);
    }
    if (mandateMealsEl && currentRecord.mealsCount) {
      mandateMealsEl.value = currentRecord.mealsCount;
    }

    currentVouchers = currentRecord.vouchers ? [...currentRecord.vouchers] : [];
    
    if (opHintEl) opHintEl.innerText = `🔒 Sealed record loaded for ${ym}.`;
    if (opBadgeEl) opBadgeEl.innerText = "[Saved Month]";
  } else {
    // B. Month is not yet saved
    if (prevRecord) {
      // Prior continuous month exists -> carry forward seamlessly
      if (opCashEl) opCashEl.value = (prevRecord.clCash ?? 0).toFixed(2);
      if (opBankEl) opBankEl.value = (prevRecord.clBank ?? 0).toFixed(2);
      if (opAdvEl) opAdvEl.value = (prevRecord.clAdvance ?? 0).toFixed(2);

      if (opHintEl) opHintEl.innerText = `✓ Carried forward from ${prevYm} closing.`;
      if (opBadgeEl) opBadgeEl.innerText = "[Auto-Carried Forward]";
    } else {
      // Retrospective / starting month -> Allow fresh opening balance entry
      if (opCashEl) opCashEl.value = "0.00";
      if (opBankEl) opBankEl.value = "0.00";
      if (opAdvEl) opAdvEl.value = "0.00";

      if (opHintEl) opHintEl.innerText = `(Starting fresh / retrospective: enter opening figures)`;
      if (opBadgeEl) opBadgeEl.innerText = "[Manual / Retrospective]";
    }

    if (mandateTargetEl) mandateTargetEl.value = '';
    if (mandateMealsEl) mandateMealsEl.value = '';
    currentVouchers = [];
  }

  // Pre-fill default transaction date to 1st of selected month
  const txDateEl = document.getElementById('tx-date');
  if (txDateEl) {
    txDateEl.value = `${ym}-01`;
  }

  onMandateTargetChanged('RATE');
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



// Helper: Split Rupee & Paise into distinct stationery sub-columns
function splitAmount(val) {
  if (val === 0 || !val || isNaN(val)) return { rs: '-', p: '-' };
  const parts = Number(val).toFixed(2).split('.');
  return { rs: parts[0], p: parts[1] };
}

// --- 2. AUDIT-GRADE RECALCULATE ENGINE (TWO-PAGE FOLIO) ---

    function recalculateCashbook() {
  const cbRawCash = parseFloat(document.getElementById('cb-op-cash')?.value) || 0;
  const cbRawBank = parseFloat(document.getElementById('cb-op-bank')?.value) || 0;
  const cbRawAdv = parseFloat(document.getElementById('cb-op-advance')?.value) || 0;

  // Resolve dynamic month and year
  const selMonth = document.getElementById('cb-sel-month') || document.getElementById('cb-month-select');
  const selYear = document.getElementById('cb-sel-year') || document.getElementById('cb-year-select');
  const monthName = (selMonth && selMonth.options && selMonth.selectedIndex >= 0)
    ? selMonth.options[selMonth.selectedIndex].text
    : 'Selected Month';
  const yearName = selYear ? selYear.value : '2026';

  const container = document.getElementById('cashbook-printable-area') || document.getElementById('cashbook-printable-card');

  // Safe split helper ensuring zero trailing minus signs
  const splitAmount = (val) => {
    const num = Math.abs(parseFloat(val)) || 0;
    const fixed = num.toFixed(2);
    const parts = fixed.split('.');
    return {
      rs: Number(parts[0]).toLocaleString('en-IN'),
      p: parts[1]
    };
  };

  const renderCells = (amt) => {
    const sp = splitAmount(amt);
    if ((parseFloat(amt) || 0) === 0) {
      return '<td class="col-rs col-divide-left">-</td><td class="col-p">-</td>';
    }
    return `<td class="col-rs col-divide-left">${sp.rs}</td><td class="col-p">${sp.p}</td>`;
  };

  currentVouchers.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // STATUTORY AUDIT RULES:
  // 1. Physical cash in hand cannot be negative.
  let physicalOpCash = Math.max(0, cbRawCash);
  let physicalOpBank = Math.max(0, cbRawBank);
  let teacherAdvanceBroughtForward = Math.max(0, cbRawAdv);

  let runningCash = physicalOpCash;
  let runningBank = physicalOpBank;

  let totRcptCash = physicalOpCash;
  let totRcptBank = physicalOpBank;
  let totPmtCash = 0;
  let totPmtBank = 0;

  let thisMonthTeacherAdvances = 0;

  let rcptRows = [];
  let pmtRows = [];

  // 1. Opening Balance Row (Receipts Side)
  rcptRows.push(`
    <tr style="font-weight:600;">
      <td class="text-center">1st</td>
      <td><strong>To Opening Balance (b/f)</strong><br><small style="color:#555;">(Cash in Hand & Bank Balance brought forward)</small></td>
      <td class="text-center">-</td>
      ${renderCells(physicalOpCash)}
      ${renderCells(physicalOpBank)}
      ${renderCells(physicalOpCash + physicalOpBank)}
    </tr>
  `);

  // 2. Process all Vouchers in chronological sequence
  currentVouchers.forEach((v, idx) => {
    const day = v.date ? v.date.split('-')[2] : '-';
    const amt = parseFloat(v.amount) || 0;
    const isBank = (v.channel === 'BANK');
    const lf = v.lf || '-';
    const cleanDesc = (v.desc || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const delBtn = `<span class="no-print" style="cursor:pointer; color:red; margin-left:6px;" onclick="removeVoucher(${idx})">✖</span>`;

    if (v.type === 'RECEIPT') {
      let cAmt = isBank ? 0 : amt;
      let bAmt = isBank ? amt : 0;

      runningCash += cAmt;
      runningBank += bAmt;
      totRcptCash += cAmt;
      totRcptBank += bAmt;

      rcptRows.push(`
        <tr>
          <td class="text-center">${day}</td>
          <td><strong>To ${cleanDesc}</strong> ${delBtn}</td>
          <td class="text-center">${lf}</td>
          ${renderCells(cAmt)}
          ${renderCells(bAmt)}
          ${renderCells(amt)}
        </tr>
      `);
    } else if (v.type === 'WITHDRAWAL') {
      // CONTRA ENTRY: Bank to Cash
      runningBank -= amt;
      runningCash += amt;
      totRcptCash += amt;
      totPmtBank += amt;

      rcptRows.push(`
        <tr>
          <td class="text-center">${day}</td>
          <td><strong>To Bank (Contra - Self Withdrawal)</strong> ${delBtn}</td>
          <td class="text-center">C</td>
          ${renderCells(amt)}
          ${renderCells(0)}
          ${renderCells(amt)}
        </tr>
      `);

      pmtRows.push(`
        <tr>
          <td class="text-center">${day}</td>
          <td><strong>By Cash (Contra - Received from Bank)</strong> ${delBtn}</td>
          <td class="text-center">C</td>
          ${renderCells(0)}
          ${renderCells(amt)}
          ${renderCells(amt)}
        </tr>
      `);
    } else if (v.type === 'PAYMENT') {
      let cAmt = isBank ? 0 : amt;
      let bAmt = isBank ? amt : 0;

      // AUDIT RULE: If cash payment exceeds physical cash in hand,
      // Head Teacher automatically funds the difference out-of-pocket.
      if (!isBank && cAmt > runningCash) {
        const requiredAdvance = parseFloat((cAmt - runningCash).toFixed(2));
        
        rcptRows.push(`
          <tr>
            <td class="text-center">${day}</td>
            <td><strong>To Head Teacher's Personal Advance</strong><br><small style="color:#0369a1;">(Out-of-pocket funds introduced to clear expenditure voucher)</small></td>
            <td class="text-center">-</td>
            ${renderCells(requiredAdvance)}
            ${renderCells(0)}
            ${renderCells(requiredAdvance)}
          </tr>
        `);

        runningCash += requiredAdvance;
        totRcptCash += requiredAdvance;
        thisMonthTeacherAdvances += requiredAdvance;
      }

      runningCash -= cAmt;
      runningBank -= bAmt;
      totPmtCash += cAmt;
      totPmtBank += bAmt;

      pmtRows.push(`
        <tr>
          <td class="text-center">${day}</td>
          <td><strong>By ${cleanDesc}</strong> ${delBtn}</td>
          <td class="text-center">${lf}</td>
          ${renderCells(cAmt)}
          ${renderCells(bAmt)}
          ${renderCells(amt)}
        </tr>
      `);
    }
  });

  // 3. Closing Balances (c/f)
  const closingCash = Math.max(0, runningCash);
  const closingBank = Math.max(0, runningBank);
  const totalCumulativeAdvance = teacherAdvanceBroughtForward + thisMonthTeacherAdvances;

  pmtRows.push(`
    <tr style="font-weight:600;">
      <td class="text-center">End</td>
      <td><strong>By Closing Balance (c/f to next month)</strong><br><small style="color:#555;">(Unspent Cash in hand and Bank Balance)</small></td>
      <td class="text-center">-</td>
      ${renderCells(closingCash)}
      ${renderCells(closingBank)}
      ${renderCells(closingCash + closingBank)}
    </tr>
  `);

  const grandPmtCash = totPmtCash + closingCash;
  const grandPmtBank = totPmtBank + closingBank;

  // Final summary formatting
  const finalRcptC = splitAmount(totRcptCash);
  const finalRcptB = splitAmount(totRcptBank);
  const finalRcptT = splitAmount(totRcptCash + totRcptBank);

  const finalPmtC = splitAmount(grandPmtCash);
  const finalPmtB = splitAmount(grandPmtBank);
  const finalPmtT = splitAmount(grandPmtCash + grandPmtBank);

  const activeDrawerKey = (typeof CashBookModule !== 'undefined' && CashBookModule.activeDrawer) ? CashBookModule.activeDrawer : 'mdm';
  const drawerTitleText = (typeof CashBookModule !== 'undefined' && CashBookModule.getDrawerTitle) ? CashBookModule.getDrawerTitle(activeDrawerKey) : 'PM POSHAN';

  if (container) {
    container.innerHTML = `
      <div class="two-page-folio">
        <!-- LEFT FOLIO: RECEIPTS -->
        <div class="folio-page folio-receipts">
          <div class="folio-header text-center">
            <h3>RECEIPTS</h3>
            <h4>${drawerTitleText}</h4>
            <p>Cash Book for the month of <strong><span id="cb-prt-month-name">${monthName} ${yearName}</span></strong></p>
          </div>
          <table class="table-cashbook">
            <thead>
              <tr>
                <th style="width:10%;">Date</th>
                <th style="width:44%;">Particulars</th>
                <th style="width:8%;">L.F.</th>
                <th colspan="2" style="width:19%;">Cash (₹)</th>
                <th colspan="2" style="width:19%;">Bank (₹)</th>
              </tr>
              <tr class="sub-head">
                <th></th><th></th><th></th>
                <th>Rs.</th><th>P.</th>
                <th>Rs.</th><th>P.</th>
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
              </tr>
            </tfoot>
          </table>
          <div class="ledger-signatures" style="display:flex; justify-content:space-between; margin-top:20px; font-size:0.8rem;">
            <div>Prepared by: _______________________</div>
            <div>Verified by: _______________________</div>
          </div>
        </div>

        <!-- RIGHT FOLIO: PAYMENTS -->
        <div class="folio-page folio-payments">
          <div class="folio-header text-center">
            <h3>PAYMENTS</h3>
            <h4>${drawerTitleText}</h4>
            <p>Cash Book for the month of <strong>${monthName} ${yearName}</strong></p>
          </div>
          <table class="table-cashbook">
            <thead>
              <tr>
                <th style="width:10%;">Date</th>
                <th style="width:44%;">Particulars</th>
                <th style="width:8%;">L.F.</th>
                <th colspan="2" style="width:19%;">Cash (₹)</th>
                <th colspan="2" style="width:19%;">Bank (₹)</th>
              </tr>
              <tr class="sub-head">
                <th></th><th></th><th></th>
                <th>Rs.</th><th>P.</th>
                <th>Rs.</th><th>P.</th>
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
              </tr>
            </tfoot>
          </table>

          <!-- STATUTORY AUDIT CERTIFICATE FOR OUT-OF-POCKET EXPENSES -->
          ${totalCumulativeAdvance > 0 ? `
            <div style="margin-top:12px; padding:6px 10px; border:1px solid #cbd5e1; background:#f8fafc; font-size:0.75rem; border-radius:4px;">
              <b>Auditor Note (Teacher Personal Liability):</b><br>
              • Prior Unreimbursed Advance (b/f): <b>₹${teacherAdvanceBroughtForward.toFixed(2)}</b><br>
              • Advanced Out-of-Pocket this month: <b>₹${thisMonthTeacherAdvances.toFixed(2)}</b><br>
              • Total Cumulative Debt due to Teacher (c/f): <b>₹${totalCumulativeAdvance.toFixed(2)}</b>
            </div>
          ` : ''}

          <div class="ledger-signatures" style="display:flex; justify-content:space-between; margin-top:20px; font-size:0.8rem;">
            <div>Signature of Head Teacher</div>
            <div>President / Secretary, SMC</div>
          </div>
        </div>
      </div>
    `;
  }

  // Backward compatibility with screen UI summary values
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = (parseFloat(val) || 0).toFixed(2);
  };
  setEl('tot-rcpt-cash', totRcptCash);
  setEl('tot-rcpt-bank', totRcptBank);
  setEl('tot-rcpt-total', totRcptCash + totRcptBank);
  setEl('tot-pmt-cash', totPmtCash);
  setEl('tot-pmt-bank', totPmtBank);
  setEl('tot-pmt-total', totPmtCash + totPmtBank);
  setEl('tot-cl-cash', closingCash);
  setEl('tot-cl-bank', closingBank);
  setEl('tot-cl-total', closingCash + closingBank);
  setEl('tot-grand-cash', grandPmtCash);
  setEl('tot-grand-bank', grandPmtBank);
  setEl('tot-grand-total', grandPmtCash + grandPmtBank);

  updateMandateTallyStatus();

  if (typeof CashBookModule !== 'undefined' && CashBookModule.activeSubView === 'ledger') {
    renderLedgerSheet();
  }

  return {
    opCash: physicalOpCash,
    opBank: physicalOpBank,
    priorAdvanceBroughtForward: teacherAdvanceBroughtForward,
    thisMonthTeacherAdvances: thisMonthTeacherAdvances,
    totRcptCash: totRcptCash,
    totRcptBank: totRcptBank,
    totPmtCash: totPmtCash,
    totPmtBank: totPmtBank,
    clCash: closingCash,
    clBank: closingBank,
    totalCumulativeAdvance: totalCumulativeAdvance
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

function getNextMonthYM(ym) {
  const [year, month] = ym.split('-').map(Number);
  const d = new Date(year, month, 1); // JS months are 0-indexed; this targets the next calendar month
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function saveCurrentMonthCashbook() {
  const ym = getSelectedCBYM();
  const drawer = CashBookModule.activeDrawer;
  const calc = recalculateCashbook();

  const rateUsed = parseFloat(document.getElementById('cb-cooking-rate')?.value) || 0;
  const targetExp = parseFloat(document.getElementById('cb-mandate-target')?.value) || 0;
  const mealsCount = parseInt(document.getElementById('cb-mandate-meals')?.value) || 0;

  const record = {
    ym,
    drawer,
    rateUsed,
    targetExp,
    mealsCount,
    opCash: calc.opCash,
    opBank: calc.opBank,
    opAdvance: calc.priorAdvanceBroughtForward,
    clCash: calc.clCash,
    clBank: calc.clBank,
    clAdvance: calc.totalCumulativeAdvance,
    thisMonthAdvance: calc.thisMonthTeacherAdvances,
    vouchers: [...currentVouchers],
    updatedAt: new Date().toISOString()
  };

  // 1. Commit and seal the current month record
  CashBookModule.saveMonthRecord(drawer, ym, record);

  // 2. Cascade Forward: update next month's opening balance if it exists
  const nextYm = getNextMonthYM(ym);
  const nextRecord = CashBookModule.getMonthRecord(drawer, nextYm);
  if (nextRecord) {
    nextRecord.opCash = calc.clCash;
    nextRecord.opBank = calc.clBank;
    nextRecord.opAdvance = calc.totalCumulativeAdvance;
    CashBookModule.saveMonthRecord(drawer, nextYm, nextRecord);
  }

  // 3. UI feedback
  const status = document.getElementById('cb-save-msg');
  if (status) {
    status.style.color = '#15803d';
    status.innerText = `✅ Month ${ym} Sealed! Closing Cash: ₹${calc.clCash.toFixed(2)} | Teacher Advance c/f: ₹${calc.totalCumulativeAdvance.toFixed(2)}`;
    setTimeout(() => { status.innerText = ''; }, 5000);
  }

  // Update status badge
  const badge = document.getElementById('cb-op-status-badge');
  if (badge) badge.innerText = '[Saved Month]';
}
/* ==========================================================================
   STATUTORY COOKING MANDATE LIVE DERIVATION ENGINE
   ========================================================================== */

function resetGovtRate() {
  const catEl = document.getElementById('cb-mandate-cat');
  const rateEl = document.getElementById('cb-rate-meal');
  if (!rateEl) return;
  
  const cat = catEl ? catEl.value : 'LP';
  if (cat === 'UP') {
    rateEl.value = '10.15';
  } else {
    rateEl.value = '6.78';
  }
  calculateCookingMandate();
}

// Typing Meals -> calculates Expenditure
function deriveExpenditureFromMeals() {
  const rate = parseFloat(document.getElementById('cb-rate-meal')?.value) || 0;
  const meals = parseFloat(document.getElementById('cb-derived-meals')?.value) || 0;
  const expEl = document.getElementById('cb-mandate-exp');
  
  if (expEl) {
    if (rate > 0 && meals > 0) {
      expEl.value = (meals * rate).toFixed(2);
    } else {
      expEl.value = '0.00';
    }
  }
  updateMandateSummaryDisplay();
}

// Typing Expenditure -> calculates Meals
function deriveMealsFromExpenditure() {
  const rate = parseFloat(document.getElementById('cb-rate-meal')?.value) || 0;
  const exp = parseFloat(document.getElementById('cb-mandate-exp')?.value) || 0;
  const mealsEl = document.getElementById('cb-derived-meals');
  
  if (mealsEl) {
    if (rate > 0) {
      mealsEl.value = Math.round(exp / rate);
    } else {
      mealsEl.value = 0;
    }
  }
  updateMandateSummaryDisplay();
}

function calculateCookingMandate() {
  deriveExpenditureFromMeals();
}

function updateMandateSummaryDisplay() {
  const targetExp = parseFloat(document.getElementById('cb-mandate-exp')?.value) || 0;
  const targetLbl = document.getElementById('lbl-mandate-target');
  const vouchersLbl = document.getElementById('lbl-vouchers-tot');
  const diffLbl = document.getElementById('lbl-mandate-diff');

  if (targetLbl) targetLbl.innerText = '₹' + targetExp.toFixed(2);

  let vouchersTotal = 0;
  if (typeof currentCashbookEntries !== 'undefined' && Array.isArray(currentCashbookEntries)) {
    vouchersTotal = currentCashbookEntries
      .filter(e => e.side === 'PAYMENT')
      .reduce((sum, e) => sum + (parseFloat(e.cashOut || e.bankOut || e.amount) || 0), 0);
  }

  if (vouchersLbl) vouchersLbl.innerText = '₹' + vouchersTotal.toFixed(2);

  if (diffLbl) {
    const diff = targetExp - vouchersTotal;
    if (diff > 0) {
      diffLbl.style.color = '#dc2626';
      diffLbl.innerText = `| Vouchers Short by ₹${diff.toFixed(2)}`;
    } else if (diff < 0) {
      diffLbl.style.color = '#15803d';
      diffLbl.innerText = `| Vouchers Exceeded by ₹${Math.abs(diff).toFixed(2)}`;
    } else {
      diffLbl.style.color = '#15803d';
      diffLbl.innerText = `| Mandate Exact Match (₹0.00)`;
    }
  }
}

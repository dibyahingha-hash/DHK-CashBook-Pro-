/**
 * js/cashbook.js
 * Statutory Cash Book Engine for MDM, SMC Normal, and Canara SNA
 */

const CashbookModule = {
  // Key generator: cashbook_TYPE_YYYY-MM
  getKey(type, ymStr) {
    return `cashbook_${type}_${ymStr}`;
  },

  // Save register dataset
  save(type, ymStr, data) {
    StorageEngine.set(this.getKey(type, ymStr), data);
  },

  // Retrieve register dataset
  get(type, ymStr) {
    return StorageEngine.get(this.getKey(type, ymStr), {
      opCash: 0,
      opBank: 0,
      entries: []
    });
  }
};

let currentCashbookType = 'MDM_SAVINGS';

// Render the complete Cash Book module view
function renderCashbookView(type) {
  currentCashbookType = type;
  const containerId = type === 'MDM_SAVINGS' ? 'view-mdm_cash' :
                      type === 'SMC_SAVINGS' ? 'view-smc_cash' : 'view-sna_cash';

  const container = document.getElementById(containerId);
  if (!container) return;

  const currentYm = new Date().toISOString().substring(0, 7);
  const titles = {
    'MDM_SAVINGS': 'PM POSHAN (MDM) Savings Cash Book',
    'SMC_SAVINGS': 'SMC Normal Account Cash Book',
    'SMC_CANARA_SNA': 'Canara Bank SNA (Single Nodal Account) Cash Book'
  };

  const isSNA = (type === 'SMC_CANARA_SNA');

  container.innerHTML = `
    <!-- Top Action & Selection Bar -->
    <div class="card no-print">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <h2 class="card-title" style="margin:0;">${titles[type]}</h2>
        <div style="display:flex; gap:8px; align-items:center;">
          <label style="margin:0; font-weight:700;">Month:</label>
          <input type="month" id="cb-ym" value="${currentYm}" onchange="loadCashbookData()" style="width:160px;">
        </div>
      </div>

      <div class="grid-2 form-group" style="margin-top:12px;">
        <div>
          <label>Opening Cash in Hand (Rs.)</label>
          <input type="number" step="0.01" id="cb-op-cash" ${isSNA ? 'value="0.00" disabled style="background:#e2e8f0;"' : 'value="0.00"'} oninput="recalculateCashbook()">
        </div>
        <div>
          <label>Opening Bank Balance / Limit (Rs.)</label>
          <input type="number" step="0.01" id="cb-op-bank" value="0.00" oninput="recalculateCashbook()">
        </div>
      </div>
      <button class="btn btn-print" onclick="prepareAndPrintRegister()">🖨️ Print Official 2-Page Cash Book (PDF)</button>
    </div>

    <!-- BOX A: CONTRA / BANK CASH WITHDRAWAL -->
    ${!isSNA ? `
    <div class="card no-print" style="border-left: 4px solid var(--amber);">
      <h3 class="card-title title-contra">Box A: Bank Cash Withdrawal (Contra)</h3>
      <p style="font-size:0.75rem; color:#475569; margin:0 0 8px 0;">
        Debits Cash in Hand and Credits Bank balance simultaneously. No manual double entry needed.
      </p>
      <div class="grid-3 form-group">
        <div>
          <label>Date</label>
          <input type="date" id="contra-date">
        </div>
        <div>
          <label>Cheque / Self Withdrawal Slip No.</label>
          <input type="text" id="contra-ref" placeholder="e.g. Chq 452109">
        </div>
        <div>
          <label>Amount (Rs.)</label>
          <input type="number" step="0.01" id="contra-amt" placeholder="0.00">
        </div>
      </div>
      <button class="btn btn-contra" onclick="submitContra()">💸 Record Cash Withdrawal (Contra)</button>
    </div>
    ` : ''}

    <!-- BOX B: RECEIPTS (DEBIT) -->
    <div class="card no-print" style="border-left: 4px solid var(--secondary);">
      <h3 class="card-title title-receipt">Box B: Direct Receipts / Grants / Interest (Dr.)</h3>
      <div class="grid-3 form-group">
        <div>
          <label>Date</label>
          <input type="date" id="rec-date">
        </div>
        <div>
          <label>Particulars (Received From / Purpose)</label>
          <input type="text" id="rec-desc" placeholder="e.g. Cooking Cost Grant Credit">
        </div>
        <div>
          <label>Mode</label>
          <select id="rec-mode">
            <option value="BANK">Bank Credit / Limit Release</option>
            ${!isSNA ? '<option value="CASH">Cash in Hand</option>' : ''}
          </select>
        </div>
      </div>
      <div class="grid-2 form-group">
        <div>
          <label>Ledger Folio / Voucher Ref</label>
          <input type="text" id="rec-lf" placeholder="LF-01">
        </div>
        <div>
          <label>Amount (Rs.)</label>
          <input type="number" step="0.01" id="rec-amt" placeholder="0.00">
        </div>
      </div>
      <button class="btn btn-secondary" onclick="submitReceipt()">📥 Record Receipt (Debit)</button>
    </div>

    <!-- BOX C: PAYMENTS (CREDIT) -->
    <div class="card no-print" style="border-left: 4px solid var(--primary);">
      <h3 class="card-title title-payment">Box C: Payments & Expenditure Vouchers (Cr.)</h3>
      <div class="grid-3 form-group">
        <div>
          <label>Date</label>
          <input type="date" id="pay-date">
        </div>
        <div>
          <label>Particulars (Paid To / Description)</label>
          <input type="text" id="pay-desc" placeholder="e.g. Purchase of Vegetables & Spices">
        </div>
        <div>
          <label>Mode</label>
          <select id="pay-mode">
            ${!isSNA ? '<option value="CASH">Cash in Hand</option>' : ''}
            <option value="BANK">Bank / PFMS Online Payment</option>
          </select>
        </div>
      </div>
      <div class="grid-2 form-group">
        <div>
          <label>Voucher No. / Bill Reference</label>
          <input type="text" id="pay-vno" placeholder="V-01">
        </div>
        <div>
          <label>Amount (Rs.)</label>
          <input type="number" step="0.01" id="pay-amt" placeholder="0.00">
        </div>
      </div>
      <button class="btn btn-primary" onclick="submitPayment()">📤 Record Payment (Credit)</button>
    </div>

    <!-- Running Summary & Preview Card -->
    <div class="card" id="cb-preview-card">
      <h3 class="card-title">Monthly Register Entries & Running Balance</h3>
      <div class="grid-2" style="background:#f1f5f9; padding:8px; border-radius:6px; margin-bottom:10px; font-size:0.8rem;">
        <div>Closing Cash in Hand (c/d): <b id="disp-cl-cash" style="color:var(--primary);">Rs. 0.00</b></div>
        <div>Closing Bank Balance (c/d): <b id="disp-cl-bank" style="color:var(--secondary);">Rs. 0.00</b></div>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Particulars</th>
              <th>Ref / V.No</th>
              <th class="num">Cash (Rs.)</th>
              <th class="num">Bank (Rs.)</th>
              <th class="no-print" style="width:30px;">Action</th>
            </tr>
          </thead>
          <tbody id="cb-entries-body"></tbody>
        </table>
      </div>
    </div>
  `;

  // Pre-fill today's date in form fields
  const today = new Date().toISOString().split('T')[0];
  const setEl = (id) => { const el = document.getElementById(id); if (el) el.value = today; };
  setEl('contra-date');
  setEl('rec-date');
  setEl('pay-date');

  loadCashbookData();
}

// 1. Submit Bank Contra (Withdrawal)
function submitContra() {
  const date = document.getElementById('contra-date').value;
  const ref = document.getElementById('contra-ref').value.trim() || 'Self Withdrawal';
  const amt = parseFloat(document.getElementById('contra-amt').value) || 0;

  if (!date || amt <= 0) {
    alert('Please enter a valid date and withdrawal amount.');
    return;
  }

  const ym = document.getElementById('cb-ym').value;
  const cb = CashbookModule.get(currentCashbookType, ym);

  cb.entries.push({
    id: Date.now(),
    date,
    side: 'CONTRA',
    particulars: `Cash Withdrawn from Bank (${ref})`,
    ref: 'C',
    cashIn: amt,
    bankOut: amt,
    cashOut: 0,
    bankIn: 0
  });

  CashbookModule.save(currentCashbookType, ym, cb);
  document.getElementById('contra-amt').value = '';
  recalculateCashbook();
}

// 2. Submit Receipt (Dr.)
function submitReceipt() {
  const date = document.getElementById('rec-date').value;
  const desc = document.getElementById('rec-desc').value.trim();
  const mode = document.getElementById('rec-mode').value;
  const lf = document.getElementById('rec-lf').value.trim() || '-';
  const amt = parseFloat(document.getElementById('rec-amt').value) || 0;

  if (!date || !desc || amt <= 0) {
    alert('Please enter date, particulars, and amount.');
    return;
  }

  const ym = document.getElementById('cb-ym').value;
  const cb = CashbookModule.get(currentCashbookType, ym);

  cb.entries.push({
    id: Date.now(),
    date,
    side: 'RECEIPT',
    particulars: `To ${desc}`,
    ref: lf,
    cashIn: mode === 'CASH' ? amt : 0,
    bankIn: mode === 'BANK' ? amt : 0,
    cashOut: 0,
    bankOut: 0
  });

  CashbookModule.save(currentCashbookType, ym, cb);
  document.getElementById('rec-desc').value = '';
  document.getElementById('rec-amt').value = '';
  recalculateCashbook();
}

// 3. Submit Payment (Cr.)
function submitPayment() {
  const date = document.getElementById('pay-date').value;
  const desc = document.getElementById('pay-desc').value.trim();
  const mode = document.getElementById('pay-mode').value;
  const vno = document.getElementById('pay-vno').value.trim() || '-';
  const amt = parseFloat(document.getElementById('pay-amt').value) || 0;

  if (!date || !desc || amt <= 0) {
    alert('Please enter date, description, and amount.');
    return;
  }

  const ym = document.getElementById('cb-ym').value;
  const cb = CashbookModule.get(currentCashbookType, ym);

  cb.entries.push({
    id: Date.now(),
    date,
    side: 'PAYMENT',
    particulars: `By ${desc}`,
    ref: vno,
    cashOut: mode === 'CASH' ? amt : 0,
    bankOut: mode === 'BANK' ? amt : 0,
    cashIn: 0,
    bankIn: 0
  });

  CashbookModule.save(currentCashbookType, ym, cb);
  document.getElementById('pay-desc').value = '';
  document.getElementById('pay-amt').value = '';
  recalculateCashbook();
}

// Delete single transaction
function deleteCashbookEntry(id) {
  if (!confirm('Are you sure you want to delete this entry?')) return;
  const ym = document.getElementById('cb-ym').value;
  const cb = CashbookModule.get(currentCashbookType, ym);
  cb.entries = cb.entries.filter(e => e.id !== id);
  CashbookModule.save(currentCashbookType, ym, cb);
  recalculateCashbook();
}

// Math Engine: Balances the accounts and updates previews
function recalculateCashbook() {
  const ym = document.getElementById('cb-ym').value;
  const cb = CashbookModule.get(currentCashbookType, ym);

  const opCash = parseFloat(document.getElementById('cb-op-cash').value) || 0;
  const opBank = parseFloat(document.getElementById('cb-op-bank').value) || 0;
  cb.opCash = opCash;
  cb.opBank = opBank;

  // Sort entries chronologically
  cb.entries.sort((a, b) => a.date.localeCompare(b.date));

  let totCashIn = opCash, totBankIn = opBank;
  let totCashOut = 0, totBankOut = 0;

  const tbody = document.getElementById('cb-entries-body');
  tbody.innerHTML = '';

  cb.entries.forEach(e => {
    totCashIn += (e.cashIn || 0);
    totBankIn += (e.bankIn || 0);
    totCashOut += (e.cashOut || 0);
    totBankOut += (e.bankOut || 0);

    const row = document.createElement('tr');
    const badgeColor = e.side === 'CONTRA' ? 'var(--amber)' : (e.side === 'RECEIPT' ? 'var(--secondary)' : 'var(--primary)');
    
    row.innerHTML = `
      <td>${e.date}</td>
      <td><b style="color:${badgeColor}">${e.side}</b></td>
      <td>${e.particulars}</td>
      <td>${e.ref}</td>
      <td class="num">${(e.cashIn || e.cashOut) ? formatMoney(e.cashIn || e.cashOut) : '-'}</td>
      <td class="num">${(e.bankIn || e.bankOut) ? formatMoney(e.bankIn || e.bankOut) : '-'}</td>
      <td class="no-print" style="text-align:center;">
        <button class="btn-del" onclick="deleteCashbookEntry(${e.id})">×</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  const clCash = totCashIn - totCashOut;
  const clBank = totBankIn - totBankOut;

  document.getElementById('disp-cl-cash').innerText = `Rs. ${formatMoney(clCash)}`;
  document.getElementById('disp-cl-bank').innerText = `Rs. ${formatMoney(clBank)}`;

  // Save updated state
  CashbookModule.save(currentCashbookType, ym, cb);
}

// Load Month Data
function loadCashbookData() {
  const ym = document.getElementById('cb-ym').value;
  const cb = CashbookModule.get(currentCashbookType, ym);

  document.getElementById('cb-op-cash').value = cb.opCash || 0;
  document.getElementById('cb-op-bank').value = cb.opBank || 0;

  recalculateCashbook();
    }
    

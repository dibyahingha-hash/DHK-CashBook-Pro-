/**
 * js/ledger.js
 * Automated Head-wise Ledger Book Engine
 */

const LedgerModule = {
  // Pre-configured standard statutory expenditure heads
  standardHeads: [
    { id: 'ALL', name: '— All Transactions (General Ledger) —' },
    { id: 'VEG', name: 'Vegetables & Green Groceries' },
    { id: 'OIL_SPICE', name: 'Mustard Oil, Spices & Salt' },
    { id: 'FUEL', name: 'Fuel & Firewood / LPG' },
    { id: 'HONORARIUM', name: 'Cook-cum-Helper Honorarium' },
    { id: 'GRANT_RECV', name: 'Cooking Cost / Composite Grants Received' },
    { id: 'MAINTENANCE', name: 'School Maintenance & Minor Repairs' },
    { id: 'SPORTS_TLM', name: 'Sports Goods & Teaching Learning Material' },
    { id: 'MISC', name: 'Miscellaneous Expenses' }
  ],

  // Automatic classifier based on transaction text
  detectHead(particulars) {
    const text = (particulars || '').toLowerCase();
    if (text.includes('veg') || text.includes('potato') || text.includes('onion') || text.includes('egg') || text.includes('sabzi')) return 'VEG';
    if (text.includes('oil') || text.includes('spice') || text.includes('haldi') || text.includes('salt') || text.includes('masala')) return 'OIL_SPICE';
    if (text.includes('gas') || text.includes('lpg') || text.includes('wood') || text.includes('fuel')) return 'FUEL';
    if (text.includes('honorarium') || text.includes('cook') || text.includes('helper') || text.includes('remuneration')) return 'HONORARIUM';
    if (text.includes('grant') || text.includes('cooking cost credit') || text.includes('limit') || text.includes('interest')) return 'GRANT_RECV';
    if (text.includes('repair') || text.includes('paint') || text.includes('electric') || text.includes('cleaning')) return 'MAINTENANCE';
    if (text.includes('sport') || text.includes('tlm') || text.includes('book') || text.includes('chart') || text.includes('ball')) return 'SPORTS_TLM';
    return 'MISC';
  }
};

// Render the complete Ledger module view
function renderLedgerView() {
  const container = document.getElementById('view-ledger');
  if (!container) return;

  const currentYm = new Date().toISOString().substring(0, 7);

  container.innerHTML = `
    <!-- Top Configuration & Filter Card -->
    <div class="card no-print">
      <h2 class="card-title">Classified Ledger Book (খতিয়ান)</h2>
      
      <div class="grid-3 form-group">
        <div>
          <label>Select Account Register</label>
          <select id="led-register" onchange="loadLedgerRecords()">
            <option value="MDM_SAVINGS">PM POSHAN (MDM) Savings Account</option>
            <option value="SMC_SAVINGS">SMC Normal Savings Account</option>
            <option value="SMC_CANARA_SNA">Canara Bank SNA Account</option>
          </select>
        </div>
        <div>
          <label>Select Month</label>
          <input type="month" id="led-ym" value="${currentYm}" onchange="loadLedgerRecords()">
        </div>
        <div>
          <label>Select Ledger Head (খতিয়ান শিতান)</label>
          <select id="led-head" onchange="loadLedgerRecords()">
            ${LedgerModule.standardHeads.map(h => `<option value="${h.id}">${h.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <button class="btn btn-print" onclick="window.print()">🖨️ Print Ledger Account (PDF)</button>
    </div>

    <!-- Official Ledger Sheet Display -->
    <div class="card" id="ledger-printable-sheet">
      <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom:6px; margin-bottom:12px;">
        <h2 style="margin:0; font-size:1.1rem; text-transform:uppercase;" id="led-prt-school">ASSAM PRIMARY SCHOOL</h2>
        <h3 style="margin:2px 0; font-size:0.85rem;" id="led-prt-udise">UDISE: 18010100101</h3>
        <h4 style="margin:4px 0 0 0; font-size:0.95rem; color:var(--primary);">LEDGER ACCOUNT: <span id="led-prt-title" style="text-decoration:underline;">VEGETABLES ACCOUNT</span></h4>
        <p style="margin:2px 0 0 0; font-size:0.8rem;">Period: <b id="led-prt-month">${currentYm}</b></p>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr style="background:#e2e8f0;">
              <th style="width:12%;">Date</th>
              <th style="width:40%;">Particulars</th>
              <th style="width:12%;">CB Folio / V.No</th>
              <th class="num" style="width:18%;">Debit (Dr.) Rs.</th>
              <th class="num" style="width:18%;">Credit (Cr.) Rs.</th>
            </tr>
          </thead>
          <tbody id="led-rows-body"></tbody>
          <tfoot>
            <tr style="font-weight:bold; background:#f1f5f9;">
              <td colspan="3" style="text-align:right;">Total Carried Forward:</td>
              <td class="num" id="led-tot-dr">Rs. 0.00</td>
              <td class="num" id="led-tot-cr">Rs. 0.00</td>
            </tr>
            <tr style="font-weight:bold; background:#e2e8f0;">
              <td colspan="3" style="text-align:right;">Net Account Balance:</td>
              <td colspan="2" class="num" id="led-net-bal" style="color:var(--primary); font-size:0.85rem;">Rs. 0.00</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Statutory Signature Block -->
      <div style="display:flex; justify-content:space-between; margin-top:50px; font-size:0.8rem;">
        <div>
          _______________________________________<br>
          <b>Verified by Teacher-in-Charge</b>
        </div>
        <div style="text-align:right;">
          _______________________________________<br>
          <b>Signature of Head Teacher / Secretary</b>
        </div>
      </div>
    </div>
  `;

  loadLedgerRecords();
}

// Load and filter records from the respective Cash Book
function loadLedgerRecords() {
  const regType = document.getElementById('led-register').value;
  const ym = document.getElementById('led-ym').value;
  const headId = document.getElementById('led-head').value;

  const profile = ProfileModule.getProfile();
  const cb = CashbookModule.get(regType, ym);

  // Update header text
  document.getElementById('led-prt-school').innerText = profile.schoolName || 'ASSAM PRIMARY SCHOOL';
  document.getElementById('led-prt-udise').innerText = `UDISE: ${profile.udise || 'Not Configured'} | BLOCK: ${profile.block || '-'}`;
  document.getElementById('led-prt-month').innerText = ym;

  const currentHeadObj = LedgerModule.standardHeads.find(h => h.id === headId);
  document.getElementById('led-prt-title').innerText = currentHeadObj ? currentHeadObj.name.toUpperCase() : 'GENERAL LEDGER';

  const tbody = document.getElementById('led-rows-body');
  tbody.innerHTML = '';

  let totDr = 0;
  let totCr = 0;

  // Filter entries matching the selected category
  const filtered = cb.entries.filter(e => {
    if (headId === 'ALL') return true;
    const detected = LedgerModule.detectHead(e.particulars);
    return detected === headId;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b; padding:16px;">No entries recorded under this ledger head for ${ym}</td></tr>`;
    document.getElementById('led-tot-dr').innerText = 'Rs. 0.00';
    document.getElementById('led-tot-cr').innerText = 'Rs. 0.00';
    document.getElementById('led-net-bal').innerText = 'Rs. 0.00';
    return;
  }

  filtered.forEach(e => {
    // If it's a receipt/contra-in: Debit; if payment: Credit
    const dr = (e.cashIn || 0) + (e.bankIn || 0);
    const cr = (e.cashOut || 0) + (e.bankOut || 0);

    totDr += dr;
    totCr += cr;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${e.date}</td>
      <td>${e.particulars}</td>
      <td>${e.ref || '-'}</td>
      <td class="num">${dr > 0 ? formatMoney(dr) : '-'}</td>
      <td class="num">${cr > 0 ? formatMoney(cr) : '-'}</td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById('led-tot-dr').innerText = `Rs. ${formatMoney(totDr)}`;
  document.getElementById('led-tot-cr').innerText = `Rs. ${formatMoney(totCr)}`;

  const netBal = Math.abs(totDr - totCr);
  const balType = totDr >= totCr ? 'Dr' : 'Cr';
  document.getElementById('led-net-bal').innerText = `Rs. ${formatMoney(netBal)} (${balType})`;
}


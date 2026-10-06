/**
 * js/print.js
 * Official 2-Page Landscape Cash Book Print & Preview Engine
 */

function prepareAndPrintRegister() {
  const ym = document.getElementById('cb-ym').value;
  const cb = CashbookModule.get(currentCashbookType, ym);
  const profile = ProfileModule.getProfile();

  const titles = {
    'MDM_SAVINGS': 'PM POSHAN (MDM) SAVINGS CASH BOOK',
    'SMC_SAVINGS': 'SMC NORMAL ACCOUNT CASH BOOK',
    'SMC_CANARA_SNA': 'CANARA BANK SNA CASH BOOK'
  };

  const receipts = [];
  const payments = [];

  const rawOpCash = cb.opCash || 0;
  const rawOpBank = cb.opBank || 0;

  // Opening Balance Row
  if (rawOpCash < 0) {
    // Deficit from past month appears on Payments side as Past Deficit
    receipts.push({
      date: `${ym}-01`,
      particulars: 'To Opening Balance b/f (Bank)',
      lf: '-',
      cash: 0,
      bank: rawOpBank,
      total: rawOpBank
    });
    payments.push({
      date: `${ym}-01`,
      particulars: 'By Opening Deficit / Past Due to HT b/f',
      lf: '-',
      cash: Math.abs(rawOpCash),
      bank: 0,
      total: Math.abs(rawOpCash)
    });
  } else {
    receipts.push({
      date: `${ym}-01`,
      particulars: 'To Opening Balance b/f',
      lf: '-',
      cash: rawOpCash,
      bank: rawOpBank,
      total: rawOpCash + rawOpBank
    });
  }

  // Populate transactions
  (cb.entries || []).forEach(e => {
    if (e.side === 'RECEIPT') {
      const c = e.cashIn || 0;
      const b = e.bankIn || 0;
      receipts.push({
        date: e.date,
        particulars: e.particulars,
        lf: e.ref || '-',
        cash: c,
        bank: b,
        total: c + b
      });
    } else if (e.side === 'PAYMENT') {
      const c = e.cashOut || 0;
      const b = e.bankOut || 0;
      payments.push({
        date: e.date,
        particulars: e.particulars,
        lf: e.ref || '-',
        cash: c,
        bank: b,
        total: c + b
      });
    } else if (e.side === 'CONTRA') {
      receipts.push({
        date: e.date,
        particulars: 'To Bank (Cash Withdrawn)',
        lf: 'C',
        cash: e.cashIn || 0,
        bank: 0,
        total: e.cashIn || 0
      });
      payments.push({
        date: e.date,
        particulars: 'By Cash (Self Withdrawal)',
        lf: 'C',
        cash: 0,
        bank: e.bankOut || 0,
        total: e.bankOut || 0
      });
    }
  });

  // Calculate totals
  let totDrCash = receipts.reduce((acc, r) => acc + (parseFloat(r.cash) || 0), 0);
  let totDrBank = receipts.reduce((acc, r) => acc + (parseFloat(r.bank) || 0), 0);

  let totCrCash = payments.reduce((acc, p) => acc + (parseFloat(p.cash) || 0), 0);
  let totCrBank = payments.reduce((acc, p) => acc + (parseFloat(p.bank) || 0), 0);

  const netCash = totDrCash - totCrCash;
  const netBank = totDrBank - totCrBank;

  let grandCash = 0;
  let grandBank = 0;

  // Balancing with Deficit vs Surplus support
  if (netCash < 0) {
    receipts.push({
      date: `${ym}-30`,
      particulars: 'By Deficit / Cash Due to Head Teacher c/d',
      lf: '-',
      cash: Math.abs(netCash),
      bank: 0,
      total: Math.abs(netCash)
    });
    grandCash = totCrCash;
  } else {
    payments.push({
      date: `${ym}-30`,
      particulars: 'By Closing Balance c/d (Cash)',
      lf: '-',
      cash: netCash,
      bank: 0,
      total: netCash
    });
    grandCash = totDrCash;
  }

  if (netBank >= 0) {
    payments.push({
      date: `${ym}-30`,
      particulars: 'By Closing Bank Balance c/d',
      lf: '-',
      cash: 0,
      bank: netBank,
      total: netBank
    });
    grandBank = totDrBank;
  } else {
    grandBank = totCrBank;
  }

  const grandTotal = grandCash + grandBank;

  // Pad blank rows to visually match physical register
  const minRows = Math.max(receipts.length, payments.length, 12);
  while (receipts.length < minRows) {
    receipts.push({ date: '', particulars: '', lf: '', cash: null, bank: null, total: null });
  }
  while (payments.length < minRows) {
    payments.push({ date: '', particulars: '', lf: '', cash: null, bank: null, total: null });
  }

  // Find or create the display container
  let targetArea = document.getElementById('screen-register-area');
  if (!targetArea) {
    targetArea = document.createElement('div');
    targetArea.id = 'screen-register-area';
    const activeView = document.querySelector('.module-view.active');
    if (activeView) activeView.appendChild(targetArea);
  }

  targetArea.innerHTML = `
    <div class="card" style="margin-top:16px; border:2px solid var(--primary); background:#fff;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
        <h3 style="margin:0; color:var(--primary); font-size:0.95rem;">📖 Official 2-Page Physical Spread Preview</h3>
        <button class="btn btn-secondary" onclick="window.print()" style="width:auto; padding:6px 14px;">🖨️ Open Print / Save PDF</button>
      </div>
      <p style="font-size:0.75rem; color:#64748b; margin:0 0 10px 0;">Scroll left/right to view the full 2-page landscape register.</p>

      <div class="table-container" style="border:1px solid #000; padding:6px; background:#fff;">
        <div style="text-align:center; margin-bottom: 6px;">
          <h2 style="margin:0; font-size:11pt; text-transform:uppercase;">${profile.schoolName || 'ASSAM PRIMARY SCHOOL'}</h2>
          <div style="font-size:8pt; margin:2px 0;">UDISE: <b>${profile.udise || 'Not Configured'}</b> | BLOCK: <b>${profile.block || '-'}</b></div>
          <h3 style="margin:2px 0; font-size:9.5pt; text-decoration:underline;">${titles[currentCashbookType]}</h3>
        </div>

        <div style="display:flex; gap:8px; min-width:850px;">
          <!-- LEFT PAGE: RECEIPTS -->
          <div style="flex:1; border: 1px solid #000; padding:3px;">
            <div style="display:flex; justify-content:space-between; font-size:8pt; font-weight:bold; margin-bottom:2px;">
              <span>RECEIPTS</span>
              <span>Cash Book</span>
              <span>Month: ${ym}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th rowspan="2" style="width:12%;">Date</th>
                  <th rowspan="2" style="width:38%;">PARTICULARS</th>
                  <th rowspan="2" style="width:8%;">LF</th>
                  <th colspan="2" style="width:14%;">Amount (Cash)</th>
                  <th colspan="2" style="width:14%;">Bank Amount</th>
                  <th colspan="2" style="width:14%;">Total Amount</th>
                </tr>
                <tr>
                  <th>Rs.</th><th class="split-p">P.</th>
                  <th>Rs.</th><th class="split-p">P.</th>
                  <th>Rs.</th><th class="split-p">P.</th>
                </tr>
              </thead>
              <tbody>
                ${receipts.map(r => {
                  const c = splitRupeesPaise(r.cash);
                  const b = splitRupeesPaise(r.bank);
                  const t = splitRupeesPaise(r.total);
                  return `
                    <tr>
                      <td style="white-space:nowrap;">${r.date}</td>
                      <td>${r.particulars}</td>
                      <td style="text-align:center;">${r.lf}</td>
                      <td class="split-rs">${c.rs}</td><td class="split-p">${c.p}</td>
                      <td class="split-rs">${b.rs}</td><td class="split-p">${b.p}</td>
                      <td class="split-rs">${t.rs}</td><td class="split-p">${t.p}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="font-weight:bold; background:#e2e8f0;">
                  <td colspan="3" style="text-align:center;">TOTAL</td>
                  <td class="split-rs">${splitRupeesPaise(grandCash).rs}</td>
                  <td class="split-p">${splitRupeesPaise(grandCash).p}</td>
                  <td class="split-rs">${splitRupeesPaise(grandBank).rs}</td>
                  <td class="split-p">${splitRupeesPaise(grandBank).p}</td>
                  <td class="split-rs">${splitRupeesPaise(grandTotal).rs}</td>
                  <td class="split-p">${splitRupeesPaise(grandTotal).p}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- RIGHT PAGE: PAYMENTS -->
          <div style="flex:1; border: 1px solid #000; padding:3px;">
            <div style="display:flex; justify-content:space-between; font-size:8pt; font-weight:bold; margin-bottom:2px;">
              <span>Cash Book</span>
              <span>PAYMENTS</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th rowspan="2" style="width:12%;">Date</th>
                  <th rowspan="2" style="width:38%;">PARTICULARS</th>
                  <th rowspan="2" style="width:8%;">V.No</th>
                  <th colspan="2" style="width:14%;">Amount (Cash)</th>
                  <th colspan="2" style="width:14%;">Bank Amount</th>
                  <th colspan="2" style="width:14%;">Total Amount</th>
                </tr>
                <tr>
                  <th>Rs.</th><th class="split-p">P.</th>
                  <th>Rs.</th><th class="split-p">P.</th>
                  <th>Rs.</th><th class="split-p">P.</th>
                </tr>
              </thead>
              <tbody>
                ${payments.map(p => {
                  const c = splitRupeesPaise(p.cash);
                  const b = splitRupeesPaise(p.bank);
                  const t = splitRupeesPaise(p.total);
                  return `
                    <tr>
                      <td style="white-space:nowrap;">${p.date}</td>
                      <td>${p.particulars}</td>
                      <td style="text-align:center;">${p.lf}</td>
                      <td class="split-rs">${c.rs}</td><td class="split-p">${c.p}</td>
                      <td class="split-rs">${b.rs}</td><td class="split-p">${b.p}</td>
                      <td class="split-rs">${t.rs}</td><td class="split-p">${t.p}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="font-weight:bold; background:#e2e8f0;">
                  <td colspan="3" style="text-align:center;">TOTAL</td>
                  <td class="split-rs">${splitRupeesPaise(grandCash).rs}</td>
                  <td class="split-p">${splitRupeesPaise(grandCash).p}</td>
                  <td class="split-rs">${splitRupeesPaise(grandBank).rs}</td>
                  <td class="split-p">${splitRupeesPaise(grandBank).p}</td>
                  <td class="split-rs">${splitRupeesPaise(grandTotal).rs}</td>
                  <td class="split-p">${splitRupeesPaise(grandTotal).p}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:28px; font-size:7.5pt; padding:0 10px;">
          <div>____________________________<br><b>Signature of Teacher-in-Charge</b></div>
          <div style="text-align:center;">____________________________<br><b>Verified by SMC Member</b></div>
          <div style="text-align:right;">____________________________<br><b>Signature of Head Teacher</b></div>
        </div>
      </div>
    </div>
  `;

  // Smooth scroll to the newly generated 2-page view
  targetArea.scrollIntoView({ behavior: 'smooth' });
}

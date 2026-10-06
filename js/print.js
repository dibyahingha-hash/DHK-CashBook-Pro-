/**
 * js/print.js
 * Official 2-Page Landscape Cash Book Print & PDF Engine
 * Exactly replicates the physical Assam Government Cash Book register spread
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

  // 1. Separate Receipts and Payments
  const receipts = [];
  const payments = [];

  // Opening Balance Row on Receipts (Left Side)
  receipts.push({
    date: `${ym}-01`,
    particulars: 'To Opening Balance b/f',
    lf: '-',
    cash: cb.opCash || 0,
    bank: cb.opBank || 0,
    total: (cb.opCash || 0) + (cb.opBank || 0)
  });

  cb.entries.forEach(e => {
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
      // Contra: Both sides
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

  // Calculate Totals before Closing Balance
  let totDrCash = receipts.reduce((acc, r) => acc + r.cash, 0);
  let totDrBank = receipts.reduce((acc, r) => acc + r.bank, 0);

  let totCrCash = payments.reduce((acc, p) => acc + p.cash, 0);
  let totCrBank = payments.reduce((acc, p) => acc + p.bank, 0);

  const clCash = totDrCash - totCrCash;
  const clBank = totDrBank - totCrBank;

  // Add Closing Balance c/d row on Payments (Right Side)
  payments.push({
    date: `${ym}-${new Date(ym.split('-')[0], ym.split('-')[1], 0).getDate()}`,
    particulars: 'By Closing Balance c/d',
    lf: '-',
    cash: clCash,
    bank: clBank,
    total: clCash + clBank
  });

  // Final Balanced Totals
  const grandCash = totDrCash;
  const grandBank = totDrBank;
  const grandTotal = grandCash + grandBank;

  // Equalize rows with blank lines for a clean, aligned printout
  const maxRows = Math.max(receipts.length, payments.length, 14);
  while (receipts.length < maxRows) {
    receipts.push({ date: '', particulars: '', lf: '', cash: null, bank: null, total: null });
  }
  while (payments.length < maxRows) {
    payments.push({ date: '', particulars: '', lf: '', cash: null, bank: null, total: null });
  }

  // Construct the Physical 2-Page Spread
  let printArea = document.getElementById('print-landscape-container');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'print-landscape-container';
    document.body.appendChild(printArea);
  }

  printArea.innerHTML = `
    <div style="font-family: Arial, sans-serif; width: 100%;">
      
      <!-- School Header Information -->
      <div style="text-align:center; margin-bottom: 8px;">
        <h2 style="margin:0; font-size:12pt; text-transform:uppercase;">${profile.schoolName || 'ASSAM PRIMARY SCHOOL'}</h2>
        <h4 style="margin:2px 0; font-size:9pt; font-weight:normal;">
          UDISE: <b>${profile.udise || 'Not Configured'}</b> | BLOCK: <b>${profile.block || '-'}</b> | DISTRICT: <b>${profile.district || '-'}</b>
        </h4>
        <h3 style="margin:4px 0; font-size:10pt; text-decoration:underline;">${titles[currentCashbookType]}</h3>
      </div>

      <!-- 2-Page Physical Spread: Receipts (Left) and Payments (Right) -->
      <div style="display:flex; gap:12px; align-items:flex-start;">
        
        <!-- LEFT PAGE: RECEIPTS (Dr.) -->
        <div style="flex:1; border: 1px solid #000; padding:4px;">
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
            <b style="font-size:9pt;">RECEIPTS</b>
            <span style="font-size:11pt; font-weight:bold;">Cash Book</span>
            <span style="font-size:8pt;">for the month of: <b>${ym}</b></span>
          </div>

          <table style="width:100%; border-collapse:collapse; font-size:7pt; border: 1px solid #000;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th rowspan="2" style="width:11%;">Month &<br>Date</th>
                <th rowspan="2" style="width:37%;">PARTICULARS</th>
                <th rowspan="2" style="width:8%;">Ledger<br>Folio</th>
                <th colspan="2" style="width:14%;">Amount (Cash)</th>
                <th colspan="2" style="width:14%;">Bank Amount</th>
                <th colspan="2" style="width:16%;">Total Amount</th>
              </tr>
              <tr style="background:#f1f5f9;">
                <th style="width:10%;">Rs.</th>
                <th class="split-p">P.</th>
                <th style="width:10%;">Rs.</th>
                <th class="split-p">P.</th>
                <th style="width:11%;">Rs.</th>
                <th class="split-p">P.</th>
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

        <!-- RIGHT PAGE: PAYMENTS (Cr.) -->
        <div style="flex:1; border: 1px solid #000; padding:4px;">
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
            <span style="font-size:11pt; font-weight:bold;">Cash Book</span>
            <b style="font-size:9pt;">PAYMENTS</b>
          </div>

          <table style="width:100%; border-collapse:collapse; font-size:7pt; border: 1px solid #000;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th rowspan="2" style="width:11%;">Month &<br>Date</th>
                <th rowspan="2" style="width:37%;">PARTICULARS</th>
                <th rowspan="2" style="width:8%;">Voucher<br>No.</th>
                <th colspan="2" style="width:14%;">Amount (Cash)</th>
                <th colspan="2" style="width:14%;">Bank Amount</th>
                <th colspan="2" style="width:16%;">Total Amount</th>
              </tr>
              <tr style="background:#f1f5f9;">
                <th style="width:10%;">Rs.</th>
                <th class="split-p">P.</th>
                <th style="width:10%;">Rs.</th>
                <th class="split-p">P.</th>
                <th style="width:11%;">Rs.</th>
                <th class="split-p">P.</th>
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

      <!-- Statutory Signatures -->
      <div style="display:flex; justify-content:space-between; margin-top:35px; font-size:8pt; padding:0 15px;">
        <div>
          ________________________________________<br>
          <b>Signature of Teacher-in-Charge</b>
        </div>
        <div style="text-align:center;">
          ________________________________________<br>
          <b>Verified by SMC Member</b>
        </div>
        <div style="text-align:right;">
          ________________________________________<br>
          <b>Signature of Head Teacher / Secretary</b>
        </div>
      </div>

    </div>
  `;

  // Trigger Chrome native print / PDF export
  window.print();
}


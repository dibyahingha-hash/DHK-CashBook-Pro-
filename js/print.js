/**
 * js/print.js
 * Official Physical Register 2-Page Landscape Print & Preview Engine
 */

function splitRupeesPaise(val) {
  if (val === null || val === undefined || val === '') return { rs: '', p: '' };
  const num = parseFloat(val);
  if (isNaN(num)) return { rs: '', p: '' };
  const parts = num.toFixed(2).split('.');
  return { rs: parts[0], p: parts[1] };
}

function prepareAndPrintRegister() {
  const selMonth = document.getElementById('cb-sel-month');
  const selYear = document.getElementById('cb-sel-year');
  const monthName = selMonth ? selMonth.options[selMonth.selectedIndex].text : '';
  const yearVal = selYear ? selYear.value : '';
  const monthStr = `${monthName} ${yearVal}`;

  const currentType = (typeof currentCashbookType !== 'undefined') ? currentCashbookType : 'MDM_SAVINGS';
  const ymKey = `${yearVal}-${selMonth ? selMonth.value : '01'}`;
  
  let cb = { opCash: 0, opBank: 0, entries: [] };
  if (typeof CashbookModule !== 'undefined' && CashbookModule.get) {
    cb = CashbookModule.get(currentType, ymKey) || cb;
  }

  const receipts = [];
  const payments = [];

  const rawOpCash = parseFloat(cb.opCash) || 0;
  const rawOpBank = parseFloat(cb.opBank) || 0;

  // Opening Balance Row
  if (rawOpCash < 0) {
    receipts.push({
      month: monthName.substring(0, 3),
      date: '01',
      particulars: 'To Opening Balance b/f (Bank)',
      lf: '-',
      cash: 0,
      bank: rawOpBank,
      total: rawOpBank
    });
    payments.push({
      month: monthName.substring(0, 3),
      date: '01',
      particulars: 'By Opening Deficit / Past Due to HT b/f',
      lf: '-',
      cash: Math.abs(rawOpCash),
      bank: 0,
      total: Math.abs(rawOpCash)
    });
  } else {
    receipts.push({
      month: monthName.substring(0, 3),
      date: '01',
      particulars: 'To Opening Balance b/f',
      lf: '-',
      cash: rawOpCash,
      bank: rawOpBank,
      total: rawOpCash + rawOpBank
    });
  }

  // Populate transactions
  (cb.entries || []).forEach(e => {
    const dParts = (e.date || '').split('-');
    const mLabel = dParts[1] ? monthName.substring(0, 3) : '';
    const dayLabel = dParts[2] || '';

    if (e.side === 'RECEIPT') {
      const c = parseFloat(e.cashIn) || 0;
      const b = parseFloat(e.bankIn) || 0;
      receipts.push({
        month: mLabel,
        date: dayLabel,
        particulars: e.particulars || '',
        lf: e.ref || '-',
        cash: c,
        bank: b,
        total: c + b
      });
    } else if (e.side === 'PAYMENT') {
      const c = parseFloat(e.cashOut) || 0;
      const b = parseFloat(e.bankOut) || 0;
      payments.push({
        month: mLabel,
        date: dayLabel,
        particulars: e.particulars || '',
        lf: e.ref || '-',
        cash: c,
        bank: b,
        total: c + b
      });
    } else if (e.side === 'CONTRA') {
      receipts.push({
        month: mLabel,
        date: dayLabel,
        particulars: 'To Bank (Cash Withdrawn)',
        lf: 'C',
        cash: parseFloat(e.cashIn) || 0,
        bank: 0,
        total: parseFloat(e.cashIn) || 0
      });
      payments.push({
        month: mLabel,
        date: dayLabel,
        particulars: 'By Cash (Self Withdrawal)',
        lf: 'C',
        cash: 0,
        bank: parseFloat(e.bankOut) || 0,
        total: parseFloat(e.bankOut) || 0
      });
    }
  });

  // Totals & Balancing
  let totDrCash = receipts.reduce((acc, r) => acc + (parseFloat(r.cash) || 0), 0);
  let totDrBank = receipts.reduce((acc, r) => acc + (parseFloat(r.bank) || 0), 0);
  let totCrCash = payments.reduce((acc, p) => acc + (parseFloat(p.cash) || 0), 0);
  let totCrBank = payments.reduce((acc, p) => acc + (parseFloat(p.bank) || 0), 0);

  const netCash = totDrCash - totCrCash;
  const netBank = totDrBank - totCrBank;

  let grandCash = 0;
  let grandBank = 0;

  if (netCash < 0) {
    receipts.push({
      month: monthName.substring(0, 3),
      date: '30',
      particulars: 'By Deficit / Cash Due to Head Teacher c/d',
      lf: '-',
      cash: Math.abs(netCash),
      bank: 0,
      total: Math.abs(netCash)
    });
    grandCash = totCrCash;
  } else {
    payments.push({
      month: monthName.substring(0, 3),
      date: '30',
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
      month: monthName.substring(0, 3),
      date: '30',
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

  // Fill up blank lines exactly like physical stationery
  const minRows = Math.max(receipts.length, payments.length, 16);
  while (receipts.length < minRows) {
    receipts.push({ month: '', date: '', particulars: '', lf: '', cash: null, bank: null, total: null });
  }
  while (payments.length < minRows) {
    payments.push({ month: '', date: '', particulars: '', lf: '', cash: null, bank: null, total: null });
  }

  const printArea = document.getElementById('cashbook-printable-area');
  if (!printArea) return;

  printArea.innerHTML = `
    <div class="two-page-folio">
      
      <!-- LEFT PAGE: RECEIPTS -->
      <div class="folio-page" style="border: 2px solid #000; border-radius: 8px 0 0 8px; padding: 10px; background:#fff;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom: 4px;">
          <h2 style="font-size:1.15rem; font-weight:800; margin:0; letter-spacing:0.5px;">Cash Book</h2>
          <span style="font-size:0.85rem; font-weight:600;">for the month of <u>${monthStr}</u></span>
        </div>
        <div style="font-size:0.95rem; font-weight:900; margin-bottom:4px;">RECEIPTS</div>

        <table class="table-cashbook" style="width:100%; border-collapse:collapse; border:1.5px solid #000; font-size:0.8rem;">
          <thead>
            <tr style="background:#fff; border-bottom:1.5px solid #000;">
              <th colspan="2" style="width:14%; border-right:1.5px solid #000; padding:4px;">Month &amp; Date</th>
              <th rowspan="2" style="width:36%; border-right:1.5px solid #000; padding:4px;">PARTICULARS</th>
              <th rowspan="2" style="width:8%; border-right:1.5px solid #000; padding:4px; font-size:0.75rem;">Ledger<br>Folio</th>
              <th colspan="2" style="width:14%; border-right:1.5px solid #000; padding:4px;">Amount</th>
              <th colspan="2" style="width:14%; border-right:1.5px solid #000; padding:4px;">Bank Amount</th>
              <th colspan="2" style="width:14%; padding:4px;">Total Amount</th>
            </tr>
            <tr style="background:#fff; border-bottom:1.5px solid #000;">
              <th style="width:7%; border-right:1px solid #000; font-size:0.7rem; padding:2px;">M</th>
              <th style="width:7%; border-right:1.5px solid #000; font-size:0.7rem; padding:2px;">D</th>
              <th style="width:10%; border-right:1px dashed #666; font-size:0.75rem; padding:2px;">Rs.</th><th style="width:4%; border-right:1.5px solid #000; font-size:0.75rem; padding:2px;">P.</th>
              <th style="width:10%; border-right:1px dashed #666; font-size:0.75rem; padding:2px;">Rs.</th><th style="width:4%; border-right:1.5px solid #000; font-size:0.75rem; padding:2px;">P.</th>
              <th style="width:10%; border-right:1px dashed #666; font-size:0.75rem; padding:2px;">Rs.</th><th style="width:4%; font-size:0.75rem; padding:2px;">P.</th>
            </tr>
          </thead>
          <tbody>
            ${receipts.map(r => {
              const c = splitRupeesPaise(r.cash);
              const b = splitRupeesPaise(r.bank);
              const t = splitRupeesPaise(r.total);
              return `
                <tr style="height:24px; border-bottom:1px solid #000;">
                  <td style="border-right:1px solid #000; text-align:center; font-size:0.7rem;">${r.month}</td>
                  <td style="border-right:1.5px solid #000; text-align:center; font-size:0.75rem; font-weight:bold;">${r.date}</td>
                  <td style="border-right:1.5px solid #000; padding-left:4px;">${r.particulars}</td>
                  <td style="border-right:1.5px solid #000; text-align:center;">${r.lf}</td>
                  <td style="border-right:1px dashed #888; text-align:right; padding-right:2px;">${c.rs}</td>
                  <td style="border-right:1.5px solid #000; text-align:center;">${c.p}</td>
                  <td style="border-right:1px dashed #888; text-align:right; padding-right:2px;">${b.rs}</td>
                  <td style="border-right:1.5px solid #000; text-align:center;">${b.p}</td>
                  <td style="border-right:1px dashed #888; text-align:right; padding-right:2px;">${t.rs}</td>
                  <td style="text-align:center;">${t.p}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="height:28px; font-weight:bold; border-top:2px solid #000; background:#f8fafc;">
              <td colspan="4" style="text-align:center; border-right:1.5px solid #000;">TOTAL</td>
              <td style="border-right:1px dashed #888; text-align:right; padding-right:2px;">${splitRupeesPaise(grandCash).rs}</td>
              <td style="border-right:1.5px solid #000; text-align:center;">${splitRupeesPaise(grandCash).p}</td>
              <td style="border-right:1px dashed #888; text-align:right; padding-right:2px;">${splitRupeesPaise(grandBank).rs}</td>
              <td style="border-right:1.5px solid #000; text-align:center;">${splitRupeesPaise(grandBank).p}</td>
              <td style="border-right:1px dashed #888; text-align:right; padding-right:2px;">${splitRupeesPaise(grandTotal).rs}</td>
              <td style="text-align:center;">${splitRupeesPaise(grandTotal).p}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- RIGHT PAGE: PAYMENTS -->
      <div class="folio-page" style="border: 2px solid #000; border-radius: 0 8px 8px 0; padding: 10px; background:#fff;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom: 4px;">
          <h2 style="font-size:1.15rem; font-weight:800; margin:0; letter-spacing:0.5px;">Cash Book</h2>
          <span style="font-size:0.95rem; font-weight:bold;">Folio 5</span>
        </div>
        <div style="text-align:right; font-size:0.95rem; font-weight:900; margin-bottom:4px;">PAYMENTS</div>

        <table class="table-cashbook" style="width:100%; border-collapse:collapse; border:1.5px solid #000; font-size:0.8rem;">
          <thead>
            <tr style="background:#fff; border-bottom:1.5px solid #000;">
              <th colspan="2" style="width:14%; border-right:1.5px solid #000; padding:4px;">Month &amp; Date</th>
              <th rowspan="2" style="width:36%; border-right:1.5px solid #000; padding:4px;">PARTICULARS</th>
              <th rowspan="2" style="width:8%; border-right:1.5px solid #000; padding:4px; font-size:0.75rem;">Ledger<br>Folio</th>
              <th colspan="2" style="width:14%; border-right:1.5px solid #000; padding:4px;">Amount</th>
              <th colspan="2" style="width:14%; border-right:1.5px solid #000; padding:4px;">Bank Amount</th>
              <th colspan="2" style="width:14%; padding:4px;">Total Amount</th>
            </tr>
            <tr style="background:#fff; border-bottom:1.5px solid #000;">
              <th style="width:7%; border-right:1px solid #000; font-size:0.7rem; padding:2px;">M</th>
              <th style="width:7%; border-right:1.5px solid #000; font-size:0.7rem; padding:2px;">D</th>
              <th style="width:10%; border-right:1px dashed #666; font-size:0.75rem; padding:2px;">Rs.</th><th style="width:4%; border-right:1.5px solid #000; font-size:0.75rem; padding:2px;">P.</th>
              <th style="width:10%; border-right:1px dashed #666; font-size:0.75rem; padding:2px;">Rs.</th><th style="width:4%; border-right:1.5px solid #000; font-size:0.75rem; padding:2px;">P.</th>
              <th style="width:10%; border-right:1px dashed #666; font-size:0.75rem; padding:2px;">Rs.</th><th style="width:4%; font-size:0.75rem; padding:2px;">P.</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => {
              const c = splitRupeesPaise(p.cash);
              const b = splitRupeesPaise(p.bank);
              const t = splitRupeesPaise(p.total);
              return `
                <tr style="height:24px; border-bottom:1px solid #000;">
                  <td style="border-right:1px solid #000; text-align:center; font-size:0.7rem;">${p.month}</td>
                  <td style="border-right:1.5px solid #000; text-align:center; font-size:0.75rem; font-weight:bold;">${p.date}</td>
                  <td style="border-right:1.5px solid #000; padding-left:4px;">${p.particulars}</td>
                  <td style="border-right:1.5px solid #000; text-align:center;">${p.lf}</td>
                  <td style="border-right:1px dashed #888; text-align:right; padding-right:2px;">${c.rs}</td>
                  <td style="border-right:1.5px solid #000; text-align:center;">${c.p}</td>
                  <td style="border-right:1px dashed #888; text-align:right; padding-right:2px;">${b.rs}</td>
                  <td style="border-right:1.5px solid #000; text-align:center;">${b.p}</td>
                  <td style="border-right:1px dashed #888; text-align:right; padding-right:2px;">${t.rs}</td>
                  <td style="text-align:center;">${t.p}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="height:28px; font-weight:bold; border-top:2px solid #000; background:#f8fafc;">
              <td colspan="4" style="text-align:center; border-right:1.5px solid #000;">TOTAL</td>
              <td style="border-right:1px dashed #888; text-align:right; padding-right:2px;">${splitRupeesPaise(grandCash).rs}</td>
              <td style="border-right:1.5px solid #000; text-align:center;">${splitRupeesPaise(grandCash).p}</td>
              <td style="border-right:1px dashed #888; text-align:right; padding-right:2px;">${splitRupeesPaise(grandBank).rs}</td>
              <td style="border-right:1.5px solid #000; text-align:center;">${splitRupeesPaise(grandBank).p}</td>
              <td style="border-right:1px dashed #888; text-align:right; padding-right:2px;">${splitRupeesPaise(grandTotal).rs}</td>
              <td style="text-align:center;">${splitRupeesPaise(grandTotal).p}</td>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  `;
}

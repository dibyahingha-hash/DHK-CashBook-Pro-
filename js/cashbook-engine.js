/**
 * DHK PM POSHAN & SCHOOL CASHBOOK ENGINE (PRO AUDIT-READY)
 * Strict Dual-Page A4 Isolation | Live Reconciliation Guard | Standalone Ledger Print Engine
 */
(function (window) {
  'use strict';

  // --- 1. CORE STATE ---
  window.currentDrawer = 'mdm';
  window.currentEntryType = 'RECEIPT';
  window.currentVouchers = [];
  window.pendingAdvanceAmount = 0;

  // --- 2. STATUTORY FOLIO & NARRATION SCHEMAS ---
  window.ENGINE_SCHEMAS = {
    mdm: {
      RECEIPT: [
        { text: "To Cooking Cost Grant received via PFMS/SNA into Bank Account", lf: "5", channel: "BANK" },
        { text: "To Bank Interest credited in MDM Savings Bank Account as per passbook", lf: "3", channel: "BANK" },
        { text: "To Bank (Contra - Self Cheque drawn for MDM daily marketing)", lf: "C", channel: "CASH" },
        { text: "To Temporary Advance from In-charge/Teacher (Out-of-pocket funding)", lf: "8", channel: "CASH" }
      ],
      WITHDRAWAL: [
        { text: "To Bank (Contra - Self Cheque drawn for MDM daily marketing)", lf: "C", channel: "BANK" }
      ],
      PAYMENT: [
        { text: "By Cooking Cost for meals served", lf: "1", channel: "CASH", isMealExpense: true },
        { text: "By LPG Cylinder / Firewood supply refilling charges for MDM kitchen", lf: "2", channel: "CASH" },
        { text: "By Cook-cum-Helper monthly engagement honorarium payment", lf: "3", channel: "BANK" },
        { text: "By Kitchen Devices & Utensils purchased under MDM Grant", lf: "4", channel: "CASH" },
        { text: "By Carrying & transportation charges for lifting FCI food grains", lf: "5", channel: "CASH" },
        { text: "By Kitchen Garden seeds, manure & minor repair expenses", lf: "6", channel: "CASH" },
        { text: "By Statutory Bank Charges / SMS alert charges in SNA Account", lf: "7", channel: "BANK" },
        { text: "By Reimbursement of In-charge out-of-pocket advance", lf: "8", channel: "BANK" }
      ]
    },
    smc: {
      RECEIPT: [
        { text: "To Composite School Grant received under Samagra Shiksha via PFMS/SNA", lf: "1", channel: "BANK" },
        { text: "To Sports & Physical Education Grant received via PFMS/SNA", lf: "2", channel: "BANK" },
        { text: "To Library Books & Learning Materials Grant received", lf: "3", channel: "BANK" },
        { text: "To Bank Interest credited in SMC Savings / SNA Account as per passbook", lf: "4", channel: "BANK" },
        { text: "To Community Contribution / Public Donation for School Development", lf: "5", channel: "CASH" }
      ],
      WITHDRAWAL: [
        { text: "To Bank (Contra - Self Cheque drawn for School Development Expenses)", lf: "C", channel: "BANK" }
      ],
      PAYMENT: [
        { text: "By Minor Repairs / whitewashing / maintenance of school premises", lf: "1", channel: "CASH" },
        { text: "By Purchase of Teaching-Learning Materials (TLM) & stationery", lf: "2", channel: "CASH" },
        { text: "By Electricity bill / drinking water / sanitation facility maintenance", lf: "3", channel: "BANK" },
        { text: "By First-Aid kit medicines and school safety equipment", lf: "4", channel: "CASH" },
        { text: "By Sports items and recreational play materials purchased", lf: "5", channel: "CASH" },
        { text: "By Statutory Bank Charges / SMS alert charges in SNA Account", lf: "6", channel: "BANK" }
      ]
    },
    sna: {
      RECEIPT: [
        { text: "To Central/State Share SNA Grant received via PFMS limit credit", lf: "1", channel: "BANK" },
        { text: "To Bank Interest / statutory adjustment credited", lf: "2", channel: "BANK" }
      ],
      WITHDRAWAL: [
        { text: "To Bank (Contra - Limit utilized / drawn)", lf: "C", channel: "BANK" }
      ],
      PAYMENT: [
        { text: "By Direct Vendor Payment via PFMS SNA Portal for approved activity", lf: "1", channel: "BANK" },
        { text: "By Statutory Bank charges / deductions in SNA portal", lf: "2", channel: "BANK" }
      ]
    }
  };

  // --- 3. RECONCILIATION MONITOR ENGINE ---
  window.getMandateMetrics = function () {
    const rateLp = parseFloat(document.getElementById('rate-lp')?.value) || 0;
    const mealsLp = parseInt(document.getElementById('meals-lp')?.value, 10) || 0;
    const rateUp = parseFloat(document.getElementById('rate-up')?.value) || 0;
    const mealsUp = parseInt(document.getElementById('meals-up')?.value, 10) || 0;
    const target = (mealsLp * rateLp) + (mealsUp * rateUp);

    // Sum all booked payments strictly assigned to Folio 1
    const booked = window.currentVouchers
      .filter(v => v.type === 'PAYMENT' && String(v.lf).trim() === '1')
      .reduce((acc, v) => acc + (parseFloat(v.amount) || 0), 0);

    return {
      target: target,
      booked: booked,
      deficit: target - booked,
      mealsTotal: mealsLp + mealsUp
    };
  };

  window.updateReconciliationBanner = function () {
    const banner = document.getElementById('recon-status-banner');
    if (!banner) return;

    if (window.currentDrawer !== 'mdm') {
      banner.style.display = 'none';
      return;
    }

    const metrics = window.getMandateMetrics();
    banner.style.display = 'block';

    const fmt = n => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (metrics.target === 0) {
      banner.style.background = '#f1f5f9';
      banner.style.borderColor = '#cbd5e1';
      banner.style.color = '#475569';
      banner.innerHTML = `<strong>Status:</strong> No MDM mandate computed yet. Please input LP/UP rates and meal counts.`;
    } else if (metrics.deficit > 0) {
      banner.style.background = '#eff6ff';
      banner.style.borderColor = '#3b82f6';
      banner.style.color = '#1e40af';
      banner.innerHTML = `Target: <strong>${fmt(metrics.target)}</strong> | Vouchers Booked: <strong>${fmt(metrics.booked)}</strong> | <span style="color:#b91c1c; font-weight:700;">${fmt(metrics.deficit)} is pending.</span> Please provide required vouchers.`;
    } else if (metrics.deficit === 0) {
      banner.style.background = '#f0fdf4';
      banner.style.borderColor = '#22c55e';
      banner.style.color = '#15803d';
      banner.innerHTML = `Target: <strong>${fmt(metrics.target)}</strong> | Vouchers Booked: <strong>${fmt(metrics.booked)}</strong> | <strong>Fully Reconciled & Audit Ready.</strong>`;
    } else {
      banner.style.background = '#fef2f2';
      banner.style.borderColor = '#ef4444';
      banner.style.color = '#b91c1c';
      banner.innerHTML = `<strong>OVER-EXPENDITURE WARNING:</strong> Target: ${fmt(metrics.target)} | Booked: ${fmt(metrics.booked)} | Excess: <strong>${fmt(Math.abs(metrics.deficit))}</strong> exceeds the sanctioned mandate.`;
    }
  };

  // --- 4. DUAL-RATE MANDATE & PARTICULARS ---
  window.calculateMandate = function () {
    const rateLp = parseFloat(document.getElementById('rate-lp')?.value) || 0;
    const mealsLp = parseInt(document.getElementById('meals-lp')?.value, 10) || 0;
    const rateUp = parseFloat(document.getElementById('rate-up')?.value) || 0;
    const mealsUp = parseInt(document.getElementById('meals-up')?.value, 10) || 0;
    const costLp = mealsLp * rateLp;
    const costUp = mealsUp * rateUp;

    const subLp = document.getElementById('subtotal-lp');
    const subUp = document.getElementById('subtotal-up');
    if (subLp) subLp.innerText = costLp.toFixed(2);
    if (subUp) subUp.innerText = costUp.toFixed(2);

    window.updateReconciliationBanner();
    if (window.currentEntryType === 'PAYMENT') {
      window.renderEngineNarrations('PAYMENT');
    }
  };

  function getDynamicNarrationText(item) {
    if (!item.isMealExpense) return item.text;
    const mealsLp = document.getElementById('meals-lp')?.value || '';
    const mealsUp = document.getElementById('meals-up')?.value || '';
    const mTotal = (parseInt(mealsLp, 10) || 0) + (parseInt(mealsUp, 10) || 0);
    const monthEl = document.getElementById('cb-sel-month');
    const yearEl = document.getElementById('cb-sel-year');
    const monthText = monthEl ? monthEl.options[monthEl.selectedIndex]?.text : 'the month';
    const yearText = yearEl ? yearEl.value : '';

    if (mTotal > 0) {
      if (mealsLp && mealsUp) {
        return `By Cooking Cost for ${mTotal} meals (${mealsLp} LP + ${mealsUp} UP) served in the month of ${monthText} ${yearText}`;
      }
      return `By Cooking Cost for ${mTotal} meals served in the month of ${monthText} ${yearText}`;
    }
    return `By Cooking Cost for meals served in the month of ${monthText} ${yearText}`;
  }

  window.renderEngineNarrations = function (type) {
    const drawer = window.currentDrawer || 'mdm';
    const schemaList = (window.ENGINE_SCHEMAS[drawer] && window.ENGINE_SCHEMAS[drawer][type]) || [];
    const container = document.getElementById('narration-quick-options');
    if (!container) return;

    container.innerHTML = '';
    schemaList.forEach((item, index) => {
      const text = getDynamicNarrationText(item);
      const card = document.createElement('div');
      card.style.cssText = 'padding:6px 10px; margin-bottom:5px; background:#fff; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer; font-size:12px; font-weight:500; display:flex; justify-content:space-between; align-items:center;';
      card.innerHTML = `<span>${text}</span> <span style="color:#64748b; font-size:11px; white-space:nowrap; margin-left:8px;">LF: <strong>${item.lf}</strong> [${item.channel}]</span>`;
      
      card.onclick = () => {
        const descEl = document.getElementById('tx-desc');
        const lfEl = document.getElementById('tx-lf');
        const chanEl = document.getElementById('tx-channel');
        if (descEl) descEl.value = text;
        if (lfEl) lfEl.value = item.lf;
        if (chanEl) chanEl.value = item.channel;
      };
      container.appendChild(card);

      if (index === 0 && (!document.getElementById('tx-desc')?.value)) {
        const descEl = document.getElementById('tx-desc');
        const lfEl = document.getElementById('tx-lf');
        const chanEl = document.getElementById('tx-channel');
        if (descEl) descEl.value = text;
        if (lfEl) lfEl.value = item.lf;
        if (chanEl) chanEl.value = item.channel;
      }
    });
  };

  // --- 5. TRANSACTION INGESTION & INTERCEPTION ---
  window.addCompleteTransaction = function () {
    const dateEl = document.getElementById('tx-date');
    const lfEl = document.getElementById('tx-lf');
    const descEl = document.getElementById('tx-desc');
    const amountEl = document.getElementById('tx-amount');
    const channelEl = document.getElementById('tx-channel');

    const date = dateEl ? dateEl.value : '';
    let lf = lfEl ? lfEl.value.trim().toUpperCase() : '';
    const desc = descEl ? descEl.value.trim() : '';
    const amount = amountEl ? parseFloat(amountEl.value) || 0 : 0;
    const channel = channelEl ? channelEl.value : 'CASH';

    if (!date) { alert("Please select a transaction date."); return; }
    if (!desc) { alert("Please provide valid particulars/narration."); return; }
    if (amount <= 0) { alert("Amount must be greater than zero."); return; }

    // Intercept Contra Folio inconsistencies
    if (window.currentEntryType === 'WITHDRAWAL') {
      lf = 'C';
    } else if (lf === 'C' && window.currentEntryType !== 'WITHDRAWAL') {
      alert("Folio 'C' is exclusively reserved for Contra cash withdrawals. Please use the appropriate nominal folio.");
      return;
    }

    // Intercept Cooking Cost Mandate Breaches
    if (window.currentDrawer === 'mdm' && window.currentEntryType === 'PAYMENT' && lf === '1') {
      const metrics = window.getMandateMetrics();
      if (metrics.target > 0 && (metrics.booked + amount) > metrics.target) {
        const excess = (metrics.booked + amount) - metrics.target;
        const proceed = confirm(
          `AUDIT WARNING: Booking this voucher of ₹${amount.toFixed(2)} exceeds the monthly Cooking Cost mandate by ₹${excess.toFixed(2)}.\n\nTarget: ₹${metrics.target.toFixed(2)}\nCurrent Booked: ₹${metrics.booked.toFixed(2)}\n\nDo you want to intercept and correct this entry? Click Cancel to correct.`
        );
        if (!proceed) return;
      }
    }

    window.currentVouchers.push({
      id: Date.now(),
      date: date,
      type: window.currentEntryType,
      channel: channel,
      lf: lf || '1',
      desc: desc,
      amount: amount
    });

    if (descEl) descEl.value = '';
    if (amountEl) amountEl.value = '';
    window.recalculateCashbook();
  };

  window.removeVoucher = function (id) {
    window.currentVouchers = window.currentVouchers.filter(v => String(v.id) !== String(id));
    window.recalculateCashbook();
  };

  // --- 6. SPLIT CURRENCY & ROW BUILDERS ---
  function splitAmount(num) {
    if (num === null || num === undefined || isNaN(num) || num === 0) {
      return { rs: '', p: '' };
    }
    const val = Number(Math.abs(num)).toFixed(2);
    const parts = val.split('.');
    return { rs: parts[0], p: parts[1] };
  }

  function renderRegisterRow(date, particular, lf, cashAmt, bankAmt, isRed) {
    const c = splitAmount(cashAmt);
    const b = splitAmount(bankAmt);
    const tot = (cashAmt || 0) + (bankAmt || 0);
    const t = tot > 0 ? splitAmount(tot) : { rs: '', p: '' };
    const inkClass = isRed ? 'ink-red' : 'ink-black';

    return `
      <tr class="${inkClass}">
        <td class="col-date">${date}</td>
        <td class="col-desc">${particular}</td>
        <td class="col-lf">${lf || '-'}</td>
        <td class="col-rs">${c.rs}</td>
        <td class="col-p">${c.p}</td>
        <td class="col-rs">${b.rs}</td>
        <td class="col-p">${b.p}</td>
        <td class="col-rs">${t.rs}</td>
        <td class="col-p">${t.p}</td>
      </tr>
    `;
  }

  // --- 7. RECALCULATE & STRICT A4 RENDER (RECEIPTS PAGE 1, PAYMENTS PAGE 2) ---
  window.recalculateCashbook = function () {
    const opCash = parseFloat(document.getElementById('cb-op-cash')?.value) || 0;
    const opBank = parseFloat(document.getElementById('cb-op-bank')?.value) || 0;

    let totRecCash = opCash;
    let totRecBank = opBank;
    let totPayCash = 0;
    let totPayBank = 0;

    let receiptsHtml = renderRegisterRow('1st', '<strong>To Opening Balance (O/B)</strong>', '-', opCash, opBank, false);
    let paymentsHtml = '';

    const sortedVouchers = [...window.currentVouchers].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedVouchers.forEach(v => {
      const amt = parseFloat(v.amount) || 0;
      const day = v.date ? parseInt(v.date.split('-')[2], 10) : '-';

      if (v.type === 'RECEIPT') {
        const isBank = v.channel === 'BANK';
        if (isBank) totRecBank += amt; else totRecCash += amt;
        receiptsHtml += renderRegisterRow(day, v.desc, v.lf, !isBank ? amt : 0, isBank ? amt : 0, false);
      } else if (v.type === 'WITHDRAWAL') {
        totRecCash += amt;
        totPayBank += amt;
        receiptsHtml += renderRegisterRow(day, 'To Bank (Contra)', 'C', amt, 0, false);
        paymentsHtml += renderRegisterRow(day, 'By Cash (Contra)', 'C', 0, amt, true);
      } else if (v.type === 'PAYMENT') {
        const isBank = v.channel === 'BANK';
        if (isBank) totPayBank += amt; else totPayCash += amt;
        paymentsHtml += renderRegisterRow(day, v.desc, v.lf, !isBank ? amt : 0, isBank ? amt : 0, true);
      }
    });

    const rawCloseCash = totRecCash - totPayCash;
    const rawCloseBank = totRecBank - totPayBank;

    // Advance deficit handling
    const alertBanner = document.getElementById('advance-consent-banner');
    if (rawCloseCash < 0) {
      window.pendingAdvanceAmount = Math.abs(rawCloseCash);
      if (alertBanner) {
        alertBanner.style.display = 'flex';
        const advDeficitEl = document.getElementById('advance-deficit-amount');
        if (advDeficitEl) advDeficitEl.innerText = window.pendingAdvanceAmount.toFixed(2);
      }
    } else {
      window.pendingAdvanceAmount = 0;
      if (alertBanner) alertBanner.style.display = 'none';
    }

    paymentsHtml += renderRegisterRow('End', '<strong>By Closing Balance (C/B)</strong>', '-', Math.max(0, rawCloseCash), Math.max(0, rawCloseBank), true);

    // Strict row calibration for exact A4 single-page height containment
    const countReceipts = (receiptsHtml.match(/<tr/g) || []).length;
    const countPayments = (paymentsHtml.match(/<tr/g) || []).length;
    const EXACT_PAGE_LINES = 15; // Guarantees header + 15 rows + total row perfectly fills A4 without spilling

    for (let i = countReceipts; i < EXACT_PAGE_LINES; i++) {
      receiptsHtml += `<tr class="empty-line"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
    }
    for (let i = countPayments; i < EXACT_PAGE_LINES; i++) {
      paymentsHtml += `<tr class="empty-line"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
    }

    // Totals line (T/P)
    const tRecCash = splitAmount(totRecCash);
    const tRecBank = splitAmount(totRecBank);
    const tRecTot = splitAmount(totRecCash + totRecBank);

    const grandPayCash = totPayCash + Math.max(0, rawCloseCash);
    const grandPayBank = totPayBank + Math.max(0, rawCloseBank);
    const tPayCash = splitAmount(grandPayCash);
    const tPayBank = splitAmount(grandPayBank);
    const tPayTot = splitAmount(grandPayCash + grandPayBank);

    receiptsHtml += `
      <tr class="total-row ink-black">
        <td></td><td><strong>Total / Balanced (T/P)</strong></td><td></td>
        <td class="col-rs"><strong>${tRecCash.rs}</strong></td><td class="col-p"><strong>${tRecCash.p}</strong></td>
        <td class="col-rs"><strong>${tRecBank.rs}</strong></td><td class="col-p"><strong>${tRecBank.p}</strong></td>
        <td class="col-rs"><strong>${tRecTot.rs}</strong></td><td class="col-p"><strong>${tRecTot.p}</strong></td>
      </tr>
    `;

    paymentsHtml += `
      <tr class="total-row ink-red">
        <td></td><td><strong>Total / Balanced (T/P)</strong></td><td></td>
        <td class="col-rs"><strong>${tPayCash.rs}</strong></td><td class="col-p"><strong>${tPayCash.p}</strong></td>
        <td class="col-rs"><strong>${tPayBank.rs}</strong></td><td class="col-p"><strong>${tPayBank.p}</strong></td>
        <td class="col-rs"><strong>${tPayTot.rs}</strong></td><td class="col-p"><strong>${tPayTot.p}</strong></td>
      </tr>
    `;

    const mEl = document.getElementById('cb-sel-month');
    const yEl = document.getElementById('cb-sel-year');
    const mName = mEl ? mEl.options[mEl.selectedIndex]?.text : '';
    const yName = yEl ? yEl.value : '';

    const area = document.getElementById('cashbook-printable-area');
    if (area) {
      area.innerHTML = `
        <div class="print-container">
          <!-- PAGE 1: RECEIPTS ONLY -->
          <div class="register-page page-receipts">
            <div class="page-header">
              <div class="cashbook-title">CASH BOOK</div>
              <div class="cashbook-subtitle">For the month of ${mName} ${yName}</div>
              <div class="section-indicator text-receipts">RECEIPTS</div>
            </div>
            <table class="ledger-table">
              <thead>
                <tr>
                  <th rowspan="2" class="th-date">Month &<br>Date</th>
                  <th rowspan="2" class="th-particulars">PARTICULARS</th>
                  <th rowspan="2" class="th-lf">Ledger<br>Folio</th>
                  <th colspan="2" class="th-group">Cash Amount</th>
                  <th colspan="2" class="th-group">Bank Amount</th>
                  <th colspan="2" class="th-group">Total Amount</th>
                </tr>
                <tr>
                  <th class="th-sub">Rs.</th><th class="th-sub-p">P.</th>
                  <th class="th-sub">Rs.</th><th class="th-sub-p">P.</th>
                  <th class="th-sub">Rs.</th><th class="th-sub-p">P.</th>
                </tr>
              </thead>
              <tbody>${receiptsHtml}</tbody>
            </table>
          </div>

          <!-- PAGE 2: PAYMENTS ONLY -->
          <div class="register-page page-payments">
            <div class="page-header">
              <div class="cashbook-title">CASH BOOK</div>
              <div class="cashbook-subtitle">For the month of ${mName} ${yName}</div>
              <div class="section-indicator text-payments">PAYMENTS</div>
            </div>
            <table class="ledger-table">
              <thead>
                <tr>
                  <th rowspan="2" class="th-date">Month &<br>Date</th>
                  <th rowspan="2" class="th-particulars">PARTICULARS</th>
                  <th rowspan="2" class="th-lf">Ledger<br>Folio</th>
                  <th colspan="2" class="th-group">Cash Amount</th>
                  <th colspan="2" class="th-group">Bank Amount</th>
                  <th colspan="2" class="th-group">Total Amount</th>
                </tr>
                <tr>
                  <th class="th-sub">Rs.</th><th class="th-sub-p">P.</th>
                  <th class="th-sub">Rs.</th><th class="th-sub-p">P.</th>
                  <th class="th-sub">Rs.</th><th class="th-sub-p">P.</th>
                </tr>
              </thead>
              <tbody>${paymentsHtml}</tbody>
            </table>
          </div>
        </div>
      `;
    }

    window.updateReconciliationBanner();
    window.renderVoucherList();
    window.renderLedgerSheet();
  };

  // --- 8. ISOLATED GENERAL LEDGER ENGINE ---
  window.renderLedgerSheet = function () {
    const filterEl = document.getElementById('sel-filter-ledger');
    const selectedLf = filterEl ? filterEl.value : 'ALL';

    const mEl = document.getElementById('cb-sel-month');
    const yEl = document.getElementById('cb-sel-year');
    const mName = mEl ? mEl.options[mEl.selectedIndex]?.text : '';
    const yName = yEl ? yEl.value : '';

    let headLabel = 'CONSOLIDATED GENERAL LEDGER';
    if (filterEl && filterEl.selectedIndex >= 0) {
      headLabel = filterEl.options[filterEl.selectedIndex].text.toUpperCase();
    }

    let runningBal = 0;
    let totDr = 0;
    let totCr = 0;
    let html = '';

    const list = window.currentVouchers.filter(v => {
      if (!selectedLf || selectedLf === 'ALL') return true;
      return String(v.lf).trim().toUpperCase() === selectedLf.toUpperCase();
    });
    list.sort((a, b) => new Date(a.date) - new Date(b.date));

    list.forEach(v => {
      const amt = parseFloat(v.amount) || 0;
      let dr = 0;
      let cr = 0;

      if (v.type === 'RECEIPT') {
        dr = amt; runningBal += amt; totDr += amt;
      } else if (v.type === 'PAYMENT') {
        cr = amt; runningBal -= amt; totCr += amt;
      } else if (v.type === 'WITHDRAWAL') {
        dr = amt; cr = amt; totDr += amt; totCr += amt;
      }

      html += `
        <tr>
          <td class="text-center">${v.date}</td>
          <td class="text-center">${v.lf || '-'}</td>
          <td>${v.desc}</td>
          <td class="num">${dr > 0 ? '₹' + dr.toFixed(2) : '-'}</td>
          <td class="num">${cr > 0 ? '₹' + cr.toFixed(2) : '-'}</td>
          <td class="num font-bold">₹${runningBal.toFixed(2)}</td>
        </tr>
      `;
    });

    if (list.length === 0) {
      html = `<tr><td colspan="6" style="text-align:center; padding:18px; color:#64748b;">No voucher entries recorded under this account head.</td></tr>`;
    }

    // Render into print-ready standalone container
    const ledgerPrintArea = document.getElementById('ledger-printable-area');
    if (ledgerPrintArea) {
      ledgerPrintArea.innerHTML = `
        <div class="ledger-standalone-page">
          <div class="page-header">
            <div class="cashbook-title">GENERAL LEDGER STATEMENT</div>
            <div class="cashbook-subtitle">${headLabel}</div>
            <div style="font-size:11px; color:#475569; margin-top:2px;">Period: ${mName} ${yName} | Drawer: ${window.currentDrawer.toUpperCase()}</div>
          </div>
          <table class="ledger-table-full">
            <thead>
              <tr>
                <th style="width:75px;">Date</th>
                <th style="width:40px;">Folio</th>
                <th>Particulars / Head Description</th>
                <th style="width:85px; text-align:right;">Debit (Dr)</th>
                <th style="width:85px; text-align:right;">Credit (Cr)</th>
                <th style="width:95px; text-align:right;">Balance</th>
              </tr>
            </thead>
            <tbody>${html}</tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="3" style="text-align:right; font-weight:bold;">Total Cumulative Turnover:</td>
                <td style="text-align:right; font-weight:bold;">₹${totDr.toFixed(2)}</td>
                <td style="text-align:right; font-weight:bold;">₹${totCr.toFixed(2)}</td>
                <td style="text-align:right; font-weight:bold;">₹${runningBal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }
  };

  window.triggerCashbookPrint = function () {
    window.print();
  };

  window.triggerLedgerPrint = function () {
    document.body.classList.add('print-mode-ledger');
    window.print();
    document.body.classList.remove('print-mode-ledger');
  };

  // --- 9. LIFECYCLE BOOTSTRAP ---
  document.addEventListener('DOMContentLoaded', () => {
    if (window.updateCategoryVisibility) window.updateCategoryVisibility();
    window.renderEngineNarrations('RECEIPT');
    window.recalculateCashbook();
  });
})(window);

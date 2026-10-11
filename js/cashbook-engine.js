/**
 * DHK PM POSHAN & SCHOOL CASHBOOK ENGINE (AUDIT-READY SUITE)
 * Dual-Rate LP/UP Engine | Strict 2-Page A4 Isolation | Standalone General Ledger | Multi-Month Archive
 */
(function (window) {
  'use strict';

  // ==========================================================================
  // 1. GLOBAL ENGINE STATE
  // ==========================================================================
  window.currentDrawer = 'mdm';
  window.currentEntryType = 'RECEIPT';
  window.currentVouchers = [];
  window.pendingAdvanceAmount = 0;

  // ==========================================================================
  // 2. STATUTORY FOLIO SCHEMAS (MDM, SMC, SNA)
  // ==========================================================================
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
        { text: "By Reimbursement of In-charge out-of-pocket advance (Ledger Folio 8)", lf: "8", channel: "BANK" }
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

  // ==========================================================================
  // 3. NAVIGATION, DRAWER & VIEW SWITCHERS
  // ==========================================================================
  window.switchDrawer = function (drawer) {
    window.currentDrawer = drawer;
    ['mdm', 'smc', 'sna'].forEach(d => {
      const b = document.getElementById(`btn-drawer-${d}`);
      if (b) {
        if (d === drawer) {
          b.style.background = '#0284c7';
          b.style.color = '#fff';
        } else {
          b.style.background = '#f1f5f9';
          b.style.color = '#334155';
        }
      }
    });

    const mandateBox = document.getElementById('box-mdm-mandate');
    if (mandateBox) mandateBox.style.display = (drawer === 'mdm') ? 'block' : 'none';

    window.renderEngineNarrations(window.currentEntryType);
    window.onCashbookPeriodChange();
    window.updateLedgerHeadFilterOptions();
    window.renderLedgerSheet();
  };

  window.switchSubView = function (view) {
    const cbWrap = document.getElementById('subview-cashbook-wrap');
    const ledWrap = document.getElementById('subview-ledger-wrap');
    const btnCb = document.getElementById('btn-sub-cashbook');
    const btnLed = document.getElementById('btn-sub-ledger');

    if (view === 'cashbook') {
      if (cbWrap) cbWrap.style.display = 'block';
      if (ledWrap) ledWrap.style.display = 'none';
      if (btnCb) { btnCb.style.background = '#1e3a8a'; btnCb.style.color = '#fff'; }
      if (btnLed) { btnLed.style.background = '#f8fafc'; btnLed.style.color = '#334155'; }
    } else {
      if (cbWrap) cbWrap.style.display = 'none';
      if (ledWrap) ledWrap.style.display = 'block';
      if (btnCb) { btnCb.style.background = '#f8fafc'; btnCb.style.color = '#334155'; }
      if (btnLed) { btnLed.style.background = '#1e3a8a'; btnLed.style.color = '#fff'; }
      window.updateLedgerHeadFilterOptions();
      window.renderLedgerSheet();
    }
  };

  window.updateCategoryVisibility = function () {
    const cat = document.getElementById('cb-mandate-cat')?.value || 'COMPOSITE';
    const lpBox = document.getElementById('box-lp');
    const upBox = document.getElementById('box-up');

    if (cat === 'LP') {
      if (lpBox) lpBox.style.display = 'block';
      if (upBox) upBox.style.display = 'none';
      const rUp = document.getElementById('rate-up');
      const mUp = document.getElementById('meals-up');
      if (rUp) rUp.value = '';
      if (mUp) mUp.value = '';
    } else if (cat === 'UP') {
      if (lpBox) lpBox.style.display = 'none';
      if (upBox) upBox.style.display = 'block';
      const rLp = document.getElementById('rate-lp');
      const mLp = document.getElementById('meals-lp');
      if (rLp) rLp.value = '';
      if (mLp) mLp.value = '';
    } else {
      if (lpBox) lpBox.style.display = 'block';
      if (upBox) upBox.style.display = 'block';
    }
    window.calculateMandate();
  };

  // ==========================================================================
  // 4. DUAL-RATE MANDATE & RECONCILIATION MONITOR
  // ==========================================================================
  window.getMandateMetrics = function () {
    const rateLp = parseFloat(document.getElementById('rate-lp')?.value) || 0;
    const mealsLp = parseInt(document.getElementById('meals-lp')?.value, 10) || 0;
    const rateUp = parseFloat(document.getElementById('rate-up')?.value) || 0;
    const mealsUp = parseInt(document.getElementById('meals-up')?.value, 10) || 0;
    const target = (mealsLp * rateLp) + (mealsUp * rateUp);

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
      banner.innerHTML = `<strong>Status:</strong> No MDM mandate computed yet. Please input rates and meal counts.`;
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
      banner.innerHTML = `<strong>OVER-EXPENDITURE WARNING:</strong> Target: ${fmt(metrics.target)} | Booked: ${fmt(metrics.booked)} | Excess: <strong>${fmt(Math.abs(metrics.deficit))}</strong> exceeds the sanctioned limit!`;
    }
  };

  window.calculateMandate = function () {
    const rateLp = parseFloat(document.getElementById('rate-lp')?.value) || 0;
    const mealsLp = parseInt(document.getElementById('meals-lp')?.value, 10) || 0;
    const rateUp = parseFloat(document.getElementById('rate-up')?.value) || 0;
    const mealsUp = parseInt(document.getElementById('meals-up')?.value, 10) || 0;
    const costLp = mealsLp * rateLp;
    const costUp = mealsUp * rateUp;
    const totalMeals = mealsLp + mealsUp;
    const totalCost = costLp + costUp;

    const subLp = document.getElementById('subtotal-lp');
    const subUp = document.getElementById('subtotal-up');
    if (subLp) subLp.innerText = costLp.toFixed(2);
    if (subUp) subUp.innerText = costUp.toFixed(2);

    const mealsDisp = document.getElementById('mandate-meals-display');
    const targetDisp = document.getElementById('mandate-target-display');
    if (mealsDisp) mealsDisp.innerText = totalMeals;
    if (targetDisp) targetDisp.innerText = totalCost.toFixed(2);

    const hiddenMeals = document.getElementById('tx-meals');
    const hiddenTarget = document.getElementById('tx-target-expenditure');
    if (hiddenMeals) hiddenMeals.value = totalMeals;
    if (hiddenTarget) hiddenTarget.value = totalCost.toFixed(2);

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

  window.setTransactionType = function (type) {
    window.currentEntryType = type;
    const btnReceipt = document.getElementById('btn-type-rcpt');
    const btnWithdrawal = document.getElementById('btn-type-with');
    const btnPayment = document.getElementById('btn-type-pmt');
    const channelEl = document.getElementById('tx-channel');

    [btnReceipt, btnWithdrawal, btnPayment].forEach(b => {
      if (b) {
        b.style.opacity = '0.5';
        b.style.borderColor = 'transparent';
      }
    });

    if (type === 'RECEIPT' && btnReceipt) {
      btnReceipt.style.opacity = '1';
      btnReceipt.style.borderColor = '#15803d';
      if (channelEl) channelEl.value = 'BANK';
    } else if (type === 'WITHDRAWAL' && btnWithdrawal) {
      btnWithdrawal.style.opacity = '1';
      btnWithdrawal.style.borderColor = '#0284c7';
      if (channelEl) channelEl.value = 'BANK';
    } else if (type === 'PAYMENT' && btnPayment) {
      btnPayment.style.opacity = '1';
      btnPayment.style.borderColor = '#dc2626';
      if (channelEl) channelEl.value = 'CASH';
    }
    window.renderEngineNarrations(type);
  };

  // ==========================================================================
  // 5. TRANSACTION INGESTION & AUDIT INTERCEPTOR
  // ==========================================================================
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

    if (!date) { alert("Please pick the transaction date."); return; }
    if (!desc) { alert("Please specify the particulars / narration."); return; }
    if (amount <= 0) { alert("Please enter a valid amount greater than 0."); return; }

    if (window.currentEntryType === 'WITHDRAWAL') {
      lf = 'C';
    } else if (lf === 'C' && window.currentEntryType !== 'WITHDRAWAL') {
      alert("Folio 'C' is reserved exclusively for Contra cash withdrawals.");
      return;
    }

    // Intercept Cooking Cost Mandate Breaches
    if (window.currentDrawer === 'mdm' && window.currentEntryType === 'PAYMENT' && (lf === '1' || !lf)) {
      lf = '1';
      const metrics = window.getMandateMetrics();
      if (metrics.target > 0 && (metrics.booked + amount) > metrics.target) {
        const excess = (metrics.booked + amount) - metrics.target;
        const confirmEntry = confirm(
          `AUDIT WARNING: Adding ₹${amount.toFixed(2)} exceeds the monthly Cooking Cost mandate by ₹${excess.toFixed(2)}.\n\nMandate Target: ₹${metrics.target.toFixed(2)}\nCurrent Booked: ₹${metrics.booked.toFixed(2)}\n\nDo you want to intercept and correct this voucher? Press Cancel to return.`
        );
        if (!confirmEntry) return;
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

  // ==========================================================================
  // 6. VOUCHER TRAY LIST RENDERER
  // ==========================================================================
  window.renderVoucherList = function () {
    const listEl = document.getElementById('voucher-tray');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!window.currentVouchers || window.currentVouchers.length === 0) {
      listEl.innerHTML = '<div style="padding:10px; color:#64748b; font-size:12px; text-align:center;">No vouchers added for this period.</div>';
      return;
    }

    window.currentVouchers.forEach(v => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:#fff; border:1px solid #e2e8f0; border-radius:4px; margin-bottom:6px; font-size:12px;';
      const color = v.type === 'RECEIPT' ? '#16a34a' : (v.type === 'WITHDRAWAL' ? '#2563eb' : '#dc2626');
      const day = v.date ? v.date.split('-')[2] : '';

      item.innerHTML = `
        <div>
          <span style="font-weight:700; color:${color}; margin-right:4px;">[${v.type}]</span>
          <strong>${day ? 'Date ' + day : v.date}</strong>: ${v.desc}
          <span style="color:#64748b; font-weight:600;">(LF: ${v.lf})</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <strong>₹${Number(v.amount).toFixed(2)}</strong>
          <button onclick="window.removeVoucher(${v.id})" style="background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; font-size:14px; padding:2px 4px;">✕</button>
        </div>
      `;
      listEl.appendChild(item);
    });
  };

  // ==========================================================================
  // 7. TWO-PAGE STRICT A4 REGISTER BUILDER
  // ==========================================================================
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

    // Check for cash deficits
    const alertBanner = document.getElementById('advance-consent-banner');
    if (rawCloseCash < 0) {
      window.pendingAdvanceAmount = Math.abs(rawCloseCash);
      if (alertBanner) {
        alertBanner.style.display = 'flex';
        const advAmtEl = document.getElementById('advance-deficit-amount');
        if (advAmtEl) advAmtEl.innerText = window.pendingAdvanceAmount.toFixed(2);
      }
    } else {
      window.pendingAdvanceAmount = 0;
      if (alertBanner) alertBanner.style.display = 'none';
    }

    paymentsHtml += renderRegisterRow('End', '<strong>By Closing Balance (C/B)</strong>', '-', Math.max(0, rawCloseCash), Math.max(0, rawCloseBank), true);

    // Exact filler lines to ensure tight A4 single-page height
    const countReceipts = (receiptsHtml.match(/<tr/g) || []).length;
    const countPayments = (paymentsHtml.match(/<tr/g) || []).length;
    const EXACT_PAGE_LINES = 15;

    for (let i = countReceipts; i < EXACT_PAGE_LINES; i++) {
      receiptsHtml += `<tr class="empty-line"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
    }
    for (let i = countPayments; i < EXACT_PAGE_LINES; i++) {
      paymentsHtml += `<tr class="empty-line"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
    }

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
          <!-- PAGE 1: RECEIPTS EXCLUSIVELY -->
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

          <!-- PAGE 2: PAYMENTS EXCLUSIVELY -->
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

    if (typeof window.renderVoucherList === 'function') {
      window.renderVoucherList();
    }
    if (typeof window.renderLedgerSheet === 'function') {
      window.renderLedgerSheet();
    }
    window.updateReconciliationBanner();
  };

  // ==========================================================================
  // 8. DECOUPLED GENERAL LEDGER ENGINE
  // ==========================================================================
  window.updateLedgerHeadFilterOptions = function () {
    const sel = document.getElementById('sel-filter-ledger');
    if (!sel) return;
    const heads = [
      { lf: 'ALL', name: '--- All Heads (Consolidated) ---' },
      { lf: '1', name: 'LF 1: Cooking Cost (Meal Operations)' },
      { lf: '2', name: 'LF 2: LPG Cylinder & Kitchen Fuel' },
      { lf: '3', name: 'LF 3: Cook-cum-Helper Honorarium' },
      { lf: '4', name: 'LF 4: Kitchen Devices & Utensils' },
      { lf: '5', name: 'LF 5: FCI Rice Lifting & Transport / PFMS Grant' },
      { lf: '6', name: 'LF 6: Kitchen Garden & Maintenance' },
      { lf: '7', name: 'LF 7: SNA Bank Charges / SMS Fees' },
      { lf: '8', name: 'LF 8: In-Charge Advance & Reimbursement' },
      { lf: 'C', name: 'LF C: Contra Bank Withdrawals' }
    ];
    const currentVal = sel.value;
    sel.innerHTML = '';
    heads.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.lf;
      opt.innerText = h.name;
      if (h.lf === currentVal) opt.selected = true;
      sel.appendChild(opt);
    });
  };

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

    // Render directly into the standalone ledger container
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
                <th style="width:80px; text-align:center;">Date</th>
                <th style="width:45px; text-align:center;">Folio</th>
                <th>Particulars / Head Description</th>
                <th style="width:95px; text-align:right;">Debit (Dr)</th>
                <th style="width:95px; text-align:right;">Credit (Cr)</th>
                <th style="width:105px; text-align:right;">Balance</th>
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

  // ==========================================================================
  // 9. EXPLICIT PRINT INVOCATION HANDLERS
  // ==========================================================================
  window.triggerCashbookPrint = function () {
    document.body.classList.remove('print-mode-ledger');
    window.print();
  };

  window.triggerLedgerPrint = function () {
    document.body.classList.add('print-mode-ledger');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-mode-ledger');
    }, 800);
  };

  // ==========================================================================
  // 10. TEACHER ADVANCE & MULTI-MONTH PERSISTENCE
  // ==========================================================================
  window.consentTeacherAdvance = function () {
    if (window.pendingAdvanceAmount <= 0) return;
    const dEl = document.getElementById('tx-date');
    const advDate = dEl?.value || new Date().toISOString().split('T')[0];

    window.currentVouchers.push({
      id: Date.now(),
      date: advDate,
      type: 'RECEIPT',
      channel: 'CASH',
      lf: '8',
      desc: 'To Temporary Advance from In-charge/Teacher (Out-of-pocket funding)',
      amount: window.pendingAdvanceAmount
    });

    window.pendingAdvanceAmount = 0;
    const banner = document.getElementById('advance-consent-banner');
    if (banner) banner.style.display = 'none';
    window.recalculateCashbook();
  };

  function getStorageKey(drawer, year, month) {
    return `cashbook_rec_${drawer}_${year}_${String(month).padStart(2, '0')}`;
  }

  window.saveCurrentMonthRecord = function () {
    const drawer = window.currentDrawer;
    const year = document.getElementById('cb-sel-year')?.value;
    const month = document.getElementById('cb-sel-month')?.value;
    const opCash = parseFloat(document.getElementById('cb-op-cash')?.value) || 0;
    const opBank = parseFloat(document.getElementById('cb-op-bank')?.value) || 0;

    let totCashRec = opCash;
    let totBankRec = opBank;
    let totCashPay = 0;
    let totBankPay = 0;

    window.currentVouchers.forEach(v => {
      const a = parseFloat(v.amount) || 0;
      if (v.type === 'RECEIPT') {
        if (v.channel === 'BANK') totBankRec += a; else totCashRec += a;
      } else if (v.type === 'WITHDRAWAL') {
        totCashRec += a; totBankPay += a;
      } else if (v.type === 'PAYMENT') {
        if (v.channel === 'BANK') totBankPay += a; else totCashPay += a;
      }
    });

    const closeCash = Math.max(0, totCashRec - totCashPay);
    const closeBank = Math.max(0, totBankRec - totBankPay);

    const payload = {
      drawer: drawer,
      year: year,
      month: month,
      category: document.getElementById('cb-mandate-cat')?.value,
      rateLp: document.getElementById('rate-lp')?.value,
      mealsLp: document.getElementById('meals-lp')?.value,
      rateUp: document.getElementById('rate-up')?.value,
      mealsUp: document.getElementById('meals-up')?.value,
      opCash: opCash,
      opBank: opBank,
      closeCash: closeCash,
      closeBank: closeBank,
      vouchers: window.currentVouchers,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(getStorageKey(drawer, year, month), JSON.stringify(payload));

    // Carry forward Closing Balance as next month's Opening Balance
    let nextMonth = parseInt(month, 10) + 1;
    let nextYear = parseInt(year, 10);
    if (nextMonth > 12) { nextMonth = 1; nextYear += 1; }

    const nextKey = getStorageKey(drawer, nextYear, nextMonth);
    let nextRec = localStorage.getItem(nextKey);
    nextRec = nextRec ? JSON.parse(nextRec) : {};
    nextRec.opCash = closeCash;
    nextRec.opBank = closeBank;
    localStorage.setItem(nextKey, JSON.stringify(nextRec));

    alert(`Cashbook for ${month}/${year} permanently recorded. C/B carried forward.`);
    window.renderArchiveTray();
  };

  window.onCashbookPeriodChange = function () {
    const year = document.getElementById('cb-sel-year')?.value;
    const month = document.getElementById('cb-sel-month')?.value;
    window.loadMonthRecord(year, month);
  };

  window.loadMonthRecord = function (year, month) {
    const drawer = window.currentDrawer;
    const key = getStorageKey(drawer, year, month);
    const dataStr = localStorage.getItem(key);

    const yEl = document.getElementById('cb-sel-year');
    const mEl = document.getElementById('cb-sel-month');
    if (yEl) yEl.value = year;
    if (mEl) mEl.value = String(month).padStart(2, '0');

    if (dataStr) {
      const data = JSON.parse(dataStr);
      document.getElementById('cb-mandate-cat').value = data.category || 'COMPOSITE';
      document.getElementById('rate-lp').value = data.rateLp || '';
      document.getElementById('meals-lp').value = data.mealsLp || '';
      document.getElementById('rate-up').value = data.rateUp || '';
      document.getElementById('meals-up').value = data.mealsUp || '';
      document.getElementById('cb-op-cash').value = data.opCash !== undefined ? data.opCash : '';
      document.getElementById('cb-op-bank').value = data.opBank !== undefined ? data.opBank : '';
      window.currentVouchers = data.vouchers || [];
    } else {
      let prevM = parseInt(month, 10) - 1;
      let prevY = parseInt(year, 10);
      if (prevM < 1) { prevM = 12; prevY -= 1; }

      const prevKey = getStorageKey(drawer, prevY, prevM);
      const prevDataStr = localStorage.getItem(prevKey);
      if (prevDataStr) {
        const prevData = JSON.parse(prevDataStr);
        document.getElementById('cb-op-cash').value = prevData.closeCash !== undefined ? prevData.closeCash : 0;
        document.getElementById('cb-op-bank').value = prevData.closeBank !== undefined ? prevData.closeBank : 0;
      } else {
        document.getElementById('cb-op-cash').value = '';
        document.getElementById('cb-op-bank').value = '';
      }
      document.getElementById('rate-lp').value = '';
      document.getElementById('meals-lp').value = '';
      document.getElementById('rate-up').value = '';
      document.getElementById('meals-up').value = '';
      window.currentVouchers = [];
    }
    window.updateCategoryVisibility();
    window.recalculateCashbook();
  };

  window.renderArchiveTray = function () {
    const tray = document.getElementById('archive-tray');
    if (!tray) return;
    tray.innerHTML = '';

    const drawer = window.currentDrawer;
    const prefix = `cashbook_rec_${drawer}_`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        try {
          const rec = JSON.parse(localStorage.getItem(key));
          if (!rec.savedAt) continue;
          const card = document.createElement('div');
          card.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#fff; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:6px; font-size:13px;';
          card.innerHTML = `
            <div>
              <strong>${rec.month}/${rec.year}</strong> 
              <span style="color:#64748b; font-size:11px;">(C/B Cash: ₹${Number(rec.closeCash).toFixed(2)} | Bank: ₹${Number(rec.closeBank).toFixed(2)})</span>
            </div>
            <div>
              <button onclick="loadMonthRecord('${rec.year}', '${rec.month}')" style="background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">View</button>
              <button onclick="deleteRecord('${key}')" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px; margin-left:4px;">Delete</button>
            </div>
          `;
          tray.appendChild(card);
        } catch (e) {}
      }
    }
  };

  window.deleteRecord = function (key) {
    if (confirm("Are you sure you want to delete this saved month's permanent record?")) {
      localStorage.removeItem(key);
      window.renderArchiveTray();
    }
  };

  // ==========================================================================
  // 11. BOOTSTRAP INITIALIZATION
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    window.updateCategoryVisibility();
    window.setTransactionType('RECEIPT');
    window.updateLedgerHeadFilterOptions();
    window.renderArchiveTray();
    window.recalculateCashbook();
  });
})(window);

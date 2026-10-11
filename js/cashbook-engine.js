/**
 * DHK PM POSHAN & SCHOOL CASHBOOK ENGINE - REVISED & FLAWLESS
 * Dual-Rate LP/UP Engine | Two-Page Ruled Register | Dynamic General Ledger | Budget Cap Guard
 */
(function (window) {
  'use strict';

  // --- 1. APPLICATION STATE ---
  window.currentDrawer = 'mdm';
  window.currentEntryType = 'RECEIPT';
  window.currentVouchers = [];
  window.pendingAdvanceAmount = 0;

  // --- 2. STATUTORY SCHEMAS ---
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
        { text: "By Cooking Cost for daily meal marketing & ingredients", lf: "1", channel: "CASH", isMealExpense: true },
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

  // --- 3. DRAWER SWITCH ---
  window.switchDrawer = function (drawer) {
    window.currentDrawer = drawer;
    ['mdm', 'smc', 'sna'].forEach(d => {
      const b = document.getElementById(`btn-drawer-${d}`);
      if (b) {
        b.style.background = (d === drawer) ? '#0284c7' : '#f1f5f9';
        b.style.color = (d === drawer) ? '#fff' : '#334155';
      }
    });

    const mandateBox = document.getElementById('box-mdm-mandate');
    if (mandateBox) mandateBox.style.display = (drawer === 'mdm') ? 'block' : 'none';

    window.renderEngineNarrations(window.currentEntryType);
    window.onCashbookPeriodChange();
    window.updateLedgerHeadFilterOptions();
    window.renderLedgerSheet();
    window.updateVoucherBudgetMonitor();
  };

  // --- 4. SUB-VIEW TOGGLE ---
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

  // --- 5. CATEGORY VISIBILITY ---
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

  // --- 6. MANDATE & BUDGET CALCULATIONS ---
  window.calculateMandate = function () {
    const rateLp = parseFloat(document.getElementById('rate-lp')?.value) || 0;
    const mealsLp = parseInt(document.getElementById('meals-lp')?.value, 10) || 0;
    const rateUp = parseFloat(document.getElementById('rate-up')?.value) || 0;
    const mealsUp = parseInt(document.getElementById('meals-up')?.value, 10) || 0;

    const costLp = mealsLp * rateLp;
    const costUp = mealsUp * rateUp;
    const totalMeals = mealsLp + mealsUp;
    const totalTargetCost = costLp + costUp;

    const subLp = document.getElementById('subtotal-lp');
    const subUp = document.getElementById('subtotal-up');
    if (subLp) subLp.innerText = costLp.toFixed(2);
    if (subUp) subUp.innerText = costUp.toFixed(2);

    const mealsDisp = document.getElementById('mandate-meals-display');
    const targetDisp = document.getElementById('mandate-target-display');
    if (mealsDisp) mealsDisp.innerText = totalMeals;
    if (targetDisp) targetDisp.innerText = totalTargetCost.toFixed(2);

    const hiddenMeals = document.getElementById('tx-meals');
    const hiddenTarget = document.getElementById('tx-target-expenditure');
    if (hiddenMeals) hiddenMeals.value = totalMeals;
    if (hiddenTarget) hiddenTarget.value = totalTargetCost.toFixed(2);

    window.updateVoucherBudgetMonitor();
  };

  // --- 7. EXPENDITURE MONITOR & WARNING FEATURE ---
  window.updateVoucherBudgetMonitor = function () {
    let monitorBox = document.getElementById('expenditure-budget-monitor');
    if (!monitorBox) {
      const entryForm = document.getElementById('tx-amount')?.closest('form') || document.getElementById('tx-amount')?.parentElement;
      if (entryForm) {
        monitorBox = document.createElement('div');
        monitorBox.id = 'expenditure-budget-monitor';
        monitorBox.style.cssText = 'margin:10px 0; padding:10px; border-radius:6px; font-size:12px; font-weight:600;';
        entryForm.parentNode.insertBefore(monitorBox, entryForm.nextSibling);
      }
    }
    if (!monitorBox) return;

    if (window.currentDrawer !== 'mdm') {
      monitorBox.style.display = 'none';
      return;
    }
    monitorBox.style.display = 'block';

    const targetCost = parseFloat(document.getElementById('tx-target-expenditure')?.value) || 0;
    const totalMealExpenses = window.currentVouchers
      .filter(v => v.type === 'PAYMENT' && (v.lf === '1' || v.isMealExpense))
      .reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);

    const enteredAmount = parseFloat(document.getElementById('tx-amount')?.value) || 0;
    const isAddingPayment = window.currentEntryType === 'PAYMENT';
    const prospectiveTotal = totalMealExpenses + (isAddingPayment ? enteredAmount : 0);
    const remaining = targetCost - totalMealExpenses;

    if (targetCost <= 0) {
      monitorBox.style.background = '#f8fafc';
      monitorBox.style.border = '1px solid #cbd5e1';
      monitorBox.style.color = '#475569';
      monitorBox.innerHTML = `<span>Mandate Target not defined. Set rates and meal targets above to monitor budget.</span>`;
      return;
    }

    if (prospectiveTotal > targetCost) {
      const excess = prospectiveTotal - targetCost;
      monitorBox.style.background = '#fef2f2';
      monitorBox.style.border = '1.5px solid #ef4444';
      monitorBox.style.color = '#b91c1c';
      monitorBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>⚠️ <strong>BUDGET EXCEEDED!</strong> Meal Expenses (₹${prospectiveTotal.toFixed(2)}) exceed Mandate Target (₹${targetCost.toFixed(2)}) by <strong>₹${excess.toFixed(2)}</strong>!</span>
        </div>
      `;
    } else {
      monitorBox.style.background = '#f0fdf4';
      monitorBox.style.border = '1.5px solid #22c55e';
      monitorBox.style.color = '#15803d';
      monitorBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>Target: <strong>₹${targetCost.toFixed(2)}</strong> | Current Spent: <strong>₹${totalMealExpenses.toFixed(2)}</strong></span>
          <span>Remaining Balance: <strong>₹${remaining.toFixed(2)}</strong></span>
        </div>
      `;
    }
  };

  // --- 8. NARRATIONS & FORM SYNC ---
  window.renderEngineNarrations = function (type) {
    const drawer = window.currentDrawer || 'mdm';
    const schemaList = (window.ENGINE_SCHEMAS[drawer] && window.ENGINE_SCHEMAS[drawer][type])
      ? window.ENGINE_SCHEMAS[drawer][type]
      : [];
    const container = document.getElementById('narration-quick-options');
    if (!container) return;

    container.innerHTML = '';
    schemaList.forEach((item, index) => {
      const card = document.createElement('div');
      card.style.cssText = 'padding:6px 10px; margin-bottom:6px; background:#fff; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer; font-size:12px; font-weight:500; display:flex; justify-content:space-between; align-items:center;';
      card.innerHTML = `<span>${item.text}</span> <span style="color:#64748b; font-size:11px;">LF:${item.lf} [${item.channel}]</span>`;
      card.onclick = () => {
        const descEl = document.getElementById('tx-desc');
        const lfEl = document.getElementById('tx-lf');
        const chanEl = document.getElementById('tx-channel');
        if (descEl) descEl.value = item.text;
        if (lfEl) lfEl.value = item.lf;
        if (chanEl) chanEl.value = item.channel;
        window.updateVoucherBudgetMonitor();
      };
      container.appendChild(card);

      if (index === 0) {
        const descEl = document.getElementById('tx-desc');
        const lfEl = document.getElementById('tx-lf');
        const chanEl = document.getElementById('tx-channel');
        if (descEl) descEl.value = item.text;
        if (lfEl) lfEl.value = item.lf;
        if (chanEl) chanEl.value = item.channel;
      }
    });
  };

  // --- 9. TRANSACTION TYPE SELECTION ---
  window.setTransactionType = function (type) {
    window.currentEntryType = type;
    const btnReceipt = document.getElementById('btn-type-rcpt');
    const btnWithdrawal = document.getElementById('btn-type-with');
    const btnPayment = document.getElementById('btn-type-pmt');
    const channelEl = document.getElementById('tx-channel');

    [btnReceipt, btnWithdrawal, btnPayment].forEach(b => {
      if (b) { b.style.opacity = '0.5'; b.style.borderColor = 'transparent'; }
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
    window.updateVoucherBudgetMonitor();
  };

  window.addCompleteTransaction = function () {
    const dateEl = document.getElementById('tx-date');
    const lfEl = document.getElementById('tx-lf');
    const descEl = document.getElementById('tx-desc');
    const amountEl = document.getElementById('tx-amount');
    const channelEl = document.getElementById('tx-channel');

    const date = dateEl ? dateEl.value : '';
    const desc = descEl ? descEl.value.trim() : '';
    const amount = amountEl ? parseFloat(amountEl.value) || 0 : 0;
    const channel = channelEl ? channelEl.value : (window.currentEntryType === 'PAYMENT' ? 'CASH' : 'BANK');

    let defaultLf = '1';
    if (window.currentEntryType === 'WITHDRAWAL') defaultLf = 'C';
    else if (window.currentEntryType === 'RECEIPT') defaultLf = channel === 'CASH' ? '8' : '5';
    const lf = (lfEl && lfEl.value.trim()) ? lfEl.value.trim() : defaultLf;

    if (!date) { alert("Please pick the date of transaction."); return; }
    if (!desc) { alert("Please specify the particulars / narration."); return; }
    if (amount <= 0) { alert("Please enter a valid amount greater than 0."); return; }

    // Cap Check & Confirmation
    const targetCost = parseFloat(document.getElementById('tx-target-expenditure')?.value) || 0;
    if (window.currentDrawer === 'mdm' && window.currentEntryType === 'PAYMENT' && targetCost > 0) {
      const currentExpenses = window.currentVouchers
        .filter(v => v.type === 'PAYMENT' && (v.lf === '1' || v.isMealExpense))
        .reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);

      if ((currentExpenses + amount) > targetCost) {
        const proceed = confirm(`Warning: Adding this voucher of ₹${amount.toFixed(2)} brings total cooking expenses to ₹${(currentExpenses + amount).toFixed(2)}, which exceeds the monthly target of ₹${targetCost.toFixed(2)}. Do you still want to add it?`);
        if (!proceed) return;
      }
    }

    window.currentVouchers.push({
      id: Date.now(),
      date: date,
      type: window.currentEntryType,
      channel: channel,
      lf: (window.currentEntryType === 'WITHDRAWAL') ? 'C' : lf,
      desc: desc,
      amount: amount,
      isMealExpense: (lf === '1' || desc.toLowerCase().includes('cooking cost'))
    });

    if (descEl) descEl.value = '';
    if (amountEl) amountEl.value = '';
    window.recalculateCashbook();
    window.updateVoucherBudgetMonitor();
  };

  window.removeVoucher = function (id) {
    window.currentVouchers = window.currentVouchers.filter(v => String(v.id) !== String(id));
    window.recalculateCashbook();
    window.updateVoucherBudgetMonitor();
  };

  // --- 10. TWO-PAGE PHYSICAL REGISTER BUILDER ---
  function splitAmount(num) {
    if (num === null || num === undefined || isNaN(num) || num === 0) {
      return { rs: '-', p: '--' };
    }
    const val = Number(Math.abs(num)).toFixed(2);
    const parts = val.split('.');
    return { rs: parts[0], p: parts[1] };
  }

  function renderRegisterRow(date, particular, lf, cashAmt, bankAmt, isRed) {
    const c = splitAmount(cashAmt);
    const b = splitAmount(bankAmt);
    const tot = (cashAmt || 0) + (bankAmt || 0);
    const t = tot > 0 ? splitAmount(tot) : { rs: '-', p: '--' };
    const inkClass = isRed ? 'ink-red' : 'ink-black';
    return `
      <tr class="${inkClass}" style="color:${isRed ? '#b91c1c' : '#0f172a'};">
        <td class="col-date" style="border:1px solid #94a3b8; text-align:center; padding:4px;">${date}</td>
        <td class="col-desc" style="border:1px solid #94a3b8; padding:4px;">${particular}</td>
        <td class="col-lf" style="border:1px solid #94a3b8; text-align:center; padding:4px;">${lf}</td>
        <td class="col-rs" style="border:1px solid #94a3b8; text-align:right; padding:4px;">${c.rs}</td>
        <td class="col-p" style="border:1px solid #94a3b8; text-align:center; padding:4px; font-size:10px;">${c.p}</td>
        <td class="col-rs" style="border:1px solid #94a3b8; text-align:right; padding:4px;">${b.rs}</td>
        <td class="col-p" style="border:1px solid #94a3b8; text-align:center; padding:4px; font-size:10px;">${b.p}</td>
        <td class="col-rs" style="border:1px solid #94a3b8; text-align:right; padding:4px;">${t.rs}</td>
        <td class="col-p" style="border:1px solid #94a3b8; text-align:center; padding:4px; font-size:10px;">${t.p}</td>
      </tr>
    `;
  }

  window.recalculateCashbook = function () {
    const opCashEl = document.getElementById('cb-op-cash');
    const opBankEl = document.getElementById('cb-op-bank');
    const opCash = opCashEl ? parseFloat(opCashEl.value) || 0 : 0;
    const opBank = opBankEl ? parseFloat(opBankEl.value) || 0 : 0;

    let totRecCash = opCash;
    let totRecBank = opBank;
    let totPayCash = 0;
    let totPayBank = 0;

    let receiptsHtml = renderRegisterRow('1st', '<strong>To O/B</strong>', '-', opCash, opBank, false);
    let paymentsHtml = '';

    window.currentVouchers.sort((a, b) => new Date(a.date) - new Date(b.date));

    window.currentVouchers.forEach(v => {
      const amt = parseFloat(v.amount) || 0;
      const day = v.date ? parseInt(v.date.split('-')[2], 10) : '-';

      if (v.type === 'RECEIPT') {
        const isBank = v.channel === 'BANK';
        if (isBank) totRecBank += amt;
        else totRecCash += amt;
        receiptsHtml += renderRegisterRow(day, v.desc, v.lf, !isBank ? amt : 0, isBank ? amt : 0, false);
      } else if (v.type === 'WITHDRAWAL') {
        totRecCash += amt;
        totPayBank += amt;
        receiptsHtml += renderRegisterRow(day, 'To Bank (Contra)', 'C', amt, 0, false);
        paymentsHtml += renderRegisterRow(day, 'By Cash (Contra)', 'C', 0, amt, true);
      } else if (v.type === 'PAYMENT') {
        const isBank = v.channel === 'BANK';
        if (isBank) totPayBank += amt;
        else totPayCash += amt;
        paymentsHtml += renderRegisterRow(day, v.desc, v.lf, !isBank ? amt : 0, isBank ? amt : 0, true);
      }
    });

    const rawCloseCash = totRecCash - totPayCash;
    const rawCloseBank = totRecBank - totPayBank;

    const alertBanner = document.getElementById('advance-cons

        const alertBanner = document.getElementById('advance-consent-banner');
    if (rawCloseCash < 0) {
      window.pendingAdvanceAmount = Math.abs(rawCloseCash);
      if (alertBanner) {
        alertBanner.style.display = 'flex';
        const defAmt = document.getElementById('advance-deficit-amount');
        if (defAmt) defAmt.innerText = window.pendingAdvanceAmount.toFixed(2);
      }
    } else {
      window.pendingAdvanceAmount = 0;
      if (alertBanner) alertBanner.style.display = 'none';
    }

    // 3. By C/B Row (Payments in Red Ink)
    paymentsHtml += renderRegisterRow('End', '<strong>By C/B</strong>', '-', rawCloseCash > 0 ? rawCloseCash : 0, rawCloseBank > 0 ? rawCloseBank : 0, true);

    // 4. Fill Ruled Empty Ledger Lines (Audit-Grade Symmetrical Spacing)
    const receiptRowsCount = (receiptsHtml.match(/<tr/g) || []).length;
    const paymentRowsCount = (paymentsHtml.match(/<tr/g) || []).length;
    const targetRows = Math.max(18, receiptRowsCount, paymentRowsCount);

    for (let i = receiptRowsCount; i < targetRows; i++) {
      receiptsHtml += `<tr class="empty-line" style="height:28px;"><td style="border:1px solid #94a3b8; text-align:center;">&nbsp;</td><td style="border:1px solid #94a3b8;"></td><td style="border:1px solid #94a3b8;"></td><td style="border:1px solid #94a3b8;"></td><td style="border:1px solid #94a3b8;"></td><td style="border:1px solid #94a3b8;"></td><td style="border:1px solid #94a3b8;"></td><td style="border:1px solid #94a3b8;"></td><td style="border:1px solid #94a3b8;"></td></tr>`;
    }

    for (let i = paymentRowsCount; i < targetRows; i++) {
      paymentsHtml += `<tr class="empty-line" style="height:28px;"><td style="border:1px solid #94a3b8; text-align:center;">&nbsp;</td><td style="border:1px solid #94a3b8;"></td><td style="border:1px solid #94a3b8;"></td><td style="border:1px solid #94a3b8;"></td><td style="border:1px solid #94a3b8;"></td><td style="border:1px solid #94a3b8;"></td><td style="border:1px solid #94a3b8;"></td><td style="border:1px solid #94a3b8;"></td><td style="border:1px solid #94a3b8;"></td></tr>`;
    }

    // 5. Total Lines (T/P)
    const tRecCash = splitAmount(totRecCash);
    const tRecBank = splitAmount(totRecBank);
    const tRecTot = splitAmount(totRecCash + totRecBank);

    const grandPayCash = totPayCash + (rawCloseCash > 0 ? rawCloseCash : 0);
    const grandPayBank = totPayBank + (rawCloseBank > 0 ? rawCloseBank : 0);
    const tPayCash = splitAmount(grandPayCash);
    const tPayBank = splitAmount(grandPayBank);
    const tPayTot = splitAmount(grandPayCash + grandPayBank);

    receiptsHtml += `
      <tr class="total-row ink-black" style="font-weight:bold; background:#f8fafc; border-top:2px solid #000; border-bottom:3px double #000;">
        <td style="border:1px solid #000; text-align:center;"></td>
        <td style="border:1px solid #000;"><strong>T/P</strong></td>
        <td style="border:1px solid #000; text-align:center;"></td>
        <td class="col-rs" style="border:1px solid #000; text-align:right; padding:4px;"><strong>${tRecCash.rs}</strong></td>
        <td class="col-p" style="border:1px solid #000; text-align:center; padding:4px; font-size:10px;"><strong>${tRecCash.p}</strong></td>
        <td class="col-rs" style="border:1px solid #000; text-align:right; padding:4px;"><strong>${tRecBank.rs}</strong></td>
        <td class="col-p" style="border:1px solid #000; text-align:center; padding:4px; font-size:10px;"><strong>${tRecBank.p}</strong></td>
        <td class="col-rs" style="border:1px solid #000; text-align:right; padding:4px;"><strong>${tRecTot.rs}</strong></td>
        <td class="col-p" style="border:1px solid #000; text-align:center; padding:4px; font-size:10px;"><strong>${tRecTot.p}</strong></td>
      </tr>
    `;

    paymentsHtml += `
      <tr class="total-row ink-red" style="font-weight:bold; color:#b91c1c; background:#f8fafc; border-top:2px solid #000; border-bottom:3px double #000;">
        <td style="border:1px solid #000; text-align:center;"></td>
        <td style="border:1px solid #000;"><strong>T/P</strong></td>
        <td style="border:1px solid #000; text-align:center;"></td>
        <td class="col-rs" style="border:1px solid #000; text-align:right; padding:4px;"><strong>${tPayCash.rs}</strong></td>
        <td class="col-p" style="border:1px solid #000; text-align:center; padding:4px; font-size:10px;"><strong>${tPayCash.p}</strong></td>
        <td class="col-rs" style="border:1px solid #000; text-align:right; padding:4px;"><strong>${tPayBank.rs}</strong></td>
        <td class="col-p" style="border:1px solid #000; text-align:center; padding:4px; font-size:10px;"><strong>${tPayBank.p}</strong></td>
        <td class="col-rs" style="border:1px solid #000; text-align:right; padding:4px;"><strong>${tPayTot.rs}</strong></td>
        <td class="col-p" style="border:1px solid #000; text-align:center; padding:4px; font-size:10px;"><strong>${tPayTot.p}</strong></td>
      </tr>
    `;

    // 6. Header Metadata
    const mEl = document.getElementById('cb-sel-month');
    const yEl = document.getElementById('cb-sel-year');
    const mName = mEl ? mEl.options[mEl.selectedIndex]?.text : 'Current Month';
    const yName = yEl ? yEl.value : '2026';

    const area = document.getElementById('cashbook-printable-area');
    if (area) {
      area.innerHTML = `
        <div class="register-spread" style="display:flex; flex-direction:row; justify-content:space-between; gap:16px; background:#fff; width:100%; box-sizing:border-box;">
          
          <!-- LEFT PAGE: RECEIPTS (BLACK INK) -->
          <div class="register-page" style="flex:1 1 50%; width:50%; background:#fff; border:1px solid #64748b; padding:12px; box-sizing:border-box;">
            <div style="text-align:center; margin-bottom:8px;">
              <h3 style="margin:0; font-size:16px; text-transform:uppercase; font-weight:800; color:#0f172a;">Cash Book — Receipts</h3>
              <div style="font-size:12px; font-weight:600; color:#334155;">For the month of ${mName} ${yName}</div>
            </div>
            <table class="ledger-table" style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:11px;">
              <thead>
                <tr style="background:#f1f5f9; text-align:center;">
                  <th rowspan="2" style="border:1px solid #64748b; width:34px; padding:4px;">Date</th>
                  <th rowspan="2" style="border:1px solid #64748b; padding:4px;">PARTICULARS</th>
                  <th rowspan="2" style="border:1px solid #64748b; width:26px; padding:4px;">L.F.</th>
                  <th colspan="2" style="border:1px solid #64748b; width:68px; padding:4px;">Cash Amount</th>
                  <th colspan="2" style="border:1px solid #64748b; width:72px; padding:4px;">Bank Amount</th>
                  <th colspan="2" style="border:1px solid #64748b; width:72px; padding:4px;">Total Amount</th>
                </tr>
                <tr style="background:#f1f5f9; text-align:center;">
                  <th style="border:1px solid #64748b; width:46px; padding:2px;">Rs.</th>
                  <th style="border:1px solid #64748b; width:22px; padding:2px;">P.</th>
                  <th style="border:1px solid #64748b; width:50px; padding:2px;">Rs.</th>
                  <th style="border:1px solid #64748b; width:22px; padding:2px;">P.</th>
                  <th style="border:1px solid #64748b; width:50px; padding:2px;">Rs.</th>
                  <th style="border:1px solid #64748b; width:22px; padding:2px;">P.</th>
                </tr>
              </thead>
              <tbody>${receiptsHtml}</tbody>
            </table>
          </div>

          <!-- RIGHT PAGE: PAYMENTS (RED INK) -->
          <div class="register-page" style="flex:1 1 50%; width:50%; background:#fff; border:1px solid #64748b; padding:12px; box-sizing:border-box;">
            <div style="text-align:center; margin-bottom:8px;">
              <h3 style="margin:0; font-size:16px; text-transform:uppercase; font-weight:800; color:#b91c1c;">Cash Book — Payments</h3>
              <div style="font-size:12px; font-weight:600; color:#334155;">For the month of ${mName} ${yName}</div>
            </div>
            <table class="ledger-table" style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:11px;">
              <thead>
                <tr style="background:#f1f5f9; text-align:center;">
                  <th rowspan="2" style="border:1px solid #64748b; width:34px; padding:4px;">Date</th>
                  <th rowspan="2" style="border:1px solid #64748b; padding:4px;">PARTICULARS</th>
                  <th rowspan="2" style="border:1px solid #64748b; width:26px; padding:4px;">L.F.</th>
                  <th colspan="2" style="border:1px solid #64748b; width:68px; padding:4px;">Cash Amount</th>
                  <th colspan="2" style="border:1px solid #64748b; width:72px; padding:4px;">Bank Amount</th>
                  <th colspan="2" style="border:1px solid #64748b; width:72px; padding:4px;">Total Amount</th>
                </tr>
                <tr style="background:#f1f5f9; text-align:center;">
                  <th style="border:1px solid #64748b; width:46px; padding:2px;">Rs.</th>
                  <th style="border:1px solid #64748b; width:22px; padding:2px;">P.</th>
                  <th style="border:1px solid #64748b; width:50px; padding:2px;">Rs.</th>
                  <th style="border:1px solid #64748b; width:22px; padding:2px;">P.</th>
                  <th style="border:1px solid #64748b; width:50px; padding:2px;">Rs.</th>
                  <th style="border:1px solid #64748b; width:22px; padding:2px;">P.</th>
                </tr>
              </thead>
              <tbody>${paymentsHtml}</tbody>
            </table>
          </div>

        </div>
      `;
    }

    window.renderVoucherTrayList();
    window.renderLedgerSheet();
  };
  // --- 11. VOUCHER TRAY LIST ---
  window.renderVoucherList = window.renderVoucherTrayList = function () {
    const list = document.getElementById('voucher-list');
    if (!list) return;

    if (!window.currentVouchers || window.currentVouchers.length === 0) {
      list.innerHTML = '<div style="color:#64748b; text-align:center; padding:12px; font-size:13px;">No vouchers recorded for this month yet.</div>';
      return;
    }

    list.innerHTML = window.currentVouchers.map(v => {
      const typeColor = v.type === 'PAYMENT' ? '#dc2626' : (v.type === 'RECEIPT' ? '#15803d' : '#0284c7');
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:8px 12px; margin-bottom:6px; border:1px solid #e2e8f0; border-radius:4px; font-size:12px;">
          <div>
            <span style="font-weight:700; color:#0f172a;">${v.date}</span> &bull; 
            <span style="color:${typeColor}; font-weight:700;">[${v.type}]</span> 
            <span>${v.desc}</span> 
            <span style="color:#64748b;">(LF: ${v.lf} | ${v.channel})</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-weight:700; font-size:13px;">₹${Number(v.amount).toFixed(2)}</span>
            <button onclick="window.removeVoucher('${v.id}')" style="background:#fee2e2; color:#b91c1c; border:none; padding:3px 8px; border-radius:4px; cursor:pointer; font-weight:bold;">&times;</button>
          </div>
        </div>
      `;
    }).join('');
  };
  
  // --- 12. GENERAL LEDGER ENGINE ---
  window.updateLedgerHeadFilterOptions = function () {
    const filterSelect = document.getElementById('sel-filter-ledger');
    if (!filterSelect) return;

    const drawer = window.currentDrawer || 'mdm';
    const schema = window.ENGINE_SCHEMAS[drawer] || {};
    const seenLfs = new Set();
    const options = ['<option value="ALL">-- ALL LEDGER FOLIO HEADS --</option>'];

    ['RECEIPT', 'PAYMENT'].forEach(type => {
      (schema[type] || []).forEach(item => {
        if (item.lf && !seenLfs.has(item.lf) && item.lf !== 'C') {
          seenLfs.add(item.lf);
          options.push(`<option value="${item.lf}">LF ${item.lf}: ${item.text.replace(/^(To|By)\s+/i, '')}</option>`);
        }
      });
    });

    filterSelect.innerHTML = options.join('');
  };

  window.renderLedgerSheet = function () {
    const tbody = document.getElementById('led-tbody');
    if (!tbody) return;

    const filterLf = document.getElementById('sel-filter-ledger')?.value || 'ALL';
    let runningBalance = 0;
    let rowsHtml = '';

    const eligible = window.currentVouchers.filter(v => {
      if (v.lf === 'C' || v.type === 'WITHDRAWAL') return false;
      if (filterLf !== 'ALL' && String(v.lf) !== String(filterLf)) return false;
      return true;
    });

    if (eligible.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:16px; color:#64748b;">No ledger entries found for Folio: ${filterLf}</td></tr>`;
      return;
    }

    eligible.forEach(v => {
      const amt = parseFloat(v.amount) || 0;
      let dr = 0;
      let cr = 0;

      if (v.type === 'RECEIPT') {
        dr = amt;
        runningBalance += amt;
      } else if (v.type === 'PAYMENT') {
        cr = amt;
        runningBalance -= amt;
      }

      rowsHtml += `
        <tr style="border-bottom:1px solid #cbd5e1; font-size:12px;">
          <td style="padding:6px; text-align:center;">${v.date}</td>
          <td style="padding:6px;">${v.desc}</td>
          <td style="padding:6px; text-align:center; font-weight:bold;">${v.lf}</td>
          <td style="padding:6px; text-align:center;">${v.channel}</td>
          <td style="padding:6px; text-align:right; color:#15803d; font-weight:600;">${dr > 0 ? dr.toFixed(2) : '-'}</td>
          <td style="padding:6px; text-align:right; color:#b91c1c; font-weight:600;">${cr > 0 ? cr.toFixed(2) : '-'}</td>
          <td style="padding:6px; text-align:right; font-weight:700;">₹${runningBalance.toFixed(2)}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  };

  // --- 13. PERIOD CHANGE & INITIALIZATION ---
  window.onCashbookPeriodChange = function () {
    window.calculateMandate();
    window.recalculateCashbook();
  };

  // --- 14. ISOLATED AUDIT PRINT ENGINE ---
  window.printAuditDocument = function (elementId) {
    const target = document.getElementById(elementId);
    if (!target) {
      alert('Printable section not found.');
      return;
    }

    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);

    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Statutory Audit Document</title>
          <style>
            @page { size: A4 landscape; margin: 8mm 6mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 0; background: #fff; }
            .register-spread { display: flex !important; flex-direction: row !important; justify-content: space-between !important; gap: 8mm !important; width: 100% !important; }
            .register-page { width: 49% !important; box-sizing: border-box !important; }
            table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
            th, td { border: 1px solid #475569 !important; padding: 4px 2px !important; font-size: 11px !important; overflow: hidden !important; }
            .col-rs { text-align: right !important; }
            .col-p { text-align: center !important; font-size: 10px !important; }
            .ink-red td { color: #b91c1c !important; }
            .ink-black td { color: #0f172a !important; }
            .total-row td { font-weight: bold !important; border-top: 2px solid #000 !important; border-bottom: 3px double #000 !important; background: #f8fafc !important; }
          </style>
        </head>
        <body>
          ${target.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => document.body.removeChild(frame), 1500);
    }, 400);
  };

  // --- 15. AUTO BOOTSTRAP ---
  document.addEventListener('DOMContentLoaded', () => {
    window.switchDrawer('mdm');
    window.setTransactionType('RECEIPT');
  });

})(window);
                                         
                                                

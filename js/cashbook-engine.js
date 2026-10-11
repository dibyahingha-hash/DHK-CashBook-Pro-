/**
 * DHK PM POSHAN & SCHOOL CASHBOOK STANDALONE ENGINE
 * Zero dependencies | Audit Compliant | Two-Page Physical Register Model
 */

(function (window) {
  'use strict';

  // --- STATE ---
  window.currentDrawer = 'mdm';
  window.currentEntryType = 'RECEIPT';
  window.currentVouchers = [];
  window.pendingAdvanceAmount = 0;

  // --- STATUTORY SCHEMAS ---
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
    }
  };

  // --- 1. CATEGORY & VISIBILITY ---
  window.updateCategoryVisibility = function () {
    const cat = document.getElementById('school-category')?.value || 'COMPOSITE';
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

  // --- 2. DUAL-RATE MANDATE ENGINE (COMPOSITE / LP / UP) ---
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

    if (window.currentEntryType === 'PAYMENT') {
      window.renderEngineNarrations('PAYMENT');
    }
  };

  // --- 3. DYNAMIC NARRATIONS ---
  function getDynamicNarrationText(item) {
    if (!item.isMealExpense) return item.text;

    const totalMeals = document.getElementById('tx-meals')?.value || '0';
    const mealsLp = document.getElementById('meals-lp')?.value || '';
    const mealsUp = document.getElementById('meals-up')?.value || '';
    const monthEl = document.getElementById('select-month');
    const yearEl = document.getElementById('select-year');

    const monthText = monthEl ? monthEl.options[monthEl.selectedIndex]?.text : 'the month';
    const yearText = yearEl ? yearEl.value : '';

    if (parseInt(totalMeals, 10) > 0) {
      if (mealsLp && mealsUp) {
        return `By Cooking Cost for ${totalMeals} meals (${mealsLp} LP + ${mealsUp} UP) served in the month of ${monthText} ${yearText}`;
      }
      return `By Cooking Cost for ${totalMeals} meals served in the month of ${monthText} ${yearText}`;
    }
    return `By Cooking Cost for meals served in the month of ${monthText} ${yearText}`;
  }

  window.renderEngineNarrations = function (type) {
    const drawer = window.currentDrawer || 'mdm';
    const schemaList = (window.ENGINE_SCHEMAS[drawer] && window.ENGINE_SCHEMAS[drawer][type])
      ? window.ENGINE_SCHEMAS[drawer][type]
      : [];

    const container = document.getElementById('narration-quick-options');
    if (container) {
      container.innerHTML = '';
      schemaList.forEach((item, index) => {
        const text = getDynamicNarrationText(item);
        const card = document.createElement('div');
        card.style.cssText = 'padding:6px 10px; margin-bottom:6px; background:#fff; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer; font-size:12px; font-weight:500; display:flex; justify-content:space-between; align-items:center;';
        card.innerHTML = `<span>${text}</span> <span style="color:#64748b; font-size:11px;">LF:${item.lf} [${item.channel}]</span>`;
        card.onclick = () => {
          const descEl = document.getElementById('tx-desc');
          const lfEl = document.getElementById('tx-lf');
          const chanEl = document.getElementById('tx-channel');
          if (descEl) descEl.value = text;
          if (lfEl) lfEl.value = item.lf;
          if (chanEl) chanEl.value = item.channel;
        };
        container.appendChild(card);

        if (index === 0) {
          const descEl = document.getElementById('tx-desc');
          const lfEl = document.getElementById('tx-lf');
          const chanEl = document.getElementById('tx-channel');
          if (descEl && !descEl.value) descEl.value = text;
          if (lfEl && !lfEl.value) lfEl.value = item.lf;
          if (chanEl && !chanEl.value) chanEl.value = item.channel;
        }
      });
    }
  };

  // --- 4. TRANSACTION CONTROLLER ---
  window.setTransactionType = function (type) {
    window.currentEntryType = type;
    const btnReceipt = document.getElementById('btn-type-receipt');
    const btnWithdrawal = document.getElementById('btn-type-withdrawal');
    const btnPayment = document.getElementById('btn-type-payment');
    const channelEl = document.getElementById('tx-channel');

    [btnReceipt, btnWithdrawal, btnPayment].forEach(b => {
      if (b) {
        b.style.opacity = '0.5';
        b.style.borderColor = 'transparent';
      }
    });

    if (type === 'RECEIPT' && btnReceipt) {
      btnReceipt.style.opacity = '1';
      btnReceipt.style.borderColor = '#16a34a';
      if (channelEl) channelEl.value = 'BANK';
    } else if (type === 'WITHDRAWAL' && btnWithdrawal) {
      btnWithdrawal.style.opacity = '1';
      btnWithdrawal.style.borderColor = '#2563eb';
      if (channelEl) channelEl.value = 'BANK';
    } else if (type === 'PAYMENT' && btnPayment) {
      btnPayment.style.opacity = '1';
      btnPayment.style.borderColor = '#dc2626';
      if (channelEl) channelEl.value = 'CASH';
    }
    window.renderEngineNarrations(type);
  };

  window.addCompleteTransaction = function () {
    const dateEl = document.getElementById('tx-date');
    const lfEl = document.getElementById('tx-lf');
    const descEl = document.getElementById('tx-desc');
    const amountEl = document.getElementById('tx-amount');
    const channelEl = document.getElementById('tx-channel');

    const date = dateEl ? dateEl.value : '';
    const lf = (lfEl && lfEl.value.trim()) ? lfEl.value.trim() : (window.currentEntryType === 'WITHDRAWAL' ? 'C' : '-');
    const desc = descEl ? descEl.value.trim() : '';
    const amount = amountEl ? parseFloat(amountEl.value) || 0 : 0;
    const channel = channelEl ? channelEl.value : (window.currentEntryType === 'PAYMENT' ? 'CASH' : 'BANK');

    if (!date) { alert("Please pick the date of transaction."); return; }
    if (!desc) { alert("Please specify the particulars / narration."); return; }
    if (amount <= 0) { alert("Please enter a valid amount greater than 0."); return; }

    window.currentVouchers.push({
      id: Date.now(),
      date: date,
      type: window.currentEntryType,
      channel: channel,
      lf: (window.currentEntryType === 'WITHDRAWAL') ? 'C' : lf,
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

  // --- 5. DOUBLE-ENTRY LEDGER RECONCILIATION & REGISTER RENDER ---
  function splitAmount(num) {
    if (num === null || num === undefined || isNaN(num) || num === 0) {
      return { rs: '-', p: '--' };
    }
    const val = Number(num).toFixed(2);
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
      <tr class="${inkClass}">
        <td class="col-date">${date}</td>
        <td class="col-desc">${particular}</td>
        <td class="col-lf">${lf}</td>
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
    const opCashEl = document.getElementById('op-cash');
    const opBankEl = document.getElementById('op-bank');

    const opCash = opCashEl ? parseFloat(opCashEl.value) || 0 : 0;
    const opBank = opBankEl ? parseFloat(opBankEl.value) || 0 : 0;

    let totRecCash = opCash;
    let totRecBank = opBank;
    let totPayCash = 0;
    let totPayBank = 0;

    const receiptBody = document.getElementById('register-receipts-body');
    const paymentBody = document.getElementById('register-payments-body');

    // 1. O/B Row (Debit / Receipts in Black Ink)
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
        // Contra Entry
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

    // 2. Physical Balances & Deficit Evaluation
    const rawCloseCash = totRecCash - totPayCash;
    const rawCloseBank = totRecBank - totPayBank;

    const alertBanner = document.getElementById('advance-consent-banner');
    if (rawCloseCash < 0) {
      window.pendingAdvanceAmount = Math.abs(rawCloseCash);
      if (alertBanner) {
        alertBanner.style.display = 'flex';
        document.getElementById('advance-deficit-amount').innerText = window.pendingAdvanceAmount.toFixed(2);
      }
    } else {
      window.pendingAdvanceAmount = 0;
      if (alertBanner) alertBanner.style.display = 'none';
    }

    // 3. By C/B Row (Credit / Payments in Red Ink)
    paymentsHtml += renderRegisterRow('End', '<strong>By C/B</strong>', '-', rawCloseCash, rawCloseBank, true);

    // 4. Fill Ruled Empty Lines
    const receiptRowsCount = (receiptsHtml.match(/<tr/g) || []).length;
    const paymentRowsCount = (paymentsHtml.match(/<tr/g) || []).length;
    const maxRows = Math.max(16, receiptRowsCount, paymentRowsCount);

    for (let i = receiptRowsCount; i < maxRows; i++) {
      receiptsHtml += `<tr class="empty-line"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
    }
    for (let i = paymentRowsCount; i < maxRows; i++) {
      paymentsHtml += `<tr class="empty-line"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
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
      <tr class="total-row ink-black">
        <td></td><td><strong>T/P</strong></td><td></td>
        <td class="col-rs"><strong>${tRecCash.rs}</strong></td><td class="col-p"><strong>${tRecCash.p}</strong></td>
        <td class="col-rs"><strong>${tRecBank.rs}</strong></td><td class="col-p"><strong>${tRecBank.p}</strong></td>
        <td class="col-rs"><strong>${tRecTot.rs}</strong></td><td class="col-p"><strong>${tRecTot.p}</strong></td>
      </tr>
    `;

    paymentsHtml += `
      <tr class="total-row ink-red">
        <td></td><td><strong>T/P</strong></td><td></td>
        <td class="col-rs"><strong>${tPayCash.rs}</strong></td><td class="col-p"><strong>${tPayCash.p}</strong></td>
        <td class="col-rs"><strong>${tPayBank.rs}</strong></td><td class="col-p"><strong>${tPayBank.p}</strong></td>
        <td class="col-rs"><strong>${tPayTot.rs}</strong></td><td class="col-p"><strong>${tPayTot.p}</strong></td>
      </tr>
    `;

    if (receiptBody) receiptBody.innerHTML = receiptsHtml;
    if (paymentBody) paymentBody.innerHTML = paymentsHtml;

    // Header Display Sync
    const mEl = document.getElementById('select-month');
    const yEl = document.getElementById('select-year');
    const mName = mEl ? mEl.options[mEl.selectedIndex]?.text : '';
    const yName = yEl ? yEl.value : '';
    const label = document.getElementById('register-month-label');
    if (label) label.innerText = `${mName} ${yName}`;

    window.renderVoucherList();
  };

  // --- 6. USER-CONSENT TEACHER ADVANCE ---
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

  // --- 7. VOUCHER LIST (EDIT / REMOVE) ---
  window.renderVoucherList = function () {
    const listEl = document.getElementById('voucher-tray');
    if (!listEl) return;
    listEl.innerHTML = '';

    window.currentVouchers.forEach(v => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:#fff; border:1px solid #e2e8f0; border-radius:4px; margin-bottom:4px; font-size:12px;';
      const color = v.type === 'RECEIPT' ? '#16a34a' : (v.type === 'WITHDRAWAL' ? '#2563eb' : '#dc2626');
      item.innerHTML = `
        <div>
          <span style="font-weight:700; color:${color};">[${v.type}]</span>
          <strong>${v.date}</strong>: ${v.desc} (LF:${v.lf})
        </div>
        <div>
          <strong>₹${Number(v.amount).toFixed(2)}</strong>
          <button onclick="removeVoucher(${v.id})" style="background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; margin-left:8px;">✕</button>
        </div>
      `;
      listEl.appendChild(item);
    });
  };

  // --- 8. MULTI-MONTH STORAGE, CARRY FORWARD & ARCHIVE ---
  function getStorageKey(drawer, year, month) {
    return `cashbook_rec_${drawer}_${year}_${String(month).padStart(2, '0')}`;
  }

  window.saveCurrentMonthRecord = function () {
    const drawer = window.currentDrawer;
    const year = document.getElementById('select-year')?.value;
    const month = document.getElementById('select-month')?.value;

    const opCash = parseFloat(document.getElementById('op-cash')?.value) || 0;
    const opBank = parseFloat(document.getElementById('op-bank')?.value) || 0;

    let totCashRec = opCash;
    let totBankRec = opBank;
    let totCashPay = 0;
    let totBankPay = 0;

    window.currentVouchers.forEach(v => {
      const a = parseFloat(v.amount) || 0;
      if (v.type === 'RECEIPT') {
        if (v.channel === 'BANK') totBankRec += a;
        else totCashRec += a;
      } else if (v.type === 'WITHDRAWAL') {
        totCashRec += a;
        totBankPay += a;
      } else if (v.type === 'PAYMENT') {
        if (v.channel === 'BANK') totBankPay += a;
        else totCashPay += a;
      }
    });

    const closeCash = totCashRec - totCashPay;
    const closeBank = totBankRec - totBankPay;

    const payload = {
      drawer: drawer,
      year: year,
      month: month,
      category: document.getElementById('school-category')?.value,
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

    const key = getStorageKey(drawer, year, month);
    localStorage.setItem(key, JSON.stringify(payload));

    // Propagate C/B -> next month's O/B
    let nextMonth = parseInt(month, 10) + 1;
    let nextYear = parseInt(year, 10);
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const nextKey = getStorageKey(drawer, nextYear, nextMonth);
    let nextRec = localStorage.getItem(nextKey);
    nextRec = nextRec ? JSON.parse(nextRec) : {};
    nextRec.opCash = closeCash;
    nextRec.opBank = closeBank;
    localStorage.setItem(nextKey, JSON.stringify(nextRec));

    alert(`Cashbook for ${month}/${year} permanently saved. C/B carried forward to next month.`);
    window.renderArchiveTray();
  };

  window.loadMonthRecord = function (year, month) {
    const drawer = window.currentDrawer;
    const key = getStorageKey(drawer, year, month);
    const dataStr = localStorage.getItem(key);

    const yEl = document.getElementById('select-year');
    const mEl = document.getElementById('select-month');
    if (yEl) yEl.value = year;
    if (mEl) mEl.value = month;

    if (dataStr) {
      const data = JSON.parse(dataStr);
      document.getElementById('school-category').value = data.category || 'COMPOSITE';
      document.getElementById('rate-lp').value = data.rateLp || '';
      document.getElementById('meals-lp').value = data.mealsLp || '';
      document.getElementById('rate-up').value = data.rateUp || '';
      document.getElementById('meals-up').value = data.mealsUp || '';
      document.getElementById('op-cash').value = data.opCash !== undefined ? data.opCash : '';
      document.getElementById('op-bank').value = data.opBank !== undefined ? data.opBank : '';
      window.currentVouchers = data.vouchers || [];
    } else {
      // Check if previous month has C/B to auto carry-forward
      let prevM = parseInt(month, 10) - 1;
      let prevY = parseInt(year, 10);
      if (prevM < 1) { prevM = 12; prevY -= 1; }
      const prevKey = getStorageKey(drawer, prevY, prevM);
      const prevDataStr = localStorage.getItem(prevKey);

      if (prevDataStr) {
        const prevData = JSON.parse(prevDataStr);
        document.getElementById('op-cash').value = prevData.closeCash !== undefined ? prevData.closeCash : 0;
        document.getElementById('op-bank').value = prevData.closeBank !== undefined ? prevData.closeBank : 0;
      } else {
        document.getElementById('op-cash').value = '';
        document.getElementById('op-bank').value = '';
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

  // --- 9. LIFECYCLE BOOTSTRAP ---
  document.addEventListener('DOMContentLoaded', () => {
    window.updateCategoryVisibility();
    window.setTransactionType('RECEIPT');
    window.renderArchiveTray();
  });

})(window);

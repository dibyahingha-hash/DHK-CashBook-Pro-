/**
 * DHK PM POSHAN & SCHOOL CASHBOOK PRO AUDIT ENGINE
 * Dual-Rate LP/UP Engine | Active Reconciliation Monitor | Auto General Ledger | Strict 2-Page A4 Print
 */
(function (window) {
  'use strict';

  // ==========================================================================
  // 1. GLOBAL STATE
  // ==========================================================================
  window.currentDrawer = 'mdm';
  window.currentEntryType = 'RECEIPT';
  window.currentVouchers = [];
  window.pendingAdvanceAmount = 0;

  // ==========================================================================
  // 2. STATUTORY SCHEMAS (MDM, SMC, SNA)
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
    var drawers = ['mdm', 'smc', 'sna'];
    for (var i = 0; i < drawers.length; i++) {
      var d = drawers[i];
      var b = document.getElementById('btn-drawer-' + d);
      if (b) {
        if (d === drawer) {
          b.style.background = '#0284c7';
          b.style.color = '#fff';
        } else {
          b.style.background = '#f1f5f9';
          b.style.color = '#334155';
        }
      }
    }

    var mandateBox = document.getElementById('box-mdm-mandate');
    if (mandateBox) mandateBox.style.display = (drawer === 'mdm') ? 'block' : 'none';

    window.renderEngineNarrations(window.currentEntryType);
    window.onCashbookPeriodChange();
    window.updateLedgerHeadFilterOptions();
    window.renderLedgerSheet();
  };

  window.switchSubView = function (view) {
    var cbWrap = document.getElementById('subview-cashbook-wrap');
    var ledWrap = document.getElementById('subview-ledger-wrap');
    var btnCb = document.getElementById('btn-sub-cashbook');
    var btnLed = document.getElementById('btn-sub-ledger');

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
    var catEl = document.getElementById('cb-mandate-cat');
    var cat = catEl ? catEl.value : 'COMPOSITE';
    var lpBox = document.getElementById('box-lp');
    var upBox = document.getElementById('box-up');

    if (cat === 'LP') {
      if (lpBox) lpBox.style.display = 'block';
      if (upBox) upBox.style.display = 'none';
      var rUp = document.getElementById('rate-up');
      var mUp = document.getElementById('meals-up');
      if (rUp) rUp.value = '';
      if (mUp) mUp.value = '';
    } else if (cat === 'UP') {
      if (lpBox) lpBox.style.display = 'none';
      if (upBox) upBox.style.display = 'block';
      var rLp = document.getElementById('rate-lp');
      var mLp = document.getElementById('meals-lp');
      if (rLp) rLp.value = '';
      if (mLp) mLp.value = '';
    } else {
      if (lpBox) lpBox.style.display = 'block';
      if (upBox) upBox.style.display = 'block';
    }
    window.calculateMandate();
  };

  // ==========================================================================
  // 4. ACTIVE RECONCILIATION STATUS MONITOR & NARRATIONS
  // ==========================================================================
  window.getMandateMetrics = function () {
    var rLpEl = document.getElementById('rate-lp');
    var mLpEl = document.getElementById('meals-lp');
    var rUpEl = document.getElementById('rate-up');
    var mUpEl = document.getElementById('meals-up');

    var rateLp = rLpEl ? (parseFloat(rLpEl.value) || 0) : 0;
    var mealsLp = mLpEl ? (parseInt(mLpEl.value, 10) || 0) : 0;
    var rateUp = rUpEl ? (parseFloat(rUpEl.value) || 0) : 0;
    var mealsUp = mUpEl ? (parseInt(mUpEl.value, 10) || 0) : 0;
    var target = (mealsLp * rateLp) + (mealsUp * rateUp);

    var booked = 0;
    for (var i = 0; i < window.currentVouchers.length; i++) {
      var v = window.currentVouchers[i];
      var lfClean = String(v.lf || '').trim();
      var isMealDesc = String(v.desc || '').toLowerCase().indexOf('cooking cost') !== -1;

      // Count if it is marked as Folio 1 OR has a Cooking Cost description
      if (v.type === 'PAYMENT' && (lfClean === '1' || lfClean === '01' || isMealDesc)) {
        booked += (parseFloat(v.amount) || 0);
      }
    }

    return {
      target: target,
      booked: booked,
      deficit: target - booked,
      mealsTotal: mealsLp + mealsUp
    };
  };

  window.updateReconciliationBanner = function () {
    var banner = document.getElementById('recon-status-banner');

    if (!banner) {
      var entryCard = document.getElementById('box-add-transaction') ||
                      document.getElementById('narration-quick-options') ||
                      document.querySelector('.card');
      if (entryCard && entryCard.parentNode) {
        banner = document.createElement('div');
        banner.id = 'recon-status-banner';
        entryCard.parentNode.insertBefore(banner, entryCard);
      } else {
        return;
      }
    }

    if (window.currentDrawer !== 'mdm') {
      banner.style.display = 'none';
      return;
    }

    var m = window.getMandateMetrics();
    banner.style.display = 'block';
    banner.style.padding = '10px 14px';
    banner.style.borderRadius = '6px';
    banner.style.fontSize = '13px';
    banner.style.marginBottom = '12px';
    banner.style.border = '1.5px solid';

    var fmt = function (num) {
      return 'Rs. ' + Number(num).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };

    if (m.target === 0) {
      banner.style.background = '#f1f5f9';
      banner.style.borderColor = '#cbd5e1';
      banner.style.color = '#475569';
      banner.innerHTML = '<strong>Reconciliation Status:</strong> No MDM mandate computed yet. Please input LP/UP rates and meal counts.';
    } else if (m.deficit > 0) {
      banner.style.background = '#eff6ff';
      banner.style.borderColor = '#3b82f6';
      banner.style.color = '#1e40af';
      banner.innerHTML = 'Target: <strong>' + fmt(m.target) + '</strong> | Vouchers Booked: <strong>' + fmt(m.booked) + '</strong> | <span style="color:#b91c1c; font-weight:700;">' + fmt(m.deficit) + ' is pending.</span> Please provide required vouchers.';
    } else if (m.deficit === 0) {
      banner.style.background = '#f0fdf4';
      banner.style.borderColor = '#22c55e';
      banner.style.color = '#15803d';
      banner.innerHTML = 'Target: <strong>' + fmt(m.target) + '</strong> | Vouchers Booked: <strong>' + fmt(m.booked) + '</strong> | <strong>Fully Reconciled & Audit Ready.</strong>';
    } else {
      banner.style.background = '#fef2f2';
      banner.style.borderColor = '#ef4444';
      banner.style.color = '#b91c1c';
      banner.innerHTML = '<strong>OVER-EXPENDITURE WARNING:</strong> Target: ' + fmt(m.target) + ' | Vouchers Booked: ' + fmt(m.booked) + ' | Excess: <strong>' + fmt(Math.abs(m.deficit)) + '</strong> exceeds the sanctioned limit!';
    }
  };

  window.calculateMandate = function () {
    var rLpEl = document.getElementById('rate-lp');
    var mLpEl = document.getElementById('meals-lp');
    var rUpEl = document.getElementById('rate-up');
    var mUpEl = document.getElementById('meals-up');

    var rateLp = rLpEl ? (parseFloat(rLpEl.value) || 0) : 0;
    var mealsLp = mLpEl ? (parseInt(mLpEl.value, 10) || 0) : 0;
    var rateUp = rUpEl ? (parseFloat(rUpEl.value) || 0) : 0;
    var mealsUp = mUpEl ? (parseInt(mUpEl.value, 10) || 0) : 0;

    var costLp = mealsLp * rateLp;
    var costUp = mealsUp * rateUp;
    var totalMeals = mealsLp + mealsUp;
    var totalCost = costLp + costUp;

    var subLp = document.getElementById('subtotal-lp');
    var subUp = document.getElementById('subtotal-up');
    if (subLp) subLp.innerText = costLp.toFixed(2);
    if (subUp) subUp.innerText = costUp.toFixed(2);

    var mealsDisp = document.getElementById('mandate-meals-display');
    var targetDisp = document.getElementById('mandate-target-display');
    if (mealsDisp) mealsDisp.innerText = totalMeals;
    if (targetDisp) targetDisp.innerText = totalCost.toFixed(2);

    var hiddenMeals = document.getElementById('tx-meals');
    var hiddenTarget = document.getElementById('tx-target-expenditure');
    if (hiddenMeals) hiddenMeals.value = totalMeals;
    if (hiddenTarget) hiddenTarget.value = totalCost.toFixed(2);

    window.updateReconciliationBanner();
    if (window.currentEntryType === 'PAYMENT') {
      window.renderEngineNarrations('PAYMENT');
    }
  };

  // Generates unique installment descriptions to prevent aggregate claim objections
  function getDynamicNarrationText(item) {
    if (!item.isMealExpense) return item.text;
    var mLpEl = document.getElementById('meals-lp');
    var mUpEl = document.getElementById('meals-up');
    var mealsLp = mLpEl ? mLpEl.value : '';
    var mealsUp = mUpEl ? mUpEl.value : '';
    var mTotal = (parseInt(mealsLp, 10) || 0) + (parseInt(mealsUp, 10) || 0);

    var monthEl = document.getElementById('cb-sel-month');
    var yearEl = document.getElementById('cb-sel-year');
    var monthText = (monthEl && monthEl.selectedIndex >= 0) ? monthEl.options[monthEl.selectedIndex].text : 'the month';
    var yearText = yearEl ? yearEl.value : '';

    var existingCount = 0;
    for (var i = 0; i < window.currentVouchers.length; i++) {
      var v = window.currentVouchers[i];
      var lfClean = String(v.lf || '').trim();
      var isMealDesc = String(v.desc || '').toLowerCase().indexOf('cooking cost') !== -1;
      if (v.type === 'PAYMENT' && (lfClean === '1' || lfClean === '01' || isMealDesc)) {
        existingCount++;
      }
    }
    var inst = existingCount + 1;

    if (mTotal > 0) {
      return 'By Cooking Cost (Inst. ' + inst + ') towards ' + mTotal + ' meals sanctioned for ' + monthText + ' ' + yearText;
    }
    return 'By Cooking Cost (Inst. ' + inst + ') for daily kitchen marketing in ' + monthText + ' ' + yearText;
  }

  window.renderEngineNarrations = function (type) {
    var drawer = window.currentDrawer || 'mdm';
    var schemaList = (window.ENGINE_SCHEMAS[drawer] && window.ENGINE_SCHEMAS[drawer][type]) ? window.ENGINE_SCHEMAS[drawer][type] : [];
    var container = document.getElementById('narration-quick-options');
    if (!container) return;

    container.innerHTML = '';
    for (var i = 0; i < schemaList.length; i++) {
      (function (item, index) {
        var text = getDynamicNarrationText(item);
        var card = document.createElement('div');
        card.style.cssText = 'padding:6px 10px; margin-bottom:5px; background:#fff; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer; font-size:12px; font-weight:500; display:flex; justify-content:space-between; align-items:center;';
        card.innerHTML = '<span>' + text + '</span> <span style="color:#64748b; font-size:11px; white-space:nowrap; margin-left:8px;">LF: <strong>' + item.lf + '</strong> [' + item.channel + ']</span>';

        card.onclick = function () {
          var descEl = document.getElementById('tx-desc');
          var lfEl = document.getElementById('tx-lf');
          var chanEl = document.getElementById('tx-channel');
          if (descEl) descEl.value = text;
          if (lfEl) lfEl.value = item.lf;
          if (chanEl) chanEl.value = item.channel;
        };
        container.appendChild(card);

        if (index === 0) {
          var descEl = document.getElementById('tx-desc');
          var lfEl = document.getElementById('tx-lf');
          var chanEl = document.getElementById('tx-channel');
          if (descEl && !descEl.value) descEl.value = text;
          if (lfEl && !lfEl.value) lfEl.value = item.lf;
          if (chanEl && !chanEl.value) chanEl.value = item.channel;
        }
      })(schemaList[i], i);
    }
  };

  window.setTransactionType = function (type) {
    window.currentEntryType = type;
    var btnReceipt = document.getElementById('btn-type-rcpt');
    var btnWithdrawal = document.getElementById('btn-type-with');
    var btnPayment = document.getElementById('btn-type-pmt');
    var channelEl = document.getElementById('tx-channel');

    var btns = [btnReceipt, btnWithdrawal, btnPayment];
    for (var i = 0; i < btns.length; i++) {
      if (btns[i]) {
        btns[i].style.opacity = '0.5';
        btns[i].style.borderColor = 'transparent';
      }
    }

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
  // 5. TRANSACTION INGESTION & INTERCEPTION GUARD
  // ==========================================================================
  window.addCompleteTransaction = function () {
    var dateEl = document.getElementById('tx-date');
    var lfEl = document.getElementById('tx-lf');
    var descEl = document.getElementById('tx-desc');
    var amountEl = document.getElementById('tx-amount');
    var channelEl = document.getElementById('tx-channel');

    var date = dateEl ? dateEl.value : '';
    var lf = lfEl ? lfEl.value.trim().toUpperCase() : '';
    var desc = descEl ? descEl.value.trim() : '';
    var amount = amountEl ? parseFloat(amountEl.value) || 0 : 0;
    var channel = channelEl ? channelEl.value : 'CASH';

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
      var metrics = window.getMandateMetrics();
      if (metrics.target > 0 && (metrics.booked + amount) > metrics.target) {
        var excess = (metrics.booked + amount) - metrics.target;
        var warnMsg = "AUDIT WARNING: Adding Rs. " + amount.toFixed(2) + " exceeds the monthly Cooking Cost mandate by Rs. " + excess.toFixed(2) + ".\n\nMandate Target: Rs. " + metrics.target.toFixed(2) + "\nCurrent Booked: Rs. " + metrics.booked.toFixed(2) + "\n\nDo you want to intercept and correct this voucher? Click Cancel to return.";
        if (!confirm(warnMsg)) return;
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
    window.currentVouchers = window.currentVouchers.filter(function (v) {
      return String(v.id) !== String(id);
    });
    window.recalculateCashbook();
  };

  // ==========================================================================
  // 6. VOUCHER TRAY LIST
  // ==========================================================================
  window.renderVoucherList = function () {
    var listEl = document.getElementById('voucher-tray');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!window.currentVouchers || window.currentVouchers.length === 0) {
      listEl.innerHTML = '<div style="padding:10px; color:#64748b; font-size:12px; text-align:center;">No vouchers added for this period.</div>';
      return;
    }

    for (var i = 0; i < window.currentVouchers.length; i++) {
      var v = window.currentVouchers[i];
      var item = document.createElement('div');
      item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:#fff; border:1px solid #e2e8f0; border-radius:4px; margin-bottom:6px; font-size:12px;';

      var color = v.type === 'RECEIPT' ? '#16a34a' : (v.type === 'WITHDRAWAL' ? '#2563eb' : '#dc2626');
      var day = v.date ? v.date.split('-')[2] : '';

      item.innerHTML = '<div>' +
        '<span style="font-weight:700; color:' + color + '; margin-right:4px;">[' + v.type + ']</span>' +
        '<strong>' + (day ? 'Date ' + day : v.date) + '</strong>: ' + v.desc +
        ' <span style="color:#64748b; font-weight:600;">(LF: ' + v.lf + ')</span>' +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:8px;">' +
        '<strong>Rs. ' + Number(v.amount).toFixed(2) + '</strong>' +
        '<button onclick="window.removeVoucher(' + v.id + ')" style="background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; font-size:14px; padding:2px 4px;">X</button>' +
        '</div>';

      listEl.appendChild(item);
    }
  };

  // ==========================================================================
  // 7. TWO-PAGE STRICT A4 REGISTER ENGINE (WITH PHYSICAL AUDIT CERTIFICATE)
  // ==========================================================================
  function splitAmount(num) {
    if (num === null || num === undefined || isNaN(num) || num === 0) {
      return { rs: '', p: '' };
    }
    var val = Number(Math.abs(num)).toFixed(2);
    var parts = val.split('.');
    return { rs: parts[0], p: parts[1] };
  }

  function renderRegisterRow(date, particular, lf, cashAmt, bankAmt, isRed) {
    var c = splitAmount(cashAmt);
    var b = splitAmount(bankAmt);
    var tot = (cashAmt || 0) + (bankAmt || 0);
    var t = tot > 0 ? splitAmount(tot) : { rs: '', p: '' };
    var inkClass = isRed ? 'ink-red' : 'ink-black';

    return '<tr class="' + inkClass + '">' +
      '<td class="col-date">' + date + '</td>' +
      '<td class="col-desc">' + particular + '</td>' +
      '<td class="col-lf">' + (lf || '-') + '</td>' +
      '<td class="col-rs">' + c.rs + '</td>' +
      '<td class="col-p">' + c.p + '</td>' +
      '<td class="col-rs">' + b.rs + '</td>' +
      '<td class="col-p">' + b.p + '</td>' +
      '<td class="col-rs">' + t.rs + '</td>' +
      '<td class="col-p">' + t.p + '</td>' +
      '</tr>';
  }

  window.recalculateCashbook = function () {
    var opCashEl = document.getElementById('cb-op-cash');
    var opBankEl = document.getElementById('cb-op-bank');
    var opCash = opCashEl ? (parseFloat(opCashEl.value) || 0) : 0;
    var opBank = opBankEl ? (parseFloat(opBankEl.value) || 0) : 0;

    var totRecCash = opCash;
    var totRecBank = opBank;
    var totPayCash = 0;
    var totPayBank = 0;

    var receiptsHtml = renderRegisterRow('1st', '<strong>To Opening Balance (O/B)</strong>', '-', opCash, opBank, false);
    var paymentsHtml = '';

    var sortedVouchers = window.currentVouchers.slice().sort(function (a, b) {
      return new Date(a.date) - new Date(b.date);
    });

    for (var i = 0; i < sortedVouchers.length; i++) {
      var v = sortedVouchers[i];
      var amt = parseFloat(v.amount) || 0;
      var day = v.date ? parseInt(v.date.split('-')[2], 10) : '-';

      if (v.type === 'RECEIPT') {
        var isBank = v.channel === 'BANK';
        if (isBank) totRecBank += amt; else totRecCash += amt;
        receiptsHtml += renderRegisterRow(day, v.desc, v.lf, !isBank ? amt : 0, isBank ? amt : 0, false);
      } else if (v.type === 'WITHDRAWAL') {
        totRecCash += amt;
        totPayBank += amt;
        receiptsHtml += renderRegisterRow(day, 'To Bank (Contra)', 'C', amt, 0, false);
        paymentsHtml += renderRegisterRow(day, 'By Cash (Contra)', 'C', 0, amt, true);
      } else if (v.type === 'PAYMENT') {
        var isBankPay = v.channel === 'BANK';
        if (isBankPay) totPayBank += amt; else totPayCash += amt;
        paymentsHtml += renderRegisterRow(day, v.desc, v.lf, !isBankPay ? amt : 0, isBankPay ? amt : 0, true);
      }
    }

    var rawCloseCash = totRecCash - totPayCash;
    var rawCloseBank = totRecBank - totPayBank;

    var alertBanner = document.getElementById('advance-consent-banner');
    if (rawCloseCash < 0) {
      window.pendingAdvanceAmount = Math.abs(rawCloseCash);
      if (alertBanner) {
        alertBanner.style.display = 'flex';
        var advAmtEl = document.getElementById('advance-deficit-amount');
        if (advAmtEl) advAmtEl.innerText = window.pendingAdvanceAmount.toFixed(2);
      }
    } else {
      window.pendingAdvanceAmount = 0;
      if (alertBanner) alertBanner.style.display = 'none';
    }

    paymentsHtml += renderRegisterRow('End', '<strong>By Closing Balance (C/B)</strong>', '-', Math.max(0, rawCloseCash), Math.max(0, rawCloseBank), true);

    // Exact filler row allocation to fit table, certificates, and signature blocks strictly on 1 page[span_8](start_span)[span_8](end_span)
    var countReceipts = (receiptsHtml.match(/<tr/g) || []).length;
    var countPayments = (paymentsHtml.match(/<tr/g) || []).length;
    var EXACT_RECEIPT_LINES = 15;
    var EXACT_PAYMENT_LINES = 10;

    for (var r = countReceipts; r < EXACT_RECEIPT_LINES; r++) {
      receiptsHtml += '<tr class="empty-line"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
    }
    for (var p = countPayments; p < EXACT_PAYMENT_LINES; p++) {
      paymentsHtml += '<tr class="empty-line"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
    }

    var tRecCash = splitAmount(totRecCash);
    var tRecBank = splitAmount(totRecBank);
    var tRecTot = splitAmount(totRecCash + totRecBank);

    var grandPayCash = totPayCash + Math.max(0, rawCloseCash);
    var grandPayBank = totPayBank + Math.max(0, rawCloseBank);
    var tPayCash = splitAmount(grandPayCash);
    var tPayBank = splitAmount(grandPayBank);
    var tPayTot = splitAmount(grandPayCash + grandPayBank);

    var cbCash = splitAmount(Math.max(0, rawCloseCash));
    var cbBank = splitAmount(Math.max(0, rawCloseBank));

    receiptsHtml += '<tr class="total-row ink-black">' +
      '<td></td><td><strong>Total / Balanced (T/P)</strong></td><td></td>' +
      '<td class="col-rs"><strong>' + tRecCash.rs + '</strong></td><td class="col-p"><strong>' + tRecCash.p + '</strong></td>' +
      '<td class="col-rs"><strong>' + tRecBank.rs + '</strong></td><td class="col-p"><strong>' + tRecBank.p + '</strong></td>' +
      '<td class="col-rs"><strong>' + tRecTot.rs + '</strong></td><td class="col-p"><strong>' + tRecTot.p + '</strong></td>' +
      '</tr>';

    paymentsHtml += '<tr class="total-row ink-red">' +
      '<td></td><td><strong>Total / Balanced (T/P)</strong></td><td></td>' +
      '<td class="col-rs"><strong>' + tPayCash.rs + '</strong></td><td class="col-p"><strong>' + tPayCash.p + '</strong></td>' +
      '<td class="col-rs"><strong>' + tPayBank.rs + '</strong></td><td class="col-p"><strong>' + tPayBank.p + '</strong></td>' +
      '<td class="col-rs"><strong>' + tPayTot.rs + '</strong></td><td class="col-p"><strong>' + tPayTot.p + '</strong></td>' +
      '</tr>';

    var mEl = document.getElementById('cb-sel-month');
    var yEl = document.getElementById('cb-sel-year');
    var mName = (mEl && mEl.selectedIndex >= 0) ? mEl.options[mEl.selectedIndex].text : '';
    var yName = yEl ? yEl.value : '';

    var tableHeader = '<thead>' +
      '<tr>' +
      '<th rowspan="2" class="th-date">Month &<br>Date</th>' +
      '<th rowspan="2" class="th-particulars">PARTICULARS</th>' +
      '<th rowspan="2" class="th-lf">Ledger<br>Folio</th>' +
      '<th colspan="2" class="th-group">Cash Amount</th>' +
      '<th colspan="2" class="th-group">Bank Amount</th>' +
      '<th colspan="2" class="th-group">Total Amount</th>' +
      '</tr>' +
      '<tr>' +
      '<th class="th-sub">Rs.</th><th class="th-sub-p">P.</th>' +
      '<th class="th-sub">Rs.</th><th class="th-sub-p">P.</th>' +
      '<th class="th-sub">Rs.</th><th class="th-sub-p">P.</th>' +
      '</tr>' +
      '</thead>';

    var area = document.getElementById('cashbook-printable-area');
    if (area) {
      area.innerHTML = '<div class="print-container">' +
        '<!-- PAGE 1: RECEIPTS -->' +
        '<div class="register-page page-receipts">' +
        '<div class="page-header">' +
        '<div class="cashbook-title">CASH BOOK</div>' +
        '<div class="cashbook-subtitle">For the month of ' + mName + ' ' + yName + '</div>' +
        '<div class="section-indicator text-receipts">RECEIPTS</div>' +
        '</div>' +
        '<table class="ledger-table">' + tableHeader + '<tbody>' + receiptsHtml + '</tbody></table>' +
        '</div>' +

        '<!-- PAGE 2: PAYMENTS (WITH AUDIT VERIFICATION CERTIFICATE & SEALS) -->' +
        '<div class="register-page page-payments">' +
        '<div class="page-header">' +
        '<div class="cashbook-title">CASH BOOK</div>' +
        '<div class="cashbook-subtitle">For the month of ' + mName + ' ' + yName + '</div>' +
        '<div class="section-indicator text-payments">PAYMENTS</div>' +
        '</div>' +
        '<table class="ledger-table">' + tableHeader + '<tbody>' + paymentsHtml + '</tbody></table>' +

        '<!-- STATUTORY AUDIT & RECONCILIATION CERTIFICATE -->' +
        '<div class="statutory-audit-cert">' +
        '<strong>STATUTORY PHYSICAL VERIFICATION & AUDIT CERTIFICATE:</strong><br>' +
        '1. Certified that the closing cash-in-hand balance of <strong>Rs. ' + cbCash.rs + '.' + (cbCash.p || '00') + '</strong> has been physically verified by the undersigned and found correct.<br>' +
        '2. Certified that the closing bank balance of <strong>Rs. ' + cbBank.rs + '.' + (cbBank.p || '00') + '</strong> agrees with the entries in the Bank Passbook / SNA Portal statement for ' + mName + ' ' + yName + '.<br>' +
        '3. Certified that all cooking cost expenditures billed under Folio 1 conform to sanctioned per-child per-day allocation rules.' +
        '</div>' +

        '<!-- AUTHENTICATION DUAL-SIGNATURE SEAL BLOCK -->' +
        '<div class="signature-block">' +
        '<div class="sign-box">' +
        '<div class="sign-line"></div>' +
        'Prepared & Verified By<br>(Accountant / In-Charge Teacher)' +
        '</div>' +
        '<div class="sign-box">' +
        '<div class="sign-line"></div>' +
        'Countersigned & Certified<br>Headmaster / Member Secy (SMC Seal)' +
        '</div>' +
        '</div>' +

        '</div>' +
        '</div>';
    }

    if (typeof window.renderVoucherList === 'function') {
      window.renderVoucherList();
    }
    window.renderLedgerSheet();
    window.updateReconciliationBanner();
  };

  // ==========================================================================
  // 8. AUTOMATIC CONSOLIDATED & FILTERED GENERAL LEDGER
  // ==========================================================================
  window.updateLedgerHeadFilterOptions = function () {
    var sel = document.getElementById('sel-filter-ledger');
    if (!sel) return;
    var heads = [
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
    var currentVal = sel.value;
    sel.innerHTML = '';
    for (var i = 0; i < heads.length; i++) {
      var opt = document.createElement('option');
      opt.value = heads[i].lf;
      opt.innerText = heads[i].name;
      if (heads[i].lf === currentVal) opt.selected = true;
      sel.appendChild(opt);
    }
  };

  window.renderLedgerSheet = function () {
    var filterEl = document.getElementById('sel-filter-ledger');
    var rawFilter = filterEl ? filterEl.value : 'ALL';

    var selectedLf = 'ALL';
    if (rawFilter && rawFilter !== 'ALL') {
      var match = rawFilter.match(/([0-9]+|[A-Za-z]+)/);
      selectedLf = match ? match[0].toUpperCase() : rawFilter.toUpperCase();
    }

    var headNameEl = document.getElementById('led-header-head-name');
    var tbodyEl = document.getElementById('led-tbody');
    var totDrEl = document.getElementById('led-tot-dr');
    var totCrEl = document.getElementById('led-tot-cr');
    var totBalEl = document.getElementById('led-tot-bal');

    var headLabel = (filterEl && filterEl.selectedIndex >= 0)
      ? filterEl.options[filterEl.selectedIndex].text.toUpperCase()
      : 'CONSOLIDATED GENERAL LEDGER';

    if (headNameEl) {
      headNameEl.innerText = headLabel;
    }

    var list = window.currentVouchers.slice();
    if (selectedLf !== 'ALL') {
      list = list.filter(function (v) {
        var vLf = String(v.lf || '').trim().toUpperCase();
        return vLf === selectedLf;
      });
    }

    list.sort(function (a, b) {
      return new Date(a.date) - new Date(b.date);
    });

    var runningBal = 0;
    var totDr = 0;
    var totCr = 0;
    var rowsHtml = '';

    if (list.length === 0) {
      rowsHtml = '<tr><td colspan="6" style="text-align:center; padding:15px; color:#64748b;">No vouchers recorded under this folio head for this month.</td></tr>';
    } else {
      for (var i = 0; i < list.length; i++) {
        var v = list[i];
        var amt = parseFloat(v.amount) || 0;
        var dr = 0;
        var cr = 0;

        if (selectedLf === 'ALL') {
          // Cashbook Perspective: Receipts Dr, Payments Cr[span_9](start_span)[span_9](end_span)
          if (v.type === 'RECEIPT') {
            dr = amt; runningBal += amt; totDr += amt;
          } else if (v.type === 'PAYMENT') {
            cr = amt; runningBal -= amt; totCr += amt;
          } else if (v.type === 'WITHDRAWAL') {
            dr = amt; cr = amt; totDr += amt; totCr += amt;
          }
        } else {
          // Nominal Ledger Perspective: Expenditure heads are debited on payment[span_10](start_span)[span_10](end_span)
          if (v.type === 'PAYMENT') {
            dr = amt; runningBal += amt; totDr += amt;
          } else if (v.type === 'RECEIPT') {
            cr = amt; runningBal -= amt; totCr += amt;
          } else if (v.type === 'WITHDRAWAL') {
            dr = amt; cr = amt; totDr += amt; totCr += amt;
          }
        }

        var day = v.date ? v.date.split('-')[2] : v.date;

        rowsHtml += '<tr>' +
          '<td class="text-center" style="padding:6px; border:1px solid #cbd5e1; text-align:center;">' + day + '</td>' +
          '<td class="text-center" style="padding:6px; border:1px solid #cbd5e1; text-align:center; font-weight:bold;">' + (v.lf || '-') + '</td>' +
          '<td style="padding:6px; border:1px solid #cbd5e1;">' + v.desc + '</td>' +
          '<td class="num" style="text-align:right; padding:6px; border:1px solid #cbd5e1;">' + (dr > 0 ? 'Rs. ' + dr.toFixed(2) : '-') + '</td>' +
          '<td class="num" style="text-align:right; padding:6px; border:1px solid #cbd5e1;">' + (cr > 0 ? 'Rs. ' + cr.toFixed(2) : '-') + '</td>' +
          '<td class="num font-bold" style="text-align:right; padding:6px; font-weight:700; border:1px solid #cbd5e1;">Rs. ' + runningBal.toFixed(2) + '</td>' +
          '</tr>';
      }
    }

    if (tbodyEl) tbodyEl.innerHTML = rowsHtml;
    if (totDrEl) totDrEl.innerText = 'Rs. ' + totDr.toFixed(2);
    if (totCrEl) totCrEl.innerText = 'Rs. ' + totCr.toFixed(2);
    if (totBalEl) totBalEl.innerText = 'Rs. ' + runningBal.toFixed(2);

    // Synchronize dedicated printable area for standalone A4 General Ledger printing
    var printArea = document.getElementById('ledger-printable-area');
    var mEl = document.getElementById('cb-sel-month');
    var yEl = document.getElementById('cb-sel-year');
    var mName = (mEl && mEl.selectedIndex >= 0) ? mEl.options[mEl.selectedIndex].text : '';
    var yName = yEl ? yEl.value : '';

    if (printArea) {
      printArea.innerHTML = '<div class="ledger-standalone-page">' +
        '<div class="page-header">' +
        '<div class="cashbook-title">GENERAL LEDGER STATEMENT</div>' +
        '<div class="cashbook-subtitle">' + headLabel + '</div>' +
        '<div style="font-size:11px; color:#475569; margin-top:2px;">Period: ' + mName + ' ' + yName + ' | Drawer: ' + window.currentDrawer.toUpperCase() + '</div>' +
        '</div>' +
        '<table class="ledger-table-full">' +
        '<thead><tr>' +
        '<th style="width:75px; text-align:center;">Date</th>' +
        '<th style="width:40px; text-align:center;">Folio</th>' +
        '<th>Particulars</th>' +
        '<th style="width:85px; text-align:right;">Debit (Dr)</th>' +
        '<th style="width:85px; text-align:right;">Credit (Cr)</th>' +
        '<th style="width:95px; text-align:right;">Balance</th>' +
        '</tr></thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
        '<tfoot><tr class="total-row">' +
        '<td colspan="3" style="text-align:right; font-weight:bold;">Total Cumulative Turnover:</td>' +
        '<td style="text-align:right; font-weight:bold;">Rs. ' + totDr.toFixed(2) + '</td>' +
        '<td style="text-align:right; font-weight:bold;">Rs. ' + totCr.toFixed(2) + '</td>' +
        '<td style="text-align:right; font-weight:bold;">Rs. ' + runningBal.toFixed(2) + '</td>' +
        '</tr></tfoot>' +
        '</table>' +
        '</div>';
    }
  };

    // ==========================================================================
  // EXPLICIT PRINT ROUTERS (DESKTOP & MOBILE COMPATIBLE)
  // ==========================================================================
  window.triggerCashbookPrint = function () {
    document.body.classList.remove('print-mode-ledger');
    window.print();
  };

  window.triggerLedgerPrint = function () {
    // 1. Force the ledger engine to render latest data before print
    if (typeof window.renderLedgerSheet === 'function') {
      window.renderLedgerSheet();
    }

    // 2. Enable ledger print mode
    document.body.classList.add('print-mode-ledger');

    // 3. Listen for print completion before removing the class
    var cleanup = function () {
      document.body.classList.remove('print-mode-ledger');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    // 4. Trigger print with a slight delay so DOM styles settle
    setTimeout(function () {
      window.print();
    }, 150);
  };
  

  // ==========================================================================
  // 10. MULTI-MONTH ARCHIVE & PERSISTENCE
  // ==========================================================================
  window.consentTeacherAdvance = function () {
    if (window.pendingAdvanceAmount <= 0) return;
    var dEl = document.getElementById('tx-date');
    var advDate = dEl ? dEl.value : new Date().toISOString().split('T')[0];

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
    var banner = document.getElementById('advance-consent-banner');
    if (banner) banner.style.display = 'none';
    window.recalculateCashbook();
  };

  function getStorageKey(drawer, year, month) {
    return 'cashbook_rec_' + drawer + '_' + year + '_' + String(month).padStart(2, '0');
  }

  window.saveCurrentMonthRecord = function () {
    var drawer = window.currentDrawer;
    var yearEl = document.getElementById('cb-sel-year');
    var monthEl = document.getElementById('cb-sel-month');
    var year = yearEl ? yearEl.value : '';
    var month = monthEl ? monthEl.value : '';

    var opCashEl = document.getElementById('cb-op-cash');
    var opBankEl = document.getElementById('cb-op-bank');
    var opCash = opCashEl ? (parseFloat(opCashEl.value) || 0) : 0;
    var opBank = opBankEl ? (parseFloat(opBankEl.value) || 0) : 0;

    var totCashRec = opCash;
    var totBankRec = opBank;
    var totCashPay = 0;
    var totBankPay = 0;

    for (var i = 0; i < window.currentVouchers.length; i++) {
      var v = window.currentVouchers[i];
      var a = parseFloat(v.amount) || 0;
      if (v.type === 'RECEIPT') {
        if (v.channel === 'BANK') totBankRec += a; else totCashRec += a;
      } else if (v.type === 'WITHDRAWAL') {
        totCashRec += a; totBankPay += a;
      } else if (v.type === 'PAYMENT') {
        if (v.channel === 'BANK') totBankPay += a; else totCashPay += a;
      }
    }

    var closeCash = Math.max(0, totCashRec - totCashPay);
    var closeBank = Math.max(0, totBankRec - totBankPay);

    var catEl = document.getElementById('cb-mandate-cat');
    var rLpEl = document.getElementById('rate-lp');
    var mLpEl = document.getElementById('meals-lp');
    var rUpEl = document.getElementById('rate-up');
    var mUpEl = document.getElementById('meals-up');

    var payload = {
      drawer: drawer,
      year: year,
      month: month,
      category: catEl ? catEl.value : '',
      rateLp: rLpEl ? rLpEl.value : '',
      mealsLp: mLpEl ? mLpEl.value : '',
      rateUp: rUpEl ? rUpEl.value : '',
      mealsUp: mUpEl ? mUpEl.value : '',
      opCash: opCash,
      opBank: opBank,
      closeCash: closeCash,
      closeBank: closeBank,
      vouchers: window.currentVouchers,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(getStorageKey(drawer, year, month), JSON.stringify(payload));

    var nextMonth = parseInt(month, 10) + 1;
    var nextYear = parseInt(year, 10);
    if (nextMonth > 12) { nextMonth = 1; nextYear += 1; }

    var nextKey = getStorageKey(drawer, nextYear, nextMonth);
    var nextRecStr = localStorage.getItem(nextKey);
    var nextRec = nextRecStr ? JSON.parse(nextRecStr) : {};
    nextRec.opCash = closeCash;
    nextRec.opBank = closeBank;
    localStorage.setItem(nextKey, JSON.stringify(nextRec));

    alert('Cashbook for ' + month + '/' + year + ' permanently saved. C/B carried forward.');
    window.renderArchiveTray();
  };

  window.onCashbookPeriodChange = function () {
    var yearEl = document.getElementById('cb-sel-year');
    var monthEl = document.getElementById('cb-sel-month');
    var year = yearEl ? yearEl.value : '';
    var month = monthEl ? monthEl.value : '';
    window.loadMonthRecord(year, month);
  };

  window.loadMonthRecord = function (year, month) {
    var drawer = window.currentDrawer;
    var key = getStorageKey(drawer, year, month);
    var dataStr = localStorage.getItem(key);

    var yEl = document.getElementById('cb-sel-year');
    var mEl = document.getElementById('cb-sel-month');
    if (yEl) yEl.value = year;
    if (mEl) mEl.value = String(month).padStart(2, '0');

    if (dataStr) {
      var data = JSON.parse(dataStr);
      var catEl = document.getElementById('cb-mandate-cat');
      var rLpEl = document.getElementById('rate-lp');
      var mLpEl = document.getElementById('meals-lp');
      var rUpEl = document.getElementById('rate-up');
      var mUpEl = document.getElementById('meals-up');
      var opCashEl = document.getElementById('cb-op-cash');
      var opBankEl = document.getElementById('cb-op-bank');

      if (catEl) catEl.value = data.category || 'COMPOSITE';
      if (rLpEl) rLpEl.value = data.rateLp || '';
      if (mLpEl) mLpEl.value = data.mealsLp || '';
      if (rUpEl) rUpEl.value = data.rateUp || '';
      if (mUpEl) mUpEl.value = data.mealsUp || '';
      if (opCashEl) opCashEl.value = data.opCash !== undefined ? data.opCash : '';
      if (opBankEl) opBankEl.value = data.opBank !== undefined ? data.opBank : '';
      window.currentVouchers = data.vouchers || [];
    } else {
      var prevM = parseInt(month, 10) - 1;
      var prevY = parseInt(year, 10);
      if (prevM < 1) { prevM = 12; prevY -= 1; }

      var prevKey = getStorageKey(drawer, prevY, prevM);
      var prevDataStr = localStorage.getItem(prevKey);
      var opCEl = document.getElementById('cb-op-cash');
      var opBEl = document.getElementById('cb-op-bank');

      if (prevDataStr) {
        var prevData = JSON.parse(prevDataStr);
        if (opCEl) opCEl.value = prevData.closeCash !== undefined ? prevData.closeCash : 0;
        if (opBEl) opBEl.value = prevData.closeBank !== undefined ? prevData.closeBank : 0;
      } else {
        if (opCEl) opCEl.value = '';
        if (opBEl) opBEl.value = '';
      }

      var rLp = document.getElementById('rate-lp');
      var mLp = document.getElementById('meals-lp');
      var rUp = document.getElementById('rate-up');
      var mUp = document.getElementById('meals-up');
      if (rLp) rLp.value = '';
      if (mLp) mLp.value = '';
      if (rUp) rUp.value = '';
      if (mUp) mUp.value = '';
      window.currentVouchers = [];
    }
    window.updateCategoryVisibility();
    window.recalculateCashbook();
  };

  window.renderArchiveTray = function () {
    var tray = document.getElementById('archive-tray');
    if (!tray) return;
    tray.innerHTML = '';

    var drawer = window.currentDrawer;
    var prefix = 'cashbook_rec_' + drawer + '_';

    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(prefix) === 0) {
        try {
          var rec = JSON.parse(localStorage.getItem(key));
          if (!rec.savedAt) continue;
          var card = document.createElement('div');
          card.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#fff; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:6px; font-size:13px;';

          card.innerHTML = '<div>' +
            '<strong>' + rec.month + '/' + rec.year + '</strong> ' +
            '<span style="color:#64748b; font-size:11px;">(C/B Cash: Rs. ' + Number(rec.closeCash).toFixed(2) + ' | Bank: Rs. ' + Number(rec.closeBank).toFixed(2) + ')</span>' +
            '</div>' +
            '<div>' +
            '<button onclick="window.loadMonthRecord(\'' + rec.year + '\', \'' + rec.month + '\')" style="background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">View</button>' +
            '<button onclick="window.deleteRecord(\'' + key + '\')" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px; margin-left:4px;">Delete</button>' +
            '</div>';

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
  document.addEventListener('DOMContentLoaded', function () {
    window.updateCategoryVisibility();
    window.setTransactionType('RECEIPT');
    window.updateLedgerHeadFilterOptions();
    window.renderArchiveTray();
    window.recalculateCashbook();
  });
})(window);

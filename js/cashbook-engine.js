// =====================================================================
// DHK PM POSHAN & SCHOOL CASHBOOK PRO — CENTRAL RECONCILIATION ENGINE
// =====================================================================

window.currentEntryType = 'RECEIPT';

// ---------------------------------------------------------------------
// 1. STATUTORY AUDIT SCHEMAS (Strict Accounting Standards)
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// 2. NARRATION GENERATOR (Dynamic Meals & Month Support)
// ---------------------------------------------------------------------
function getDynamicNarrationText(item) {
  if (!item.isMealExpense) return item.text;

  const mealsEl = document.getElementById('mandate-meals') || 
                  document.getElementById('tx-meals') || 
                  document.querySelector('input[placeholder*="meal" i]');
  const monthEl = document.getElementById('filter-month') || 
                  document.getElementById('tx-month') || 
                  document.getElementById('month-select');

  const mealCount = (mealsEl && mealsEl.value) ? mealsEl.value.trim() : '';
  let monthName = '';

  if (monthEl) {
    monthName = monthEl.tagName === 'SELECT' 
      ? monthEl.options[monthEl.selectedIndex]?.text 
      : monthEl.value;
  }

  if (mealCount && monthName) {
    return `By Cooking Cost for ${mealCount} meals served in the month of ${monthName}`;
  } else if (mealCount) {
    return `By Cooking Cost for ${mealCount} meals served during this period`;
  } else if (monthName) {
    return `By Cooking Cost for meals served in the month of ${monthName}`;
  }
  return item.text;
}

// ---------------------------------------------------------------------
// 3. UI SYNC & NARRATION MODAL POPULATION
// ---------------------------------------------------------------------
window.renderEngineNarrations = function(type) {
  const drawer = window.currentDrawer || 'mdm';
  const schemaList = (window.ENGINE_SCHEMAS[drawer] && window.ENGINE_SCHEMAS[drawer][type]) 
    ? window.ENGINE_SCHEMAS[drawer][type] 
    : [];

  const modalBody = document.querySelector('#narration-options') 
    || document.querySelector('.narration-list-container')
    || document.querySelector('#modal-narration-body')
    || document.querySelector('#audit-narration-modal .modal-body');

  if (modalBody && modalBody.tagName !== 'SELECT') {
    modalBody.innerHTML = '';
    schemaList.forEach((item, index) => {
      const generatedText = getDynamicNarrationText(item);
      const row = document.createElement('label');
      row.style.cssText = 'display:flex; align-items:flex-start; gap:12px; margin-bottom:10px; cursor:pointer; padding:8px; border-radius:6px; border-bottom:1px solid #e2e8f0; background:#fff;';
      row.innerHTML = `
        <input type="radio" name="engine-narration-radio" value="${generatedText}" data-lf="${item.lf}" data-channel="${item.channel}" style="margin-top:3px;" ${index === 0 ? 'checked' : ''}>
        <div style="font-size:13px; color:#1e293b; line-height:1.45; font-weight:500;">${generatedText}</div>
      `;
      row.querySelector('input').addEventListener('change', () => {
        window.applyNarrationSelection(generatedText, item.lf, item.channel);
      });
      modalBody.appendChild(row);
    });

    // Custom Input Option
    const customRow = document.createElement('label');
    customRow.style.cssText = 'display:flex; align-items:center; gap:12px; margin-top:8px; cursor:pointer; padding:8px; border-radius:6px; background:#f8fafc; border:1px dashed #cbd5e1;';
    customRow.innerHTML = `
      <input type="radio" name="engine-narration-radio" value="CUSTOM" style="margin-top:2px;">
      <span style="font-size:13px; font-weight:600; color:#334155;">✏️ Type Custom Narration...</span>
    `;
    customRow.querySelector('input').addEventListener('change', () => {
      const descEl = document.getElementById('tx-desc');
      if (descEl) {
        descEl.value = '';
        descEl.focus();
      }
    });
    modalBody.appendChild(customRow);

    if (schemaList.length > 0) {
      const firstItem = schemaList[0];
      window.applyNarrationSelection(getDynamicNarrationText(firstItem), firstItem.lf, firstItem.channel);
    }
  }

  // Fallback for native select dropdowns
  const selectEl = document.getElementById('tx-narration-select');
  if (selectEl) {
    selectEl.innerHTML = '<option value="">-- Select Audit Head --</option>';
    schemaList.forEach(item => {
      const dynamicText = getDynamicNarrationText(item);
      const opt = document.createElement('option');
      opt.value = dynamicText;
      opt.innerText = dynamicText;
      opt.dataset.lf = item.lf;
      opt.dataset.channel = item.channel;
      selectEl.appendChild(opt);
    });
  }
};

window.applyNarrationSelection = function(text, lf, channel) {
  const descEl = document.getElementById('tx-desc');
  const lfEl = document.getElementById('tx-lf');
  const channelEl = document.getElementById('tx-channel');

  if (descEl) descEl.value = text;
  if (lfEl) lfEl.value = lf;
  if (channelEl && channel) channelEl.value = channel;
};

// ---------------------------------------------------------------------
// 4. TRANSACTION MODE CONTROLLER
// ---------------------------------------------------------------------
window.setTransactionType = function(type) {
  window.currentEntryType = type;

  const btnReceipt = document.querySelector('button[onclick*="RECEIPT"]');
  const btnWithdrawal = document.querySelector('button[onclick*="WITHDRAWAL"]');
  const btnPayment = document.querySelector('button[onclick*="PAYMENT"]');
  const channelEl = document.getElementById('tx-channel');

  // Reset button visual states
  [btnReceipt, btnWithdrawal, btnPayment].forEach(b => {
    if (b) {
      b.style.opacity = '0.55';
      b.style.outline = 'none';
      b.style.transform = 'scale(0.98)';
      b.style.boxShadow = 'none';
    }
  });

  if (type === 'RECEIPT' && btnReceipt) {
    btnReceipt.style.opacity = '1';
    btnReceipt.style.outline = '3px solid #16a34a';
    btnReceipt.style.transform = 'scale(1.02)';
    if (channelEl) channelEl.value = 'BANK';
  } else if (type === 'WITHDRAWAL' && btnWithdrawal) {
    btnWithdrawal.style.opacity = '1';
    btnWithdrawal.style.outline = '3px solid #2563eb';
    btnWithdrawal.style.transform = 'scale(1.02)';
    if (channelEl) channelEl.value = 'BANK';
  } else if (type === 'PAYMENT' && btnPayment) {
    btnPayment.style.opacity = '1';
    btnPayment.style.outline = '3px solid #dc2626';
    btnPayment.style.transform = 'scale(1.02)';
    if (channelEl) channelEl.value = 'CASH';
  }

  window.renderEngineNarrations(type);
};

// ---------------------------------------------------------------------
// 5. ADD & REMOVE TRANSACTION HANDLERS
// ---------------------------------------------------------------------
window.addCompleteTransaction = function() {
  const dateEl = document.getElementById('tx-date');
  const refEl = document.getElementById('tx-ref');
  const lfEl = document.getElementById('tx-lf');
  const descEl = document.getElementById('tx-desc');
  const amountEl = document.getElementById('tx-amount');
  const channelEl = document.getElementById('tx-channel');
  const headEl = document.getElementById('tx-ledger-head');

  const date = dateEl ? dateEl.value : '';
  const ref = (refEl && refEl.value.trim()) ? refEl.value.trim() : '-';
  const lf = (lfEl && lfEl.value.trim()) ? lfEl.value.trim() : (window.currentEntryType === 'WITHDRAWAL' ? 'C' : '-');
  let desc = descEl ? descEl.value.trim() : '';
  const amount = amountEl ? parseFloat(amountEl.value) || 0 : 0;
  const channel = channelEl ? channelEl.value : (window.currentEntryType === 'PAYMENT' ? 'CASH' : 'BANK');
  const headId = headEl ? headEl.value : '';

  if (!date) {
    alert("Please select the transaction date.");
    return;
  }
  if (!desc) {
    alert("Please enter or select a narration.");
    return;
  }
  if (amount <= 0) {
    alert("Please enter a valid amount greater than zero.");
    return;
  }

  // Dynamic cooking narration check if manual typing missed details
  const mealsEl = document.getElementById('mandate-meals') || document.getElementById('tx-meals');
  const monthEl = document.getElementById('filter-month') || document.getElementById('tx-month');
  if (window.currentEntryType === 'PAYMENT' && desc.toLowerCase().includes('cooking cost') && !desc.toLowerCase().includes('meals') && mealsEl && mealsEl.value) {
    const monthText = monthEl?.options ? monthEl.options[monthEl.selectedIndex]?.text : '';
    desc = `By Cooking Cost for ${mealsEl.value} meals served in the month of ${monthText || 'current period'}`;
  }

  if (!window.currentVouchers || !Array.isArray(window.currentVouchers)) {
    window.currentVouchers = [];
  }

  window.currentVouchers.push({
    id: Date.now(),
    date: date,
    type: window.currentEntryType,
    channel: channel,
    headId: headId,
    ref: ref,
    lf: (window.currentEntryType === 'WITHDRAWAL') ? 'C' : lf,
    desc: desc,
    amount: amount
  });

  if (descEl) descEl.value = '';
  if (amountEl) amountEl.value = '';
  if (refEl) refEl.value = '';

  window.recalculateCashbook();
};

window.removeVoucher = function(id) {
  if (window.currentVouchers && Array.isArray(window.currentVouchers)) {
    window.currentVouchers = window.currentVouchers.filter(v => String(v.id) !== String(id));
  }
  window.recalculateCashbook();
};

// ---------------------------------------------------------------------
// 6. MATHEMATICAL ENGINE & LEDGER RENDERER (Clean Double Entry)
// ---------------------------------------------------------------------
window.recalculateCashbook = function() {
  const opCashEl = document.getElementById('op-cash') || document.querySelector('input[name*="op_cash" i]');
  const opBankEl = document.getElementById('op-bank') || document.querySelector('input[name*="op_bank" i]');

  let cashInHand = opCashEl ? parseFloat(opCashEl.value) || 0 : 0;
  let bankBalance = opBankEl ? parseFloat(opBankEl.value) || 0 : 0;

  let totalReceiptsCash = cashInHand;
  let totalReceiptsBank = bankBalance;
  let totalPaymentsCash = 0;
  let totalPaymentsBank = 0;

  const tableBodyReceipts = document.getElementById('receipt-tbody') || document.getElementById('receipts-table-body');
  const tableBodyPayments = document.getElementById('payment-tbody') || document.getElementById('payments-table-body');

  let receiptsHtml = `
    <tr>
      <td>1st</td>
      <td><strong>To Opening Balance (b/f)</strong><br><small style="color:#64748b;">(Cash in hand & Bank balance brought forward)</small></td>
      <td>-</td>
      <td style="text-align:right;">${cashInHand.toFixed(2)}</td>
      <td style="text-align:right;">${bankBalance.toFixed(2)}</td>
      <td></td>
    </tr>
  `;
  let paymentsHtml = '';

  if (window.currentVouchers && Array.isArray(window.currentVouchers)) {
    // Sort vouchers chronologically
    window.currentVouchers.sort((a, b) => new Date(a.date) - new Date(b.date));

    window.currentVouchers.forEach(v => {
      const amt = parseFloat(v.amount) || 0;
      const d = v.date ? v.date.split('-')[2] : '-';

      if (v.type === 'RECEIPT') {
        const isBank = v.channel === 'BANK';
        if (isBank) totalReceiptsBank += amt;
        else totalReceiptsCash += amt;

        receiptsHtml += `
          <tr>
            <td>${d}</td>
            <td>${v.desc}</td>
            <td>${v.lf || '-'}</td>
            <td style="text-align:right;">${!isBank ? amt.toFixed(2) : '-'}</td>
            <td style="text-align:right;">${isBank ? amt.toFixed(2) : '-'}</td>
            <td style="text-align:center;"><button type="button" onclick="removeVoucher(${v.id})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-weight:bold;">✕</button></td>
          </tr>
        `;
      } else if (v.type === 'WITHDRAWAL') {
        // CONTRA ENTRY: Out of Bank, Into Cash
        totalReceiptsCash += amt;
        totalPaymentsBank += amt;

        receiptsHtml += `
          <tr style="background:#f0fdf4;">
            <td>${d}</td>
            <td>To Bank (Contra - Cash drawn for expenses)</td>
            <td>C</td>
            <td style="text-align:right;">${amt.toFixed(2)}</td>
            <td style="text-align:right;">-</td>
            <td style="text-align:center;"><button type="button" onclick="removeVoucher(${v.id})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-weight:bold;">✕</button></td>
          </tr>
        `;

        paymentsHtml += `
          <tr style="background:#eff6ff;">
            <td>${d}</td>
            <td>By Cash (Contra - Self Cheque drawn from bank)</td>
            <td>C</td>
            <td style="text-align:right;">-</td>
            <td style="text-align:right;">${amt.toFixed(2)}</td>
            <td style="text-align:center;"><button type="button" onclick="removeVoucher(${v.id})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-weight:bold;">✕</button></td>
          </tr>
        `;
      } else if (v.type === 'PAYMENT') {
        const isBank = v.channel === 'BANK';
        if (isBank) totalPaymentsBank += amt;
        else totalPaymentsCash += amt;

        paymentsHtml += `
          <tr>
            <td>${d}</td>
            <td>${v.desc}</td>
            <td>${v.lf || '-'}</td>
            <td style="text-align:right;">${!isBank ? amt.toFixed(2) : '-'}</td>
            <td style="text-align:right;">${isBank ? amt.toFixed(2) : '-'}</td>
            <td style="text-align:center;"><button type="button" onclick="removeVoucher(${v.id})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-weight:bold;">✕</button></td>
          </tr>
        `;
      }
    });
  }

  const closingCash = totalReceiptsCash - totalPaymentsCash;
  const closingBank = totalReceiptsBank - totalPaymentsBank;

  paymentsHtml += `
    <tr style="font-weight:600; background:#f8fafc;">
      <td>End</td>
      <td><strong>By Closing Balance (c/f to next month)</strong><br><small style="color:#64748b;">(Unspent Cash in hand & Bank balance)</small></td>
      <td>-</td>
      <td style="text-align:right;">${closingCash.toFixed(2)}</td>
      <td style="text-align:right;">${closingBank.toFixed(2)}</td>
      <td></td>
    </tr>
  `;

  if (tableBodyReceipts) tableBodyReceipts.innerHTML = receiptsHtml;
  if (tableBodyPayments) tableBodyPayments.innerHTML = paymentsHtml;

  // Sync Totals
  const elTotalReceipts = document.getElementById('display-total-receipts');
  const elTotalPayments = document.getElementById('display-total-payments');
  const elClosingCash = document.getElementById('display-closing-cash');
  const elClosingBank = document.getElementById('display-closing-bank');

  if (elTotalReceipts) elTotalReceipts.innerText = (totalReceiptsCash + totalReceiptsBank).toFixed(2);
  if (elTotalPayments) elTotalPayments.innerText = (totalPaymentsCash + totalPaymentsBank).toFixed(2);
  if (elClosingCash) elClosingCash.innerText = closingCash.toFixed(2);
  if (elClosingBank) elClosingBank.innerText = closingBank.toFixed(2);

  // Eliminate any legacy teacher debt banners
  const debtEl = document.getElementById('teacher-debt-note') || document.querySelector('.auditor-debt-warning');
  if (debtEl) debtEl.style.display = 'none';

  // Support older layout renderer if present
  if (typeof renderLedgerTable === 'function') {
    renderLedgerTable();
  }
};

// Initialize listeners on document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.setTransactionType('RECEIPT'));
} else {
  window.setTransactionType('RECEIPT');
  }
                 

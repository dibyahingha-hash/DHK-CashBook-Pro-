// =====================================================================
// CASHBOOK ENGINE: GLOBAL DOUBLE-ENTRY RECONCILIATION
// =====================================================================

window.currentEntryType = 'RECEIPT';

// 1. Transaction Mode Selector
window.setTransactionType = function(type) {
  window.currentEntryType = type;

  const btnReceipt = document.querySelector('button[onclick*="RECEIPT"]');
  const btnWithdrawal = document.querySelector('button[onclick*="WITHDRAWAL"]');
  const btnPayment = document.querySelector('button[onclick*="PAYMENT"]');
  const channelEl = document.getElementById('tx-channel');

  [btnReceipt, btnWithdrawal, btnPayment].forEach(b => {
    if (b) {
      b.style.opacity = '0.6';
      b.style.boxShadow = 'none';
      b.style.outline = 'none';
    }
  });

  if (type === 'RECEIPT' && btnReceipt) {
    btnReceipt.style.opacity = '1';
    btnReceipt.style.outline = '2px solid #16a34a';
    if (channelEl) channelEl.value = 'BANK';
  } else if (type === 'WITHDRAWAL' && btnWithdrawal) {
    btnWithdrawal.style.opacity = '1';
    btnWithdrawal.style.outline = '2px solid #2563eb';
    if (channelEl) channelEl.value = 'BANK';
  } else if (type === 'PAYMENT' && btnPayment) {
    btnPayment.style.opacity = '1';
    btnPayment.style.outline = '2px solid #dc2626';
    if (channelEl) channelEl.value = 'CASH';
  }
};

// 2. Add Entry Handler
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
  const lf = (lfEl && lfEl.value.trim()) ? lfEl.value.trim() : '-';
  const desc = descEl ? descEl.value.trim() : '';
  const amount = amountEl ? parseFloat(amountEl.value) || 0 : 0;
  const channel = channelEl ? channelEl.value : 'CASH';
  const headId = headEl ? headEl.value : '';

  if (!date) {
    alert("Please select the transaction date.");
    return;
  }
  if (!desc) {
    alert("Please enter a description / narration.");
    return;
  }
  if (amount <= 0) {
    alert("Please enter a valid amount greater than zero.");
    return;
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

// 3. Delete Entry Handler
window.removeVoucher = function(id) {
  if (window.currentVouchers && Array.isArray(window.currentVouchers)) {
    window.currentVouchers = window.currentVouchers.filter(v => String(v.id) !== String(id));
  }
  window.recalculateCashbook();
};

// 4. Double-Entry Calculation Engine (Strict Cash & Bank Isolation)
window.recalculateCashbook = function() {
  const opCashEl = document.getElementById('op-cash');
  const opBankEl = document.getElementById('op-bank');

  let cashInHand = opCashEl ? parseFloat(opCashEl.value) || 0 : 0;
  let bankBalance = opBankEl ? parseFloat(opBankEl.value) || 0 : 0;

  let totalReceiptsCash = cashInHand;
  let totalReceiptsBank = bankBalance;
  let totalPaymentsCash = 0;
  let totalPaymentsBank = 0;

  if (window.currentVouchers && Array.isArray(window.currentVouchers)) {
    window.currentVouchers.forEach(v => {
      const amt = parseFloat(v.amount) || 0;

      if (v.type === 'RECEIPT') {
        if (v.channel === 'BANK') {
          totalReceiptsBank += amt;
        } else {
          totalReceiptsCash += amt;
        }
      } else if (v.type === 'WITHDRAWAL') {
        // Contra Entry: Out of Bank, Into Cash
        totalReceiptsCash += amt;
        totalPaymentsBank += amt;
      } else if (v.type === 'PAYMENT') {
        if (v.channel === 'BANK') {
          totalPaymentsBank += amt;
        } else {
          totalPaymentsCash += amt;
        }
      }
    });
  }

  const closingCash = totalReceiptsCash - totalPaymentsCash;
  const closingBank = totalReceiptsBank - totalPaymentsBank;

  const elTotalReceipts = document.getElementById('display-total-receipts');
  const elTotalPayments = document.getElementById('display-total-payments');
  const elClosingCash = document.getElementById('display-closing-cash');
  const elClosingBank = document.getElementById('display-closing-bank');

  if (elTotalReceipts) elTotalReceipts.innerText = (totalReceiptsCash + totalReceiptsBank).toFixed(2);
  if (elTotalPayments) elTotalPayments.innerText = (totalPaymentsCash + totalPaymentsBank).toFixed(2);
  if (elClosingCash) elClosingCash.innerText = closingCash.toFixed(2);
  if (elClosingBank) elClosingBank.innerText = closingBank.toFixed(2);

  if (typeof renderLedgerTable === 'function') {
    renderLedgerTable();
  }
};


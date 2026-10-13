
/**
 * narration-engine.js
 * Statutory Narration & Folio Engine for School Cashbooks (MDM, SMC, SNA)
 * Strictly decoupled from Cashbook Math Engine.
 */

(function (window) {
  'use strict';

  // Utility helper to sanitize text and insert audit underlines if blank
  const sanitize = (val, fallback = '____________') => {
    if (!val || typeof val !== 'string' || val.trim() === '') {
      return fallback;
    }
    return val.trim();
  };

  const NarrationEngine = {
    /**
     * Resolves default statutory Ledger Folio (L/F)
     * Allows custom user folio to take priority if provided.
     */
    resolveFolio: function ({ drawer, type, category, userFolio = '' }) {
      if (userFolio && String(userFolio).trim() !== '') {
        return String(userFolio).trim();
      }

      // Contra entries always use Folio 'C'
      if (category === 'CONTRA' || category === 'CONTRA_COOKING' || category === 'CONTRA_OTHER') {
        return 'C';
      }

      if (drawer === 'MDM') {
        if (category === 'COOKING_COST') return type === 'payment' ? '1' : '5';
        if (category === 'GRANT_COOKING') return '5';
        if (category === 'INTEREST') return '7';
        if (category === 'TEACHER_ADVANCE') return '9';
        if (category === 'UTENSILS') return '11';
        if (category === 'CARRIAGE') return '13';
        if (category === 'BANK_CHARGES') return '7';
      }

      if (drawer === 'SMC_SAVINGS') {
        if (category === 'INTEREST' || category === 'BANK_CHARGES') return '7';
        if (category === 'MAINTENANCE_GRANT') return '5';
      }

      // Default fallback for custom heads
      return '';
    },

    /**
     * Live Narration Generator
     * Assembles audit-compliant double entry sentences.
     */
    generate: function (params) {
      const {
        drawer,           // 'MDM', 'SMC_SAVINGS', 'CANARA_SNA'
        type,             // 'receipt' or 'payment'
        channel,          // 'CASH', 'CHEQUE', 'PPA', 'AUTO_DEBIT'
        category,         // Preset category key or 'CUSTOM'
        purpose = '',     // User-typed purpose / reason
        refNo = '',       // Voucher / Sub-Voucher / Cheque / PPA / Sanction No.
        date = '',        // Instrument / Sanction Date
        payee = '',       // Vendor / Payee Name
        period = ''       // Month / Quarter / Year string
      } = params;

      const ref = sanitize(refNo);
      const dt = sanitize(date);
      const pay = sanitize(payee);
      const prd = sanitize(period);
      const pur = sanitize(purpose);

      // ==========================================
      // 1. MDM SAVINGS DRAWER
      // ==========================================
      if (drawer === 'MDM') {
        // --- MDM RECEIPTS ---
        if (type === 'receipt') {
          switch (category) {
            case 'GRANT_COOKING':
            case 'COOKING_COST':
              return `To PM POSHAN (Cooking Cost)\n(Being Cooking Cost grant credited for the month of ${prd} vide Sanction/Advice No. ${ref} dated ${dt})`;

            case 'INTEREST':
              return `To Bank Interest\n(Being savings bank interest credited by bank for the period ${prd})`;

            case 'CARRIAGE':
              return `To Food Grain Transportation Subsidy\n(Being food grain transportation/carriage subsidy credited to savings account vide Order/Advice No. ${ref} dated ${dt})`;

            case 'UTENSILS':
              return `To Kitchen Devices & Utensils Grant\n(Being grant received for procurement/replacement of kitchen devices & utensils vide Sanction Order No. ${ref} dated ${dt})`;

            case 'TEACHER_ADVANCE':
              return `To Temporary Advance (Head Teacher)\n(Being temporary advance incurred by teacher to meet cooking cost due to grant shortage)`;

            case 'CONTRA':
            case 'CONTRA_COOKING':
              return `To MDM Savings Account (Contra)\n(Cash brought into hand for cooking cost for the month of ${prd} vide Cheque No. ${ref} dated ${dt})`;

            case 'CONTRA_OTHER':
              return `To MDM Savings Account (Contra)\n(Cash brought into hand for ${pur} vide Cheque No. ${ref} dated ${dt})`;

            case 'CUSTOM':
            default:
              return `To ${pur} Account\n(Being funds/grant received towards ${pur} credited to MDM account vide Order/Sanction No. ${ref} dated ${dt})`;
          }
        }

        // --- MDM PAYMENTS ---
        if (type === 'payment') {
          // Cash Channel
          if (channel === 'CASH') {
            if (category === 'COOKING_COST') {
              return `By Cooking Cost\n(Being cash expenditure incurred towards marketing of meals vide Sub-Voucher No. ${ref})`;
            }
            if (category === 'TEACHER_ADVANCE') {
              return `By Temporary Advance (Head Teacher)\n(Being reimbursement of temporary advance incurred in previous period refunded to teacher)`;
            }
            return `By ${pur}\n(Being cash payment incurred towards ${pur} vide Sub-Voucher No. ${ref})`;
          }

          // Cheque Channel
          if (channel === 'CHEQUE') {
            if (category === 'CONTRA_COOKING') {
              return `By Cash in Hand (Contra)\n(Contra cash withdrawn from bank for cooking cost for the month of ${prd} vide Cheque No. ${ref} dated ${dt})`;
            }
            if (category === 'CONTRA_OTHER') {
              return `By Cash in Hand (Contra)\n(Contra cash withdrawn from bank for ${pur} vide Cheque No. ${ref} dated ${dt})`;
            }
            if (category === 'VENDOR') {
              return `By ${pur} Account\n(Being amount paid to M/s ${pay} towards ${pur} vide Cheque No. ${ref} dated ${dt})`;
            }
            return `By ${pur} Account\n(Being payment made towards ${pur} vide Cheque No. ${ref} dated ${dt})`;
          }

          // Direct Bank Deductions (SMS / Bank charges)
          if (channel === 'AUTO_DEBIT' || category === 'BANK_CHARGES') {
            return `By Bank Charges\n(Being SMS alert/ledger maintenance charges debited by bank for the period ${prd})`;
          }
        }
      }

      // ==========================================
      // 2. SMC SAVINGS DRAWER
      // ==========================================
      if (drawer === 'SMC_SAVINGS') {
        // --- SMC RECEIPTS ---
        if (type === 'receipt') {
          if (category === 'INTEREST') {
            return `To Bank Interest\n(Being savings bank interest credited by bank for the period ${prd})`;
          }
          if (category === 'CONTRA') {
            return `To SMC Savings Account (Contra)\n(Cash withdrawn from bank for school expenses vide Cheque No. ${ref} dated ${dt})`;
          }
          return `To ${pur} Grant Account\n(Being grant received towards ${pur} credited to SMC account vide Sanction No. ${ref} dated ${dt})`;
        }

        // --- SMC PAYMENTS ---
        if (type === 'payment') {
          if (channel === 'CASH') {
            return `By School Maintenance & Contingency\n(Being cash payment incurred towards ${pur} vide Voucher No. ${ref})`;
          }
          if (category === 'CONTRA') {
            return `By Cash in Hand (Contra)\n(Contra cash withdrawn from bank for school expenses vide Cheque No. ${ref} dated ${dt})`;
          }
          if (channel === 'AUTO_DEBIT' || category === 'BANK_CHARGES') {
            return `By Bank Charges\n(Being SMS alert/ledger maintenance charges debited by bank for the period ${prd})`;
          }
          return `By ${pur} Grant Account\n(Being amount paid to M/s ${pay} towards ${pur} vide Cheque No. ${ref} dated ${dt})`;
        }
      }

      // ==========================================
      // 3. SMC CANARA BANK SNA DRAWER
      // ==========================================
      if (drawer === 'CANARA_SNA') {
        if (type === 'receipt') {
          return `To ${pur} Component Allocation\n(Being drawing limit credited under Canara SNA portal towards ${pur} vide Sanction/FTO No. ${ref} dated ${dt})`;
        }
        if (type === 'payment') {
          return `By ${pur} Component Account\n(Being amount disbursed to M/s ${pay} towards ${pur} vide Canara SNA PPA No. ${ref} dated ${dt})`;
        }
      }

      // Universal Generic Fallback
      return `(Being transaction recorded towards ${pur})`;
    }
  };

  // Expose globally to window
  window.NarrationEngine = NarrationEngine;

})(typeof window !== 'undefined' ? window : this);
 

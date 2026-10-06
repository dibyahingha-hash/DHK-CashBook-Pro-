/**
 * js/stock.js
 * PM POSHAN Monthly Stock Register & Monthly Aggregation Engine
 */

const StockModule = {
  // Key generator: stock_YYYY-MM
  getKey(ymStr) {
    return `stock_${ymStr}`;
  },

  // Save monthly stock data
  save(ymStr, data) {
    StorageEngine.set(this.getKey(ymStr), data);
  },

  // Retrieve monthly stock data
  get(ymStr) {
    return StorageEngine.get(this.getKey(ymStr), null);
  }
};

// Main function called when clicking the Stock tab
function renderStockView() {
  const container = document.getElementById('stock-container');
  if (!container) return;

  const currentYm = document.getElementById('stock-view-ym')?.value || new Date().toISOString().substring(0, 7);

  container.innerHTML = `
    <!-- Top Entry & Calculation Card -->
    <div class="card no-print">
      <h2 class="card-title">PM POSHAN Monthly Stock & Cost Register</h2>
      
      <div class="grid-2 form-group">
        <div>
          <label>Select Month</label>
          <input type="month" id="stock-view-ym" value="${currentYm}" onchange="loadStockData()">
        </div>
        <div style="display:flex; align-items:center; gap:8px; padding-top:16px;">
          <input type="checkbox" id="stock-auto-sync" checked onchange="toggleAutoSync()" style="width:20px; height:20px; cursor:pointer;">
          <label for="stock-auto-sync" style="cursor:pointer; margin:0; font-size:0.8rem; font-weight:700; color:var(--primary);">
            Auto-Calculate from Daily Log
          </label>
        </div>
      </div>

      <div class="grid-2 form-group">
        <div>
          <label>Total Working Days</label>
          <input type="number" id="stk-wd" min="0" oninput="calculateStock()">
        </div>
        <div>
          <label>LP Meals Fed (Classes 1–5)</label>
          <input type="number" id="stk-lp" min="0" oninput="calculateStock()">
        </div>
      </div>

      <div class="grid-2 form-group">
        <div>
          <label>UP Meals Fed (Classes 6–8)</label>
          <input type="number" id="stk-up" min="0" oninput="calculateStock()">
        </div>
        <div>
          <label>Total Meals Served</label>
          <input type="number" id="stk-tot-meals" disabled style="background:#e2e8f0; font-weight:bold;">
        </div>
      </div>

      <h3 class="section-subtitle">Food Grains (Rice in kg)</h3>
      <div class="grid-2 form-group">
        <div>
          <label>Rice Opening Stock (kg)</label>
          <input type="number" step="0.001" id="stk-rice-op" value="0.000" oninput="calculateStock()">
        </div>
        <div>
          <label>Rice Received from FCI/Godown (kg)</label>
          <input type="number" step="0.001" id="stk-rice-rec" value="0.000" oninput="calculateStock()">
        </div>
      </div>

      <h3 class="section-subtitle">Cooking Cost Entitlement (Rs.)</h3>
      <div class="grid-2 form-group">
        <div>
          <label>Opening Cooking Cost (Deficit allowed, e.g. -1500)</label>
          <input type="text" inputmode="decimal" id="stk-cost-op" value="0.00" oninput="calculateStock()">
        </div>
        <div>
          <label>Grant Received in Bank (Rs.)</label>
          <input type="number" step="0.01" id="stk-cost-rec" value="0.00" oninput="calculateStock()">
        </div>
      </div>

      <button class="btn btn-print" onclick="window.print()">🖨️ Export / Print Stock Register (PDF)</button>
    </div>

    <!-- Statutory Inspection-Ready Audit Sheet -->
    <div class="card" id="stock-printable-card">
      <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom:6px; margin-bottom:10px;">
        <h2 style="margin:0; font-size:1.1rem; text-transform:uppercase;" id="prt-school-name">ASSAM PRIMARY SCHOOL</h2>
        <h3 style="margin:2px 0; font-size:0.85rem;" id="prt-school-udise">UDISE: 18010100101 | BLOCK: KALIABOR</h3>
        <h4 style="margin:4px 0 0 0; font-size:0.95rem; color:var(--primary);">PM POSHAN (MID-DAY MEAL) MONTHLY STOCK REGISTER</h4>
        <p style="margin:2px 0 0 0; font-size:0.8rem;">Month: <b id="prt-stock-month">${currentYm}</b></p>
      </div>

      <table>
        <thead>
          <tr style="background:#e2e8f0;">
            <th style="width:70%;">Particulars</th>
            <th class="num" style="width:30%;">Quantities / Values</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total School Working Days in Month</td>
            <td class="num" id="prt-wd">0</td>
          </tr>
          <tr>
            <td>Lower Primary (LP) Meals Fed</td>
            <td class="num" id="prt-lp">0</td>
          </tr>
          <tr>
            <td>Upper Primary (UP) Meals Fed</td>
            <td class="num" id="prt-up">0</td>
          </tr>
          <tr style="font-weight:bold; background:#f8fafc;">
            <td>Total Meals Served</td>
            <td class="num" id="prt-tot-meals">0</td>
          </tr>

          <!-- Rice Grain Section -->
          <tr style="background:#e2e8f0; font-weight:bold;">
            <td colspan="2">1. FOOD GRAIN (RICE) RECORD IN KG</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;Opening Balance of Rice b/f</td>
            <td class="num" id="prt-rice-op">0.000 kg</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;Rice Received during the Month</td>
            <td class="num" id="prt-rice-rec">0.000 kg</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;Total Rice Available (Opening + Received)</td>
            <td class="num" id="prt-rice-tot">0.000 kg</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;Rice Consumed (@100g LP / @150g UP)</td>
            <td class="num" id="prt-rice-cons">0.000 kg</td>
          </tr>
          <tr style="font-weight:bold; background:#f8fafc;">
            <td>&nbsp;&nbsp;Closing Stock Balance of Rice c/f</td>
            <td class="num" id="prt-rice-cl">0.000 kg</td>
          </tr>

          <!-- Cooking Cost Section -->
          <tr style="background:#e2e8f0; font-weight:bold;">
            <td colspan="2">2. COOKING COST FINANCIAL RECORD (IN RS.)</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;Opening Cooking Cost Balance / Past Deficit</td>
            <td class="num" id="prt-cost-op">Rs. 0.00</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;Cooking Cost Grant Received during the Month</td>
            <td class="num" id="prt-cost-rec">Rs. 0.00</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;Total Funds Available (Opening + Received)</td>
            <td class="num" id="prt-cost-avail">Rs. 0.00</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;Total Cooking Cost Expenditure / Entitlement</td>
            <td class="num" id="prt-cost-exp">Rs. 0.00</td>
          </tr>
          <tr style="font-weight:bold; background:#f8fafc;">
            <td>&nbsp;&nbsp;Closing Status (Surplus / Deficit) c/f</td>
            <td class="num" id="prt-cost-cl">Rs. 0.00</td>
          </tr>
        </tbody>
      </table>

      <!-- Statutory Signatures -->
      <div style="display:flex; justify-content:space-between; margin-top:40px; font-size:0.8rem;">
        <div>
          _______________________________________<br>
          <b>Signature of Teacher-in-Charge / Cook</b>
        </div>
        <div style="text-align:right;">
          _______________________________________<br>
          <b>Signature of Head Teacher / SMC President</b>
        </div>
      </div>
    </div>
  `;

  loadStockData();
}

// Toggle whether inputs are populated from Daily module or overridden manually
function toggleAutoSync() {
  const isAuto = document.getElementById('stock-auto-sync').checked;
  const wdInput = document.getElementById('stk-wd');
  const lpInput = document.getElementById('stk-lp');
  const upInput = document.getElementById('stk-up');

  if (isAuto) {
    wdInput.setAttribute('disabled', 'true');
    lpInput.setAttribute('disabled', 'true');
    upInput.setAttribute('disabled', 'true');
    wdInput.style.background = '#e2e8f0';
    lpInput.style.background = '#e2e8f0';
    upInput.style.background = '#e2e8f0';
    pullFromDailyLog();
  } else {
    wdInput.removeAttribute('disabled');
    lpInput.removeAttribute('disabled');
    upInput.removeAttribute('disabled');
    wdInput.style.background = '#fff';
    lpInput.style.background = '#fff';
    upInput.style.background = '#fff';
  }
  calculateStock();
}

// Automatically pulls aggregated totals from daily records
function pullFromDailyLog() {
  const ym = document.getElementById('stock-view-ym').value;
  const totals = DailyModule.getMonthlyTotals(ym);

  document.getElementById('stk-wd').value = totals.workingDays;
  document.getElementById('stk-lp').value = totals.totalLpMeals;
  document.getElementById('stk-up').value = totals.totalUpMeals;
}

// Core Math & UI update
function calculateStock() {
  const ym = document.getElementById('stock-view-ym').value;
  const profile = ProfileModule.getProfile();

  const wd = parseInt(document.getElementById('stk-wd').value) || 0;
  const lp = parseInt(document.getElementById('stk-lp').value) || 0;
  const up = parseInt(document.getElementById('stk-up').value) || 0;
  const totMeals = lp + up;
  document.getElementById('stk-tot-meals').value = totMeals;

  const riceOp = parseFloat(document.getElementById('stk-rice-op').value) || 0;
  const riceRec = parseFloat(document.getElementById('stk-rice-rec').value) || 0;

  // Deficit parser (allows negative numbers e.g. -1250.50)
  const rawCostOp = document.getElementById('stk-cost-op').value.trim();
  const costOp = (!isNaN(parseFloat(rawCostOp))) ? parseFloat(rawCostOp) : 0.0;
  const costRec = parseFloat(document.getElementById('stk-cost-rec').value) || 0;

  // Statutory math formulas
  const riceCons = Number(((lp * profile.rice_lp) + (up * profile.rice_up)).toFixed(3));
  const riceTotAvail = Number((riceOp + riceRec).toFixed(3));
  const riceCl = Number((riceTotAvail - riceCons).toFixed(3));

  const costExp = Number(((lp * profile.rate_lp) + (up * profile.rate_up)).toFixed(2));
  const costAvail = Number((costOp + costRec).toFixed(2));
  const costCl = Number((costAvail - costExp).toFixed(2));

  // Save state
  const isAuto = document.getElementById('stock-auto-sync')?.checked ?? true;
  const stockData = {
    ym, isAuto, wd, lp, up, totMeals,
    riceOp, riceRec, riceTotAvail, riceCons, riceCl,
    costOp, costRec, costAvail, costExp, costCl
  };
  StockModule.save(ym, stockData);

  // Update Printable Audit View
  document.getElementById('prt-school-name').innerText = profile.schoolName || 'ASSAM PRIMARY SCHOOL';
  document.getElementById('prt-school-udise').innerText = `UDISE: ${profile.udise || 'Not Configured'} | BLOCK: ${profile.block || '-'}`;
  document.getElementById('prt-stock-month').innerText = ym;

  document.getElementById('prt-wd').innerText = wd;
  document.getElementById('prt-lp').innerText = lp;
  document.getElementById('prt-up').innerText = up;
  document.getElementById('prt-tot-meals').innerText = totMeals;

  document.getElementById('prt-rice-op').innerText = riceOp.toFixed(3) + ' kg';
  document.getElementById('prt-rice-rec').innerText = riceRec.toFixed(3) + ' kg';
  document.getElementById('prt-rice-tot').innerText = riceTotAvail.toFixed(3) + ' kg';
  document.getElementById('prt-rice-cons').innerText = riceCons.toFixed(3) + ' kg';
  document.getElementById('prt-rice-cl').innerText = riceCl.toFixed(3) + ' kg';

  document.getElementById('prt-cost-op').innerText = costOp < 0 ? `-Rs. ${Math.abs(costOp).toFixed(2)} (Deficit)` : `Rs. ${costOp.toFixed(2)}`;
  document.getElementById('prt-cost-rec').innerText = 'Rs. ' + costRec.toFixed(2);
  document.getElementById('prt-cost-avail').innerText = costAvail < 0 ? `-Rs. ${Math.abs(costAvail).toFixed(2)} (Deficit)` : `Rs. ${costAvail.toFixed(2)}`;
  document.getElementById('prt-cost-exp').innerText = 'Rs. ' + costExp.toFixed(2);
  document.getElementById('prt-cost-cl').innerText = costCl < 0 ? `-Rs. ${Math.abs(costCl).toFixed(2)} (Deficit)` : `Rs. ${costCl.toFixed(2)} (Surplus)`;
}

// Load Month Data
function loadStockData() {
  const ym = document.getElementById('stock-view-ym').value;
  const saved = StockModule.get(ym);

  if (saved) {
    document.getElementById('stock-auto-sync').checked = saved.isAuto;
    document.getElementById('stk-wd').value = saved.wd;
    document.getElementById('stk-lp').value = saved.lp;
    document.getElementById('stk-up').value = saved.up;
    document.getElementById('stk-rice-op').value = saved.riceOp;
    document.getElementById('stk-rice-rec').value = saved.riceRec;
    document.getElementById('stk-cost-op').value = saved.costOp;
    document.getElementById('stk-cost-rec').value = saved.costRec;
  } else {
    document.getElementById('stock-auto-sync').checked = true;
    document.getElementById('stk-rice-op').value = '0.000';
    document.getElementById('stk-rice-rec').value = '0.000';
    document.getElementById('stk-cost-op').value = '0.00';
    document.getElementById('stk-cost-rec').value = '0.00';
    pullFromDailyLog();
  }

  toggleAutoSync();
                          }


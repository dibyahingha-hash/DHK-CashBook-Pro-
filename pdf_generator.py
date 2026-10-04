import os
from fpdf import FPDF

class CashBookPDF(FPDF):
    def header(self):
        pass

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')


def generate_cashbook_pdf(account_name, ym, data, output_path="CashBook.pdf"):
    """
    Renders the exact Assam 2-page Cash Book Spread:
    Page 1: RECEIPTS (Dr.)
    Page 2: PAYMENTS (Cr.)
    """
    summary = data.get("summary", {})
    entries = data.get("entries", [])

    op_cash = summary.get('op_cash', 0.0)
    op_bank = summary.get('op_bank', 0.0)
    cl_cash = summary.get('cl_cash', 0.0)
    cl_bank = summary.get('cl_bank', 0.0)
    tot_dr_cash = summary.get('dr_cash', 0.0)
    tot_dr_bank = summary.get('dr_bank', 0.0)
    tot_cr_cash = summary.get('cr_cash', 0.0)
    tot_cr_bank = summary.get('cr_bank', 0.0)

    pdf = CashBookPDF(orientation='L', unit='mm', format='A4')
    pdf.set_auto_page_break(auto=False, margin=15)

    # ------------------ PAGE 1: RECEIPTS (Dr.) ------------------
    pdf.add_page()
    pdf.set_font('Helvetica', 'B', 14)
    pdf.cell(0, 8, f"{account_name.upper()} - CASH BOOK REGISTER (RECEIPTS / Dr.)", ln=True, align='C')
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(0, 6, f"For the Month of: {ym}", ln=True, align='C')
    pdf.ln(4)

    # Columns: Date(22) | Particulars(120) | LF(12) | Cash(35) | Bank(35) | Total(38) = 262mm
    pdf.set_font('Helvetica', 'B', 8)
    pdf.set_fill_color(230, 235, 245)
    pdf.cell(22, 7, "Month & Date", 1, 0, 'C', fill=True)
    pdf.cell(120, 7, "PARTICULARS", 1, 0, 'L', fill=True)
    pdf.cell(12, 7, "LF", 1, 0, 'C', fill=True)
    pdf.cell(35, 7, "Cash Amount (Rs.)", 1, 0, 'R', fill=True)
    pdf.cell(35, 7, "Bank Amount (Rs.)", 1, 0, 'R', fill=True)
    pdf.cell(38, 7, "Total Amount (Rs.)", 1, 1, 'R', fill=True)

    # Line 1: Opening balance
    pdf.set_font('Helvetica', '', 8)
    pdf.cell(22, 6, f"{ym}-01", 1, 0, 'C')
    pdf.cell(120, 6, "To Opening Balance b/f (Cash & Bank Balances)", 1, 0, 'L')
    pdf.cell(12, 6, "-", 1, 0, 'C')
    pdf.cell(35, 6, f"{op_cash:.2f}", 1, 0, 'R')
    pdf.cell(35, 6, f"{op_bank:.2f}", 1, 0, 'R')
    pdf.cell(38, 6, f"{(op_cash + op_bank):.2f}", 1, 1, 'R')

    rows_count = 1
    for e in entries:
        e_type = e.get('entry_type')
        c_amt = float(e.get('cash_amount') or 0.0)
        b_amt = float(e.get('bank_amount') or 0.0)

        if e_type == 'RECEIPT':
            pdf.cell(22, 6, str(e.get('entry_date', '')), 1, 0, 'C')
            pdf.cell(120, 6, f"To {e.get('particulars')}", 1, 0, 'L')
            pdf.cell(12, 6, str(e.get('voucher_no', '-')), 1, 0, 'C')
            pdf.cell(35, 6, f"{c_amt:.2f}" if c_amt > 0 else "-", 1, 0, 'R')
            pdf.cell(35, 6, f"{b_amt:.2f}" if b_amt > 0 else "-", 1, 0, 'R')
            pdf.cell(38, 6, f"{(c_amt + b_amt):.2f}", 1, 1, 'R')
            rows_count += 1
        elif e_type == 'CONTRA':
            pdf.cell(22, 6, str(e.get('entry_date', '')), 1, 0, 'C')
            pdf.cell(120, 6, f"To Bank (Cash Withdrawn vide Slip/Chq No. {e.get('voucher_no', '-')})", 1, 0, 'L')
            pdf.cell(12, 6, "C", 1, 0, 'C')
            pdf.cell(35, 6, f"{c_amt:.2f}", 1, 0, 'R')
            pdf.cell(35, 6, "-", 1, 0, 'R')
            pdf.cell(38, 6, f"{c_amt:.2f}", 1, 1, 'R')
            rows_count += 1

    # Blank filler rows to match physical book height
    while rows_count < 14:
        pdf.cell(22, 6, "", 1, 0)
        pdf.cell(120, 6, "", 1, 0)
        pdf.cell(12, 6, "", 1, 0)
        pdf.cell(35, 6, "", 1, 0)
        pdf.cell(35, 6, "", 1, 0)
        pdf.cell(38, 6, "", 1, 1)
        rows_count += 1

    # Total Receipts Line
    pdf.set_font('Helvetica', 'B', 8)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(22, 7, "TOTAL", 1, 0, 'C', fill=True)
    pdf.cell(120, 7, "Total Receipts Carried Over", 1, 0, 'L', fill=True)
    pdf.cell(12, 7, "", 1, 0, 'C', fill=True)
    pdf.cell(35, 7, f"{tot_dr_cash:.2f}", 1, 0, 'R', fill=True)
    pdf.cell(35, 7, f"{tot_dr_bank:.2f}", 1, 0, 'R', fill=True)
    pdf.cell(38, 7, f"{(tot_dr_cash + tot_dr_bank):.2f}", 1, 1, 'R', fill=True)

    # ------------------ PAGE 2: PAYMENTS (Cr.) ------------------
    pdf.add_page()
    pdf.set_font('Helvetica', 'B', 14)
    pdf.cell(0, 8, f"{account_name.upper()} - CASH BOOK REGISTER (PAYMENTS / Cr.)", ln=True, align='C')
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(0, 6, f"For the Month of: {ym}", ln=True, align='C')
    pdf.ln(4)

    pdf.set_font('Helvetica', 'B', 8)
    pdf.set_fill_color(230, 235, 245)
    pdf.cell(22, 7, "Month & Date", 1, 0, 'C', fill=True)
    pdf.cell(120, 7, "PARTICULARS", 1, 0, 'L', fill=True)
    pdf.cell(12, 7, "Voucher/LF", 1, 0, 'C', fill=True)
    pdf.cell(35, 7, "Cash Amount (Rs.)", 1, 0, 'R', fill=True)
    pdf.cell(35, 7, "Bank Amount (Rs.)", 1, 0, 'R', fill=True)
    pdf.cell(38, 7, "Total Amount (Rs.)", 1, 1, 'R', fill=True)

    pdf.set_font('Helvetica', '', 8)
    rows_cr = 0
    for e in entries:
        e_type = e.get('entry_type')
        c_amt = float(e.get('cash_amount') or 0.0)
        b_amt = float(e.get('bank_amount') or 0.0)

        if e_type == 'PAYMENT':
            pdf.cell(22, 6, str(e.get('entry_date', '')), 1, 0, 'C')
            pdf.cell(120, 6, f"By {e.get('particulars')} (Voucher No. {e.get('voucher_no', '-')})", 1, 0, 'L')
            pdf.cell(12, 6, str(e.get('voucher_no', '-')), 1, 0, 'C')
            pdf.cell(35, 6, f"{c_amt:.2f}" if c_amt > 0 else "-", 1, 0, 'R')
            pdf.cell(35, 6, f"{b_amt:.2f}" if b_amt > 0 else "-", 1, 0, 'R')
            pdf.cell(38, 6, f"{(c_amt + b_amt):.2f}", 1, 1, 'R')
            rows_cr += 1
        elif e_type == 'CONTRA':
            pdf.cell(22, 6, str(e.get('entry_date', '')), 1, 0, 'C')
            pdf.cell(120, 6, f"By Cash (Self Withdrawn vide Slip/Chq No. {e.get('voucher_no', '-')})", 1, 0, 'L')
            pdf.cell(12, 6, "C", 1, 0, 'C')
            pdf.cell(35, 6, "-", 1, 0, 'R')
            pdf.cell(35, 6, f"{b_amt:.2f}", 1, 0, 'R')
            pdf.cell(38, 6, f"{b_amt:.2f}", 1, 1, 'R')
            rows_cr += 1

    # Closing line
    pdf.cell(22, 6, f"{ym}-30", 1, 0, 'C')
    pdf.cell(120, 6, "By Closing Balance c/d (Cash & Bank Balances)", 1, 0, 'L')
    pdf.cell(12, 6, "-", 1, 0, 'C')
    pdf.cell(35, 6, f"{cl_cash:.2f}", 1, 0, 'R')
    pdf.cell(35, 6, f"{cl_bank:.2f}", 1, 0, 'R')
    pdf.cell(38, 6, f"{(cl_cash + cl_bank):.2f}", 1, 1, 'R')
    rows_cr += 1

    while rows_cr < 14:
        pdf.cell(22, 6, "", 1, 0)
        pdf.cell(120, 6, "", 1, 0)
        pdf.cell(12, 6, "", 1, 0)
        pdf.cell(35, 6, "", 1, 0)
        pdf.cell(35, 6, "", 1, 0)
        pdf.cell(38, 6, "", 1, 1)
        rows_cr += 1

    # Total Balanced line
    pdf.set_font('Helvetica', 'B', 8)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(22, 7, "TOTAL", 1, 0, 'C', fill=True)
    pdf.cell(120, 7, "Grand Total Balanced", 1, 0, 'L', fill=True)
    pdf.cell(12, 7, "", 1, 0, 'C', fill=True)
    pdf.cell(35, 7, f"{(tot_cr_cash + cl_cash):.2f}", 1, 0, 'R', fill=True)
    pdf.cell(35, 7, f"{(tot_cr_bank + cl_bank):.2f}", 1, 0, 'R', fill=True)
    pdf.cell(38, 7, f"{(tot_cr_cash + cl_cash + tot_cr_bank + cl_bank):.2f}", 1, 1, 'R', fill=True)

    # Signatures
    pdf.ln(15)
    pdf.set_font('Helvetica', 'B', 9)
    pdf.cell(130, 6, "________________________________________", ln=0, align='C')
    pdf.cell(130, 6, "________________________________________", ln=1, align='C')
    pdf.cell(130, 6, "Signature of Cook-in-Charge / Teacher", ln=0, align='C')
    pdf.cell(130, 6, "Signature of Head Teacher / SMC Secretary", ln=1, align='C')

    pdf.output(output_path)


def generate_stock_register(ym, rec, output_path="Stock_Register.pdf"):
    """
    Renders PM POSHAN Monthly Stock & Cost Register.
    """
    pdf = FPDF(orientation='P', unit='mm', format='A4')
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    pdf.set_font('Helvetica', 'B', 14)
    pdf.cell(0, 8, "PM POSHAN - MONTHLY STOCK & COST REGISTER", ln=True, align='C')
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(0, 6, f"Month: {ym}", ln=True, align='C')
    pdf.ln(6)

    def row(title, val, is_header=False, is_bold=False):
        pdf.set_font('Helvetica', 'B' if (is_header or is_bold) else '', 9)
        if is_header:
            pdf.set_fill_color(220, 240, 220)
        elif is_bold:
            pdf.set_fill_color(245, 245, 245)
        else:
            pdf.set_fill_color(255, 255, 255)
        pdf.cell(120, 7, title, 1, 0, 'L', fill=True)
        pdf.cell(65, 7, val, 1, 1, 'R', fill=True)

    row("Component / Particulars", "Details / Values", is_header=True)
    row("School Working Days", str(rec.get('working_days', 0)))
    row("Lower Primary (LP) Meals Fed", str(rec.get('lp_meals', 0)))
    row("Upper Primary (UP) Meals Fed", str(rec.get('up_meals', 0)))
    row("Total Meals Served", str(rec.get('total_meals', 0)), is_bold=True)

    row("FOOD GRAINS (RICE in kg)", "", is_header=True)
    row("  Opening Balance", f"{rec.get('grain_opening', 0.0):.2f} kg")
    row("  Received during month", f"{rec.get('grain_received', 0.0):.2f} kg")
    row("  Consumption (@100g LP / 150g UP)", f"{rec.get('grain_consumed', 0.0):.2f} kg")
    row("  Closing Stock Balance", f"{rec.get('grain_closing', 0.0):.2f} kg", is_bold=True)

    row("COOKING COST (Rs.)", "", is_header=True)
    row("  Opening Balance / Past Deficit", f"Rs. {rec.get('cost_opening', 0.0):.2f}")
    row("  Cooking Cost Grant Received", f"Rs. {rec.get('cost_received', 0.0):.2f}")
    row("  Cooking Cost Entitlement Utilized", f"Rs. {rec.get('cost_expenditure', 0.0):.2f}")
    row("  Closing Status (Surplus / Deficit)", f"Rs. {rec.get('cost_closing', 0.0):.2f}", is_bold=True)

    pdf.ln(18)
    pdf.set_font('Helvetica', 'B', 9)
    pdf.cell(90, 6, "____________________________", ln=0, align='C')
    pdf.cell(90, 6, "____________________________", ln=1, align='C')
    pdf.cell(90, 6, "Prepared by Teacher-in-Charge", ln=0, align='C')
    pdf.cell(90, 6, "Verified by Head Teacher / SMC", ln=1, align='C')

    pdf.output(output_path)

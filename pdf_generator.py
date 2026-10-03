import os
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_cashbook_pdf(account_name, ym, data, output_path="CashBook.pdf"):
    """
    Renders the exact Assam 2-page Physical Cash Book Spread:
    Page 1: RECEIPTS (Dr.)
    Page 2: PAYMENTS (Cr.)
    """
    # Standard landscape A4 to mirror the physical cash register book
    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(A4),
        leftMargin=20,
        rightMargin=20,
        topMargin=25,
        bottomMargin=25
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=15,
        alignment=1, # Center
        spaceAfter=10,
        textColor=colors.HexColor('#1A237E')
    )
    cell_style = ParagraphStyle(
        'CellStyle',
        parent=styles['Normal'],
        fontSize=8,
        leading=10
    )
    cell_bold = ParagraphStyle(
        'CellBold',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        fontName='Helvetica-Bold'
    )

    story = []
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

    # ================= PAGE 1: RECEIPTS (Dr.) =================
    header_text = f"<b>{account_name.upper()} - CASH BOOK REGISTER (RECEIPTS / Dr.)</b><br/><font size=10>For the Month of: {ym}</font>"
    story.append(Paragraph(header_text, title_style))
    story.append(Spacer(1, 10))

    # Receipts Table Columns: Month & Date | PARTICULARS | Ledger Folio | Amount (Cash) | Bank Amount | Total Amount
    dr_data = [
        [
            Paragraph("<b>Month &<br/>Date</b>", cell_bold),
            Paragraph("<b>PARTICULARS</b>", cell_bold),
            Paragraph("<b>LF</b>", cell_bold),
            Paragraph("<b>Cash Amount<br/>(Rs.)</b>", cell_bold),
            Paragraph("<b>Bank Amount<br/>(Rs.)</b>", cell_bold),
            Paragraph("<b>Total Amount<br/>(Rs.)</b>", cell_bold)
        ]
    ]

    # Line 1: Opening Balance b/f
    dr_data.append([
        Paragraph(f"{ym}-01", cell_style),
        Paragraph("<b>To Opening Balance b/f:</b><br/>&nbsp;&nbsp;Cash in Hand & Bank Balances", cell_style),
        Paragraph("-", cell_style),
        Paragraph(f"{op_cash:.2f}", cell_style),
        Paragraph(f"{op_bank:.2f}", cell_style),
        Paragraph(f"{(op_cash + op_bank):.2f}", cell_style)
    ])

    # Receipt Entries
    for e in entries:
        e_type = e.get('entry_type')
        c_amt = float(e.get('cash_amount') or 0.0)
        b_amt = float(e.get('bank_amount') or 0.0)

        if e_type == 'RECEIPT':
            narration = f"To {e.get('particulars')}"
            dr_data.append([
                Paragraph(e.get('entry_date', ''), cell_style),
                Paragraph(narration, cell_style),
                Paragraph(e.get('voucher_no', '-'), cell_style),
                Paragraph(f"{c_amt:.2f}" if c_amt > 0 else "-", cell_style),
                Paragraph(f"{b_amt:.2f}" if b_amt > 0 else "-", cell_style),
                Paragraph(f"{(c_amt + b_amt):.2f}", cell_style)
            ])
        elif e_type == 'CONTRA':
            # Cash withdrawal from Bank
            narration = f"To Bank (Cash Withdrawn vide Slip/Chq No. {e.get('voucher_no', '-')})"
            dr_data.append([
                Paragraph(e.get('entry_date', ''), cell_style),
                Paragraph(narration, cell_style),
                Paragraph("C", cell_bold),
                Paragraph(f"{c_amt:.2f}", cell_style),
                Paragraph("-", cell_style),
                Paragraph(f"{c_amt:.2f}", cell_style)
            ])

    # Pad empty rows to maintain physical register look
    for _ in range(max(1, 10 - len(dr_data))):
        dr_data.append(["", "", "", "", "", ""])

    # Total Receipts Line
    dr_data.append([
        Paragraph("<b>TOTAL</b>", cell_bold),
        Paragraph("<b>Total Receipts Carried Over</b>", cell_bold),
        Paragraph("", cell_bold),
        Paragraph(f"<b>{tot_dr_cash:.2f}</b>", cell_bold),
        Paragraph(f"<b>{tot_dr_bank:.2f}</b>", cell_bold),
        Paragraph(f"<b>{(tot_dr_cash + tot_dr_bank):.2f}</b>", cell_bold)
    ])

    table_style_setting = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E8EAF6')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#9E9E9E')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#EEEEEE')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ])

    t_dr = Table(dr_data, colWidths=[70, 360, 40, 95, 95, 100])
    t_dr.setStyle(table_style_setting)
    story.append(t_dr)

    # Page Break to Right Page (Page 5)
    story.append(PageBreak())

    # ================= PAGE 2: PAYMENTS (Cr.) =================
    header_text_cr = f"<b>{account_name.upper()} - CASH BOOK REGISTER (PAYMENTS / Cr.)</b><br/><font size=10>For the Month of: {ym}</font>"
    story.append(Paragraph(header_text_cr, title_style))
    story.append(Spacer(1, 10))

    # Payments Table Columns: Month & Date | PARTICULARS | Ledger Folio | Amount (Cash) | Bank Amount | Total Amount
    cr_data = [
        [
            Paragraph("<b>Month &<br/>Date</b>", cell_bold),
            Paragraph("<b>PARTICULARS</b>", cell_bold),
            Paragraph("<b>Voucher<br/>/ LF</b>", cell_bold),
            Paragraph("<b>Cash Amount<br/>(Rs.)</b>", cell_bold),
            Paragraph("<b>Bank Amount<br/>(Rs.)</b>", cell_bold),
            Paragraph("<b>Total Amount<br/>(Rs.)</b>", cell_bold)
        ]
    ]

    # Payment Entries
    for e in entries:
        e_type = e.get('entry_type')
        c_amt = float(e.get('cash_amount') or 0.0)
        b_amt = float(e.get('bank_amount') or 0.0)

        if e_type == 'PAYMENT':
            narration = f"By {e.get('particulars')} (Voucher No. {e.get('voucher_no', '-')})"
            cr_data.append([
                Paragraph(e.get('entry_date', ''), cell_style),
                Paragraph(narration, cell_style),
                Paragraph(e.get('voucher_no', '-'), cell_style),
                Paragraph(f"{c_amt:.2f}" if c_amt > 0 else "-", cell_style),
                Paragraph(f"{b_amt:.2f}" if b_amt > 0 else "-", cell_style),
                Paragraph(f"{(c_amt + b_amt):.2f}", cell_style)
            ])
        elif e_type == 'CONTRA':
            # Contra on credit side: Deducts from bank
            narration = f"By Cash (Self Withdrawn vide Slip/Chq No. {e.get('voucher_no', '-')})"
            cr_data.append([
                Paragraph(e.get('entry_date', ''), cell_style),
                Paragraph(narration, cell_style),
                Paragraph("C", cell_bold),
                Paragraph("-", cell_style),
                Paragraph(f"{b_amt:.2f}", cell_style),
                Paragraph(f"{b_amt:.2f}", cell_style)
            ])

    # Month-end closing line
    cr_data.append([
        Paragraph(f"{ym}-30", cell_style),
        Paragraph("<b>By Closing Balance c/d:</b><br/>&nbsp;&nbsp;Cash in Hand & Bank Balances", cell_style),
        Paragraph("-", cell_style),
        Paragraph(f"{cl_cash:.2f}", cell_style),
        Paragraph(f"{cl_bank:.2f}", cell_style),
        Paragraph(f"{(cl_cash + cl_bank):.2f}", cell_style)
    ])

    # Pad empty rows to maintain format
    for _ in range(max(1, 10 - len(cr_data))):
        cr_data.append(["", "", "", "", "", ""])

    # Total Payments Balancing Line
    cr_data.append([
        Paragraph("<b>TOTAL</b>", cell_bold),
        Paragraph("<b>Grand Total Balanced</b>", cell_bold),
        Paragraph("", cell_bold),
        Paragraph(f"<b>{(tot_cr_cash + cl_cash):.2f}</b>", cell_bold),
        Paragraph(f"<b>{(tot_cr_bank + cl_bank):.2f}</b>", cell_bold),
        Paragraph(f"<b>{(tot_cr_cash + cl_cash + tot_cr_bank + cl_bank):.2f}</b>", cell_bold)
    ])

    t_cr = Table(cr_data, colWidths=[70, 360, 40, 95, 95, 100])
    t_cr.setStyle(table_style_setting)
    story.append(t_cr)

    # Sign-off Blocks at Bottom
    story.append(Spacer(1, 20))
    sig_data = [
        [
            Paragraph("<br/><br/>_____________________________________<br/><b>Signature of Cook-in-Charge / Teacher</b>", cell_style),
            Paragraph("<br/><br/>_____________________________________<br/><b>Signature of Head Teacher / SMC Secretary</b>", cell_style)
        ]
    ]
    sig_table = Table(sig_data, colWidths=[380, 380])
    sig_table.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER')]))
    story.append(sig_table)

    doc.build(story)


def generate_stock_register(ym, rec, output_path="Stock_Register.pdf"):
    """
    Renders the MDM Monthly Food Grains and Cooking Cost Entitlement Register.
    """
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=30,
        rightMargin=30,
        topMargin=30,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=15,
        alignment=1,
        textColor=colors.HexColor('#1B5E20'),
        spaceAfter=15
    )
    cell_style = ParagraphStyle('CellStyle', parent=styles['Normal'], fontSize=9, leading=12)
    cell_bold = ParagraphStyle('CellBold', parent=styles['Normal'], fontSize=9, leading=12, fontName='Helvetica-Bold')

    story = []
    story.append(Paragraph(f"<b>PM POSHAN - MONTHLY STOCK & COST REGISTER</b><br/><font size=11>Month: {ym}</font>", title_style))
    story.append(Spacer(1, 10))

    # Summary table
    table_data = [
        [Paragraph("<b>Component / Particulars</b>", cell_bold), Paragraph("<b>Details / Values</b>", cell_bold)],
        [Paragraph("School Working Days", cell_style), Paragraph(str(rec.get('working_days', 0)), cell_style)],
        [Paragraph("Lower Primary (LP) Meals Fed", cell_style), Paragraph(str(rec.get('lp_meals', 0)), cell_style)],
        [Paragraph("Upper Primary (UP) Meals Fed", cell_style), Paragraph(str(rec.get('up_meals', 0)), cell_style)],
        [Paragraph("Total Meals Served", cell_bold), Paragraph(str(rec.get('total_meals', 0)), cell_bold)],
        [Paragraph("<b>FOOD GRAINS (RICE in kg)</b>", cell_bold), Paragraph("", cell_style)],
        [Paragraph("&nbsp;&nbsp;Opening Balance", cell_style), Paragraph(f"{rec.get('grain_opening', 0.0):.2f} kg", cell_style)],
        [Paragraph("&nbsp;&nbsp;Received during month", cell_style), Paragraph(f"{rec.get('grain_received', 0.0):.2f} kg", cell_style)],
        [Paragraph("&nbsp;&nbsp;Consumption (@100g LP / 150g UP)", cell_style), Paragraph(f"{rec.get('grain_consumed', 0.0):.2f} kg", cell_style)],
        [Paragraph("&nbsp;&nbsp;<b>Closing Stock Balance</b>", cell_bold), Paragraph(f"<b>{rec.get('grain_closing', 0.0):.2f} kg</b>", cell_bold)],
        [Paragraph("<b>COOKING COST (Rs.)</b>", cell_bold), Paragraph("", cell_style)],
        [Paragraph("&nbsp;&nbsp;Opening Balance / Past Deficit", cell_style), Paragraph(f"Rs. {rec.get('cost_opening', 0.0):.2f}", cell_style)],
        [Paragraph("&nbsp;&nbsp;Cooking Cost Grant Received", cell_style), Paragraph(f"Rs. {rec.get('cost_received', 0.0):.2f}", cell_style)],
        [Paragraph("&nbsp;&nbsp;Cooking Cost Entitlement Utilized", cell_style), Paragraph(f"Rs. {rec.get('cost_expenditure', 0.0):.2f}", cell_style)],
        [Paragraph("&nbsp;&nbsp;<b>Closing Status (Surplus / Deficit)</b>", cell_bold), Paragraph(f"<b>Rs. {rec.get('cost_closing', 0.0):.2f}</b>", cell_bold)]
    ]

    t = Table(table_data, colWidths=[320, 210])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#C8E6C9')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#81C784')),
        ('BACKGROUND', (0, 5), (-1, 5), colors.HexColor('#E8F5E9')),
        ('BACKGROUND', (0, 10), (-1, 10), colors.HexColor('#E8F5E9')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t)

    # Signatures
    story.append(Spacer(1, 30))
    sig_data = [
        [
            Paragraph("____________________________<br/><b>Prepared by Teacher-in-Charge</b>", cell_style),
            Paragraph("____________________________<br/><b>Verified by Head Teacher / SMC</b>", cell_style)
        ]
    ]
    sig_table = Table(sig_data, colWidths=[270, 270])
    sig_table.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER')]))
    story.append(sig_table)

    doc.build(story)

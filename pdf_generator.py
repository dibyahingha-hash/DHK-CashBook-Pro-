import os
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors


def build_cashbook_pdf(account_name, year_month, audit_data, output_filepath):
    """
    Renders a landscape, two-sided balanced cash book.
    Left: Receipts (Dr.) | Right: Payments (Cr.)
    """
    doc = SimpleDocTemplate(
        output_filepath,
        pagesize=landscape(letter),
        leftMargin=24,
        rightMargin=24,
        topMargin=24,
        bottomMargin=24
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=16,
        alignment=1, # Center
        textColor=colors.HexColor("#1A2530")
    )
    sub_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=11,
        alignment=1,
        textColor=colors.HexColor("#4A5568")
    )
    cell_style = ParagraphStyle(
        'CellText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9
    )
    cell_bold = ParagraphStyle(
        'CellBold',
        parent=cell_style,
        fontName='Helvetica-Bold'
    )

    elements = []

    # 1. Header Banner
    elements.append(Paragraph(f"CASH BOOK REGISTER — {account_name.replace('_', ' ')}", title_style))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(f"Accounting Period: {year_month} | Verified Double-Spread Ledger", sub_style))
    elements.append(Spacer(1, 12))

    # 2. Table Headers (Dual Columns)
    headers = [
        Paragraph("<b>Date</b>", cell_bold),
        Paragraph("<b>Receipts Particulars (Dr.)</b>", cell_bold),
        Paragraph("<b>Ref</b>", cell_bold),
        Paragraph("<b>Cash (₹)</b>", cell_bold),
        Paragraph("<b>Bank (₹)</b>", cell_bold),
        Paragraph("<b>Date</b>", cell_bold),
        Paragraph("<b>Payments Particulars (Cr.)</b>", cell_bold),
        Paragraph("<b>V.No</b>", cell_bold),
        Paragraph("<b>Cash (₹)</b>", cell_bold),
        Paragraph("<b>Bank (₹)</b>", cell_bold)
    ]

    dr_rows = audit_data['dr_rows']
    cr_rows = audit_data['cr_rows']
    max_len = max(len(dr_rows), len(cr_rows))

    table_data = [headers]

    for i in range(max_len):
        row = []
        # Left Side: Dr.
        if i < len(dr_rows):
            d = dr_rows[i]
            row.extend([
                Paragraph(d['date'], cell_style),
                Paragraph(d['particulars'], cell_style),
                Paragraph(str(d['ref']), cell_style),
                Paragraph(f"{d['cash']:.2f}" if d['cash'] > 0 else "-", cell_style),
                Paragraph(f"{d['bank']:.2f}" if d['bank'] > 0 else "-", cell_style)
            ])
        else:
            row.extend(["", "", "", "", ""])

        # Right Side: Cr.
        if i < len(cr_rows):
            c = cr_rows[i]
            row.extend([
                Paragraph(c['date'], cell_style),
                Paragraph(c['particulars'], cell_style),
                Paragraph(str(c['ref']), cell_style),
                Paragraph(f"{c['cash']:.2f}" if c['cash'] > 0 else "-", cell_style),
                Paragraph(f"{c['bank']:.2f}" if c['bank'] > 0 else "-", cell_style)
            ])
        else:
            row.extend(["", "", "", "", ""])

        table_data.append(row)

    # 3. Totals Balancing Row
    total_row = [
        Paragraph("<b>TOTAL</b>", cell_bold),
        "", "",
        Paragraph(f"<b>{audit_data['total_dr_cash']:.2f}</b>", cell_bold),
        Paragraph(f"<b>{audit_data['total_dr_bank']:.2f}</b>", cell_bold),
        Paragraph("<b>TOTAL</b>", cell_bold),
        "", "",
        Paragraph(f"<b>{audit_data['total_cr_cash']:.2f}</b>", cell_bold),
        Paragraph(f"<b>{audit_data['total_cr_bank']:.2f}</b>", cell_bold)
    ]
    table_data.append(total_row)

    # Table Column Widths (Sum = 744 pt to fit landscape page comfortably)
    col_widths = [50, 160, 42, 60, 60, 50, 160, 42, 60, 60]

    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#A0AEC0")),
        ('LINEBELOW', (0, 0), (-1, 0), 1.2, colors.HexColor("#4A5568")),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#EDF2F7")),
        ('LINEABOVE', (0, -1), (-1, -1), 1.2, colors.HexColor("#4A5568")),
        ('SPAN', (0, -1), (2, -1)),
        ('SPAN', (5, -1), (7, -1)),
    ]))

    elements.append(t)
    doc.build(elements)
    return output_filepath


def build_stock_register_pdf(year_month, stock_row, output_filepath):
    """
    Renders the MDM Monthly Stock & Feeding Register.
    """
    doc = SimpleDocTemplate(
        output_filepath,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'StockTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        alignment=1,
        textColor=colors.HexColor("#1A2530")
    )
    sub_style = ParagraphStyle('StockSub', parent=styles['Normal'], alignment=1, fontSize=9, textColor=colors.HexColor("#4A5568"))
    cell_bold = ParagraphStyle('BoldCell', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8.5)
    cell_norm = ParagraphStyle('NormCell', parent=styles['Normal'], fontName='Helvetica', fontSize=8.5)

    elements = []
    elements.append(Paragraph("PM POSHAN / MDM MONTHLY STOCK & COST REGISTER", title_style))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(f"Reporting Month: {year_month}", sub_style))
    elements.append(Spacer(1, 14))

    table_data = [
        [Paragraph("<b>Particulars</b>", cell_bold), Paragraph("<b>Details / Figures</b>", cell_bold)],
        [Paragraph("Total Serving / Working Days", cell_norm), Paragraph(str(stock_row['working_days']), cell_norm)],
        [Paragraph("LP Students Fed (Box 1)", cell_norm), Paragraph(str(stock_row['lp_meals']), cell_norm)],
        [Paragraph("UP Students Fed (Box 2)", cell_norm), Paragraph(str(stock_row['up_meals']), cell_norm)],
        [Paragraph("Total Meals Served (Combined Box 3)", cell_bold), Paragraph(str(stock_row['total_meals']), cell_bold)],
        [Paragraph("Active Cooking Cost Rates", cell_norm), Paragraph(f"LP: ₹{stock_row['lp_rate']} | UP: ₹{stock_row['up_rate']}", cell_norm)],
        [Paragraph("Opening Rice Balance", cell_norm), Paragraph(f"{stock_row['rice_opening_kg']:.3f} kg", cell_norm)],
        [Paragraph("Rice Received via Challan", cell_norm), Paragraph(f"{stock_row['rice_received_kg']:.3f} kg", cell_norm)],
        [Paragraph("Rice Consumed During Month", cell_norm), Paragraph(f"{stock_row['rice_consumed_kg']:.3f} kg", cell_norm)],
        [Paragraph("Closing Rice Stock Balance", cell_bold), Paragraph(f"{stock_row['rice_closing_kg']:.3f} kg", cell_bold)],
        [Paragraph("Total Cooking Fund Incurred", cell_norm), Paragraph(f"₹{stock_row['fund_spent']:.2f}", cell_norm)],
        [Paragraph("Cooking Grants Received", cell_norm), Paragraph(f"₹{stock_row['fund_received']:.2f}", cell_norm)],
        [
            Paragraph("<b>Closing Fund Position</b>", cell_bold),
            Paragraph(
                f"<b>Payable to Head Teacher: -₹{abs(stock_row['fund_closing']):.2f}</b>" if stock_row['fund_closing'] < 0
                else f"₹{stock_row['fund_closing']:.2f}", cell_bold
            )
        ]
    ]

    t = Table(table_data, colWidths=[280, 260])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E0")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FAFC")]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
    ]))

    elements.append(t)
    doc.build(elements)
    return output_filepath


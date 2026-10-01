import os
from reportlab.lib.pagesizes import letter, landscape, portrait
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_cashbook_pdf(account_name, year_month, data, output_path="cashbook_export.pdf"):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(letter),
        leftMargin=24,
        rightMargin=24,
        topMargin=28,
        bottomMargin=28
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=15,
        leading=18,
        alignment=1,
        textColor=colors.HexColor('#1A237E')
    )
    subtitle_style = ParagraphStyle(
        'SubtitleStyle',
        parent=styles['Normal'],
        fontSize=10,
        leading=13,
        alignment=1,
        textColor=colors.HexColor('#37474F')
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

    elements = []
    elements.append(Paragraph("<b>ELEMENTARY SCHOOL CASH BOOK REGISTER</b>", title_style))
    elements.append(Paragraph(f"Account: <b>{account_name}</b> &nbsp;|&nbsp; Month: <b>{year_month}</b>", subtitle_style))
    elements.append(Spacer(1, 10))

    table_data = [
        [
            Paragraph("<b>RECEIPTS (DEBIT / Dr.)</b>", cell_bold), "", "", "",
            Paragraph("<b>PAYMENTS (CREDIT / Cr.)</b>", cell_bold), "", "", ""
        ],
        [
            Paragraph("<b>Date</b>", cell_bold),
            Paragraph("<b>Particulars</b>", cell_bold),
            Paragraph("<b>Cash (Rs.)</b>", cell_bold),
            Paragraph("<b>Bank (Rs.)</b>", cell_bold),
            Paragraph("<b>Date</b>", cell_bold),
            Paragraph("<b>Particulars & Voucher Ref</b>", cell_bold),
            Paragraph("<b>Cash (Rs.)</b>", cell_bold),
            Paragraph("<b>Bank (Rs.)</b>", cell_bold)
        ]
    ]

    dr_rows = data.get("dr_rows", [])
    cr_rows = data.get("cr_rows", [])
    max_len = max(len(dr_rows), len(cr_rows), 1)

    for i in range(max_len):
        row = []
        if i < len(dr_rows):
            d = dr_rows[i]
            row.extend([
                Paragraph(str(d.get("date", "")), cell_style),
                Paragraph(str(d.get("particulars", "")), cell_style),
                Paragraph(f"{d.get('cash', 0.0):.2f}" if d.get('cash', 0.0) > 0 else "-", cell_style),
                Paragraph(f"{d.get('bank', 0.0):.2f}" if d.get('bank', 0.0) > 0 else "-", cell_style)
            ])
        else:
            row.extend(["", "", "", ""])

        if i < len(cr_rows):
            c = cr_rows[i]
            ref_txt = f" [{c.get('ref')}]" if c.get('ref') and c.get('ref') != '-' else ""
            row.extend([
                Paragraph(str(c.get("date", "")), cell_style),
                Paragraph(f"{c.get('particulars', '')}{ref_txt}", cell_style),
                Paragraph(f"{c.get('cash', 0.0):.2f}" if c.get('cash', 0.0) > 0 else "-", cell_style),
                Paragraph(f"{c.get('bank', 0.0):.2f}" if c.get('bank', 0.0) > 0 else "-", cell_style)
            ])
        else:
            row.extend(["", "", "", ""])

        table_data.append(row)

    table_data.append([
        Paragraph("<b>TOTAL Dr.</b>", cell_bold), "",
        Paragraph(f"<b>Rs. {data.get('total_dr_cash', 0.0):.2f}</b>", cell_bold),
        Paragraph(f"<b>Rs. {data.get('total_dr_bank', 0.0):.2f}</b>", cell_bold),
        Paragraph("<b>TOTAL Cr.</b>", cell_bold), "",
        Paragraph(f"<b>Rs. {data.get('total_cr_cash', 0.0):.2f}</b>", cell_bold),
        Paragraph(f"<b>Rs. {data.get('total_cr_bank', 0.0):.2f}</b>", cell_bold)
    ])

    col_widths = [72, 175, 62, 65, 72, 175, 62, 65]
    t = Table(table_data, colWidths=col_widths, repeatRows=2)
    t.setStyle(TableStyle([
        ('SPAN', (0, 0), (3, 0)),
        ('SPAN', (4, 0), (7, 0)),
        ('BACKGROUND', (0, 0), (3, 0), colors.HexColor('#E8EAF6')),
        ('BACKGROUND', (4, 0), (7, 0), colors.HexColor('#FFEBEE')),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#CFD8DC')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#90A4AE')),
        ('LINEBEFORE', (4, 0), (4, -1), 1.5, colors.HexColor('#263238')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#ECEFF1')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))

    elements.append(t)
    elements.append(Spacer(1, 14))

    net_c = data.get("net_cash", 0.0)
    net_b = data.get("net_bank", 0.0)
    cash_note = f"Cash in Hand: Rs. {net_c:.2f}" if net_c >= 0 else f"Payable / Due to Head Teacher: -Rs. {abs(net_c):.2f}"
    status_text = f"<b>Reconciliation Summary:</b> {cash_note} &nbsp;|&nbsp; Closing Bank Balance: Rs. {net_b:.2f}"
    elements.append(Paragraph(status_text, subtitle_style))

    doc.build(elements)
    return output_path


def generate_stock_register_pdf(year_month, stock_data, output_path="stock_register_export.pdf"):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=portrait(letter),
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'StockTitle',
        parent=styles['Heading1'],
        fontSize=15,
        leading=18,
        alignment=1,
        textColor=colors.HexColor('#004D40')
    )
    subtitle_style = ParagraphStyle(
        'StockSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=13,
        alignment=1,
        textColor=colors.HexColor('#37474F')
    )
    cell_style = ParagraphStyle('StockCell', parent=styles['Normal'], fontSize=9, leading=12)
    cell_bold = ParagraphStyle('StockCellBold', parent=styles['Normal'], fontSize=9, leading=12, fontName='Helvetica-Bold')

    elements = []
    elements.append(Paragraph("<b>PM POSHAN (MDM) MONTHLY STOCK & COST REGISTER</b>", title_style))
    elements.append(Paragraph(f"Reporting Month: <b>{year_month}</b> &nbsp;|&nbsp; Working Days: <b>{stock_data.get('working_days', 0)}</b>", subtitle_style))
    elements.append(Spacer(1, 14))

    table_data = [
        [Paragraph("<b>Component / Head</b>", cell_bold), Paragraph("<b>Particulars / Values</b>", cell_bold)],
        [Paragraph("LP Meals Served (Box 1 @ 100g)", cell_style), Paragraph(str(stock_data.get('lp_meals', 0)), cell_style)],
        [Paragraph("UP Meals Served (Box 2 @ 150g)", cell_style), Paragraph(str(stock_data.get('up_meals', 0)), cell_style)],
        [Paragraph("<b>Total Meals Served (Combined Box 3)</b>", cell_bold), Paragraph(f"<b>{stock_data.get('total_meals', 0)}</b>", cell_bold)],
        [Paragraph("Applied Cooking Cost Rate (LP)", cell_style), Paragraph(f"Rs. {stock_data.get('lp_rate', 6.78):.2f} / child", cell_style)],
        [Paragraph("Applied Cooking Cost Rate (UP)", cell_style), Paragraph(f"Rs. {stock_data.get('up_rate', 10.15):.2f} / child", cell_style)],
        [Paragraph("Opening Foodgrain Stock", cell_style), Paragraph(f"{stock_data.get('rice_opening_kg', 0.0):.3f} kg", cell_style)],
        [Paragraph("Foodgrain Received on Challan", cell_style), Paragraph(f"{stock_data.get('rice_received_kg', 0.0):.3f} kg", cell_style)],
        [Paragraph("Foodgrain Consumed During Month", cell_style), Paragraph(f"{stock_data.get('rice_consumed_kg', 0.0):.3f} kg", cell_style)],
        [Paragraph("<b>Closing Foodgrain Stock in Hand</b>", cell_bold), Paragraph(f"<b>{stock_data.get('rice_closing_kg', 0.0):.3f} kg</b>", cell_bold)],
        [Paragraph("Cooking Cost Grant Received", cell_style), Paragraph(f"Rs. {stock_data.get('fund_received', 0.0):.2f}", cell_style)],
        [Paragraph("Total Cooking Expenditure Incurred", cell_style), Paragraph(f"Rs. {stock_data.get('fund_spent', 0.0):.2f}", cell_style)],
        [
            Paragraph("<b>Cooking Fund Net Balance</b>", cell_bold),
            Paragraph(
                f"<b>Rs. {stock_data.get('fund_closing', 0.0):.2f}</b>" if stock_data.get('fund_closing', 0.0) >= 0 
                else f"<font color='#B71C1C'><b>Payable to Head Teacher: -Rs. {abs(stock_data.get('fund_closing', 0.0)):.2f}</b></font>",
                cell_bold
            )
        ]
    ]

    t = Table(table_data, colWidths=[270, 270])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E0F2F1')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#B2DFDB')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))

    elements.append(t)
    doc.build(elements)
    return output_path

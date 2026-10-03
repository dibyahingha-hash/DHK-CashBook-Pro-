import os
from kivy.utils import platform

from reportlab.lib.pagesizes import letter, landscape, portrait
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def get_public_export_dir():
    """
    Returns the public Downloads folder on Android so files appear 
    directly in the phone's standard File Manager and Downloads list.
    """
    if platform == "android":
        public_download = "/storage/emulated/0/Download"
        if os.path.exists(public_download):
            return public_download
        
        public_docs = "/storage/emulated/0/Documents"
        if os.path.exists(public_docs):
            return public_docs

        try:
            from jnius import autoclass
            Environment = autoclass('android.os.Environment')
            return Environment.getExternalStoragePublicDirectory(
                Environment.DIRECTORY_DOWNLOADS
            ).getAbsolutePath()
        except Exception:
            pass

    return os.path.abspath(".")


def open_pdf_externally(filepath):
    """
    Triggers an Android Intent to automatically open the generated 
    PDF in the user's default viewer (Drive PDF, Adobe, etc.).
    """
    if platform == "android":
        try:
            from jnius import autoclass
            PythonActivity = autoclass('org.kivy.android.PythonActivity')
            Intent = autoclass('android.content.Intent')
            File = autoclass('java.io.File')
            Uri = autoclass('android.net.Uri')

            activity = PythonActivity.mActivity
            file_obj = File(filepath)

            intent = Intent(Intent.ACTION_VIEW)

            try:
                FileProvider = autoclass('androidx.core.content.FileProvider')
                uri = FileProvider.getUriForFile(
                    activity,
                    activity.getPackageName() + ".fileprovider",
                    file_obj
                )
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            except Exception:
                uri = Uri.fromFile(file_obj)

            intent.setDataAndType(uri, "application/pdf")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(intent)
        except Exception as e:
            print(f"Could not open PDF via Android Intent: {e}")


def generate_cashbook_pdf(account_name, year_month, data, output_path="cashbook_export.pdf"):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(letter),
        leftMargin=24,
        rightMargin=24,
        topMargin=24,
        bottomMargin=24
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=14,
        leading=16,
        alignment=1,
        textColor=colors.HexColor('#0F172A')
    )
    subtitle_style = ParagraphStyle(
        'SubtitleStyle',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        alignment=1,
        textColor=colors.HexColor('#334155')
    )
    cell_style = ParagraphStyle('CellStyle', parent=styles['Normal'], fontSize=8, leading=10)
    cell_bold = ParagraphStyle('CellBold', parent=styles['Normal'], fontSize=8, leading=10, fontName='Helvetica-Bold')

    elements = []
    elements.append(Paragraph("<b>ELEMENTARY SCHOOL AUDIT CASH BOOK REGISTER</b>", title_style))
    elements.append(Paragraph(f"Account: <b>{account_name}</b> &nbsp;|&nbsp; Month: <b>{year_month}</b>", subtitle_style))
    elements.append(Spacer(1, 8))

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
            Paragraph("<b>Particulars (V. No.)</b>", cell_bold),
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
            ref_txt = f" (V-{c.get('ref')})" if c.get('ref') and c.get('ref') != '-' else ""
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
        Paragraph("<b>T/P Dr. Total</b>", cell_bold), "",
        Paragraph(f"<b>Rs. {data.get('total_dr_cash', 0.0):.2f}</b>", cell_bold),
        Paragraph(f"<b>Rs. {data.get('total_dr_bank', 0.0):.2f}</b>", cell_bold),
        Paragraph("<b>T/P Cr. Total</b>", cell_bold), "",
        Paragraph(f"<b>Rs. {data.get('total_cr_cash', 0.0):.2f}</b>", cell_bold),
        Paragraph(f"<b>Rs. {data.get('total_cr_bank', 0.0):.2f}</b>", cell_bold)
    ])

    col_widths = [65, 180, 60, 65, 65, 180, 60, 65]
    t = Table(table_data, colWidths=col_widths, repeatRows=2)
    t.setStyle(TableStyle([
        ('SPAN', (0, 0), (3, 0)),
        ('SPAN', (4, 0), (7, 0)),
        ('BACKGROUND', (0, 0), (3, 0), colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (4, 0), (7, 0), colors.HexColor('#FEE2E2')),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#CBD5E1')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#94A3B8')),
        ('LINEBEFORE', (4, 0), (4, -1), 1.5, colors.HexColor('#334155')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#F1F5F9')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))

    elements.append(t)
    elements.append(Spacer(1, 10))

    net_c = data.get("net_cash", 0.0)
    net_b = data.get("net_bank", 0.0)
    cash_note = f"By C/B (Cash in Hand): Rs. {net_c:.2f}" if net_c >= 0 else f"To C/B (Deficit / Due to In-Charge): -Rs. {abs(net_c):.2f}"
    status_text = f"<b>Balance Summary:</b> {cash_note} &nbsp;|&nbsp; By C/B (Bank Account): Rs. {net_b:.2f}"
    elements.append(Paragraph(status_text, subtitle_style))
    elements.append(Spacer(1, 20))

    sig_data = [
        [
            Paragraph("Prepared By:<br/><br/>_______________________<br/>Cook-in-Charge / Asst. Teacher", cell_style),
            Paragraph("Verified & Passed By:<br/><br/>_______________________<br/>Head Teacher / Secretary, SMC", cell_style)
        ]
    ]
    sig_table = Table(sig_data, colWidths=[370, 370])
    elements.append(sig_table)

    doc.build(elements)
    open_pdf_externally(output_path)
    return output_path


def generate_stock_register(year_month, stock_data, output_path="stock_register_export.pdf"):
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
        fontSize=14,
        leading=16,
        alignment=1,
        textColor=colors.HexColor('#0F172A')
    )
    subtitle_style = ParagraphStyle(
        'StockSubtitle',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        alignment=1,
        textColor=colors.HexColor('#334155')
    )
    cell_style = ParagraphStyle('StockCell', parent=styles['Normal'], fontSize=8.5, leading=11)
    cell_bold = ParagraphStyle('StockCellBold', parent=styles['Normal'], fontSize=8.5, leading=11, fontName='Helvetica-Bold')

    elements = []
    elements.append(Paragraph("<b>PM POSHAN (MDM) MONTHLY REGISTER</b>", title_style))
    elements.append(Paragraph("<b>FOOD GRAINS CONSUMPTION & COOKING COST ACCOUNT</b>", subtitle_style))
    elements.append(Paragraph(f"Reporting Month: <b>{year_month}</b> &nbsp;|&nbsp; Working Days: <b>{stock_data.get('working_days', 0)}</b>", subtitle_style))
    elements.append(Spacer(1, 12))

    cost_cl = stock_data.get('cost_cl', 0.0)
    cost_status = f"Rs. {cost_cl:.2f} (Surplus in Hand/Bank)" if cost_cl >= 0 else f"<font color='#B91C1C'><b>-Rs. {abs(cost_cl):.2f} (Deficit / Due to In-Charge)</b></font>"

    table_data = [
        [Paragraph("<b>Component / Head</b>", cell_bold), Paragraph("<b>Particulars / Audit Quantity</b>", cell_bold)],
        [Paragraph("LP Meals Served (Classes 1–5 @ 100g)", cell_style), Paragraph(str(stock_data.get('lp_meals', 0)), cell_style)],
        [Paragraph("UP Meals Served (Classes 6–8 @ 150g)", cell_style), Paragraph(str(stock_data.get('up_meals', 0)), cell_style)],
        [Paragraph("<b>Total Meals Served in Month</b>", cell_bold), Paragraph(f"<b>{stock_data.get('total_meals', 0)}</b>", cell_bold)],
        [Paragraph("PM POSHAN Rate (LP / Lower Primary)", cell_style), Paragraph(f"Rs. {stock_data.get('lp_rate', 6.78):.2f} per meal", cell_style)],
        [Paragraph("PM POSHAN Rate (UP / Upper Primary)", cell_style), Paragraph(f"Rs. {stock_data.get('up_rate', 10.15):.2f} per meal", cell_style)],
        [Paragraph("To O/B - Food Grains (Opening Balance)", cell_style), Paragraph(f"{stock_data.get('grain_op', 0.0):.3f} kg", cell_style)],
        [Paragraph("To MDM - Food Grains Received on Challan", cell_style), Paragraph(f"{stock_data.get('grain_rec', 0.0):.3f} kg", cell_style)],
        [Paragraph("By MDM - Food Grains Consumed (Auto Entitlement)", cell_style), Paragraph(f"{stock_data.get('grain_cons', 0.0):.3f} kg", cell_style)],
        [Paragraph("<b>By C/B - Food Grains Balance in Hand</b>", cell_bold), Paragraph(f"<b>{stock_data.get('grain_cl', 0.0):.3f} kg</b>", cell_bold)],
        [Paragraph("To O/B - Cooking Cost (Opening Balance / Past Deficit)", cell_style), Paragraph(f"Rs. {stock_data.get('cost_op', 0.0):.2f}", cell_style)],
        [Paragraph("To MDM - Cooking Cost Grant Received via SNA/Bank", cell_style), Paragraph(f"Rs. {stock_data.get('cost_rec', 0.0):.2f}", cell_style)],
        [Paragraph("By MDM - Cooking Cost Entitlement Expenditure", cell_style), Paragraph(f"Rs. {stock_data.get('cost_exp', 0.0):.2f}", cell_style)],
        [Paragraph("<b>By C/B - Cooking Cost Net Balance Status</b>", cell_bold), Paragraph(cost_status, cell_bold)]
    ]

    t = Table(table_data, colWidths=[270, 270])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F5F9')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))

    elements.append(t)
    elements.append(Spacer(1, 24))

    sig_data = [
        [
            Paragraph("Prepared By:<br/><br/>_______________________<br/>Cook-in-Charge / Asst. Teacher", cell_style),
            Paragraph("Verified & Passed By:<br/><br/>_______________________<br/>Head Teacher / Secretary, SMC", cell_style)
        ]
    ]
    sig_table = Table(sig_data, colWidths=[270, 270])
    elements.append(sig_table)

    doc.build(elements)
    open_pdf_externally(output_path)
    return output_path

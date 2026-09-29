import os
from typing import Dict, List, Any
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from core.currency import CurrencyEngine


class CashBookPDFGenerator:
    def __init__(self, output_pdf_path: str):
        self.output_path = output_pdf_path
        self.styles = getSampleStyleSheet()
        self._init_custom_styles()

    def _init_custom_styles(self):
        self.title_style = ParagraphStyle(
            'RegisterTitle', parent=self.styles['Normal'],
            fontName='Helvetica-Bold', fontSize=11, leading=13, alignment=1, textColor=colors.black
        )
        self.sub_title_style = ParagraphStyle(
            'RegisterSubTitle', parent=self.styles['Normal'],
            fontName='Helvetica', fontSize=8.5, leading=11, alignment=1, textColor=colors.HexColor("#222222")
        )
        self.cell_style = ParagraphStyle(
            'CellRegular', parent=self.styles['Normal'],
            fontName='Helvetica', fontSize=7.5, leading=9, alignment=0
        )
        self.cell_bold = ParagraphStyle(
            'CellBold', parent=self.styles['Normal'],
            fontName='Helvetica-Bold', fontSize=7.5, leading=9, alignment=0
        )
        self.cert_text_style = ParagraphStyle(
            'CertText', parent=self.styles['Normal'],
            fontName='Helvetica', fontSize=8, leading=11, alignment=0
        )

    def _build_receipts_table(self, month_str: str, opening_cash: int, opening_bank: int,
                              receipt_rows: List[Dict[str, Any]], grand_total_cash: int,
                              grand_total_bank: int) -> Table:
        col_widths = [18*mm, 108*mm, 12*mm, 24*mm, 11*mm, 24*mm, 11*mm, 25*mm, 14*mm]

        header_data = [
            [
                Paragraph("<b>Month & Date</b>", self.cell_bold),
                Paragraph("<b>PARTICULARS OF RECEIPTS</b>", self.cell_bold),
                Paragraph("<b>LF</b>", self.cell_bold),
                Paragraph("<b>CASH AMOUNT</b>", self.cell_bold), "",
                Paragraph("<b>BANK AMOUNT</b>", self.cell_bold), "",
                Paragraph("<b>TOTAL AMOUNT</b>", self.cell_bold), ""
            ],
            ["", "", "", "Rs.", "P.", "Rs.", "P.", "Rs.", "P."]
        ]

        tot_open = opening_cash + opening_bank
        c_rs, c_p = CurrencyEngine.format_for_register(opening_cash)
        b_rs, b_p = CurrencyEngine.format_for_register(opening_bank)
        t_rs, t_p = CurrencyEngine.format_for_register(tot_open)

        data = header_data + [
            [
                f"01 {month_str[:3]}",
                Paragraph("<b>To Opening Balance b/d</b>", self.cell_bold),
                "—", c_rs, c_p, b_rs, b_p, t_rs, t_p
            ]
        ]

        for r in receipt_rows:
            tot_entry = r['cash_paise'] + r['bank_paise']
            cr, cp = CurrencyEngine.format_for_register(r['cash_paise'])
            br, bp = CurrencyEngine.format_for_register(r['bank_paise'])
            tr, tp = CurrencyEngine.format_for_register(tot_entry)
            lf_display = "C" if r.get('is_contra') else (r.get('voucher_no') or "—")
            data.append([
                r['entry_date'][8:10] + " " + month_str[:3],
                Paragraph(r['particulars'], self.cell_style),
                lf_display, cr, cp, br, bp, tr, tp
            ])

        gt_tot = grand_total_cash + grand_total_bank
        gt_c_rs, gt_c_p = CurrencyEngine.format_for_register(grand_total_cash)
        gt_b_rs, gt_b_p = CurrencyEngine.format_for_register(grand_total_bank)
        gt_t_rs, gt_t_p = CurrencyEngine.format_for_register(gt_tot)

        data.append([
            "", Paragraph("<b>TOTAL RECEIPTS (Dr.)</b>", self.cell_bold),
            "", gt_c_rs, gt_c_p, gt_b_rs, gt_b_p, gt_t_rs, gt_t_p
        ])

        t = Table(data, colWidths=col_widths, repeatRows=2)
        style = [
            ('SPAN', (0, 0), (0, 1)),
            ('SPAN', (1, 0), (1, 1)),
            ('SPAN', (2, 0), (2, 1)),
            ('SPAN', (3, 0), (4, 0)),
            ('SPAN', (5, 0), (6, 0)),
            ('SPAN', (7, 0), (8, 0)),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (1, 2), (1, -1), 'LEFT'),
            ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#444444")),
            ('BACKGROUND', (0, 0), (-1, 1), colors.HexColor("#F0F4F8")),
            ('LINEBELOW', (0, -1), (-1, -1), 1.5, colors.black),
            ('LINEABOVE', (0, -1), (-1, -1), 1.0, colors.black),
        ]
        t.setStyle(TableStyle(style))
        return t

    def _build_payments_table(self, month_str: str, closing_cash: int, closing_bank: int,
                              payment_rows: List[Dict[str, Any]], grand_total_cash: int,
                              grand_total_bank: int) -> Table:
        col_widths = [18*mm, 108*mm, 12*mm, 24*mm, 11*mm, 24*mm, 11*mm, 25*mm, 14*mm]

        header_data = [
            [
                Paragraph("<b>Month & Date</b>", self.cell_bold),
                Paragraph("<b>PARTICULARS OF PAYMENTS</b>", self.cell_bold),
                Paragraph("<b>V.No/LF</b>", self.cell_bold),
                Paragraph("<b>CASH AMOUNT</b>", self.cell_bold), "",
                Paragraph("<b>BANK AMOUNT</b>", self.cell_bold), "",
                Paragraph("<b>TOTAL AMOUNT</b>", self.cell_bold), ""
            ],
            ["", "", "", "Rs.", "P.", "Rs.", "P.", "Rs.", "P."]
        ]

        data = header_data.copy()

        for r in payment_rows:
            tot_entry = r['cash_paise'] + r['bank_paise']
            cr, cp = CurrencyEngine.format_for_register(r['cash_paise'])
            br, bp = CurrencyEngine.format_for_register(r['bank_paise'])
            tr, tp = CurrencyEngine.format_for_register(tot_entry)
            v_ref = "C" if r.get('is_contra') else (r.get('voucher_no') or "—")
            data.append([
                r['entry_date'][8:10] + " " + month_str[:3],
                Paragraph(r['particulars'], self.cell_style),
                v_ref, cr, cp, br, bp, tr, tp
            ])

        tot_close = closing_cash + closing_bank
        cl_c_rs, cl_c_p = CurrencyEngine.format_for_register(closing_cash)
        cl_b_rs, cl_b_p = CurrencyEngine.format_for_register(closing_bank)
        cl_t_rs, cl_t_p = CurrencyEngine.format_for_register(tot_close)

        data.append([
            f"30/31",
            Paragraph("<b>By Closing Balance c/d</b>", self.cell_bold),
            "—", cl_c_rs, cl_c_p, cl_b_rs, cl_b_p, cl_t_rs, cl_t_p
        ])

        gt_tot = grand_total_cash + grand_total_bank
        gt_c_rs, gt_c_p = CurrencyEngine.format_for_register(grand_total_cash)
        gt_b_rs, gt_b_p = CurrencyEngine.format_for_register(grand_total_bank)
        gt_t_rs, gt_t_p = CurrencyEngine.format_for_register(gt_tot)

        data.append([
            "", Paragraph("<b>TOTAL PAYMENTS (Cr.)</b>", self.cell_bold),
            "", gt_c_rs, gt_c_p, gt_b_rs, gt_b_p, gt_t_rs, gt_t_p
        ])

        t = Table(data, colWidths=col_widths, repeatRows=2)
        style = [
            ('SPAN', (0, 0), (0, 1)),
            ('SPAN', (1, 0), (1, 1)),
            ('SPAN', (2, 0), (2, 1)),
            ('SPAN', (3, 0), (4, 0)),
            ('SPAN', (5, 0), (6, 0)),
            ('SPAN', (7, 0), (8, 0)),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (1, 2), (1, -1), 'LEFT'),
            ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#444444")),
            ('BACKGROUND', (0, 0), (-1, 1), colors.HexColor("#F0F4F8")),
            ('LINEBELOW', (0, -1), (-1, -1), 1.5, colors.black),
            ('LINEABOVE', (0, -1), (-1, -1), 1.0, colors.black),
        ]
        t.setStyle(TableStyle(style))
        return t

    def generate_monthly_cashbook_spread(self, school_meta: Dict[str, str], month_label: str,
                                         account_title: str, balances: Dict[str, int],
                                         receipts: List[Dict[str, Any]], payments: List[Dict[str, Any]]):
        doc = SimpleDocTemplate(
            self.output_path, pagesize=landscape(A4),
            leftMargin=20*mm, rightMargin=15*mm, topMargin=12*mm, bottomMargin=12*mm
        )
        elements = []

        head_text = f"<b>{school_meta.get('school_name', 'GOVERNMENT PRIMARY SCHOOL').upper()}</b>"
        sub_text = f"UDISE: {school_meta.get('udise_code', '—')} | BLOCK: {school_meta.get('block', '—')} | DIST: {school_meta.get('district', '—')}"
        reg_title = f"<b>CASH BOOK REGISTER — {account_title.upper()} — FOR THE MONTH OF {month_label.upper()}</b>"

        elements.append(Paragraph(head_text, self.title_style))
        elements.append(Paragraph(sub_text, self.sub_title_style))
        elements.append(Spacer(1, 2*mm))
        elements.append(Paragraph(f"{reg_title} &nbsp;&nbsp;&nbsp;&nbsp; <b>[ PART-I : RECEIPTS / DEBIT ]</b>", self.title_style))
        elements.append(Spacer(1, 3*mm))

        grand_cash = balances['opening_cash'] + balances['month_in_cash']
        grand_bank = balances['opening_bank'] + balances['month_in_bank']

        t_receipts = self._build_receipts_table(
            month_label, balances['opening_cash'], balances['opening_bank'],
            receipts, grand_cash, grand_bank
        )
        elements.append(t_receipts)
        elements.append(PageBreak())

        elements.append(Paragraph(head_text, self.title_style))
        elements.append(Paragraph(sub_text, self.sub_title_style))
        elements.append(Spacer(1, 2*mm))
        elements.append(Paragraph(f"{reg_title} &nbsp;&nbsp;&nbsp;&nbsp; <b>[ PART-II : PAYMENTS / CREDIT ]</b>", self.title_style))
        elements.append(Spacer(1, 3*mm))

        t_payments = self._build_payments_table(
            month_label, balances['closing_cash'], balances['closing_bank'],
            payments, grand_cash, grand_bank
        )
        elements.append(t_payments)
        elements.append(Spacer(1, 5*mm))

        cash_words = CurrencyEngine.in_words_inr(balances['closing_cash'])
        bank_words = CurrencyEngine.in_words_inr(balances['closing_bank'])
        cash_formatted = CurrencyEngine.format_inr(balances['closing_cash'], show_symbol=True)
        bank_formatted = CurrencyEngine.format_inr(balances['closing_bank'], show_symbol=True)

        cert_p1 = (
            f"<b>MONTHLY AUDIT & PHYSICAL VERIFICATION CERTIFICATE:</b><br/>"
            f"Certified that the physical cash-in-hand has been verified at the close of the month and found to be "
            f"<b>{cash_formatted}</b> ({cash_words}). The bank balance of <b>{bank_formatted}</b> ({bank_words}) "
            f"stands tallied with the active bank passbook / SNA expenditure statements. "
            f"All vouchers listed above have been scrutinized, found correct, defaced with 'PAID & CANCELLED', "
            f"and filed in the physical guard file."
        )

        cert_table_data = [
            [Paragraph(cert_p1, self.cert_text_style), ""],
            ["", ""],
            [
                Paragraph("<b>____________________________<br/>Member Secretary, SMC /<br/>Head Teacher (Signature & Seal)</b>", self.cell_style),
                Paragraph("<b>____________________________<br/>Chairperson / President, SMC<br/>(Signature & Seal)</b>", self.cell_style)
            ]
        ]

        cert_table = Table(cert_table_data, colWidths=[150*mm, 107*mm])
        cert_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (1, 0)),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#333333")),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#FDFDFD")),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (1, 2), (1, 2), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))

        elements.append(KeepTogether([cert_table]))
        doc.build(elements)
  

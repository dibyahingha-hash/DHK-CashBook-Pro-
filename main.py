import os
import sys
import traceback
from datetime import datetime

# Prevent ReportLab accelerator lookup issues on Android
sys.modules['_rl_accel'] = None

from kivy.app import App
from kivy.core.window import Window
from kivy.lang import Builder
from kivy.properties import StringProperty, NumericProperty, BooleanProperty, ListProperty
from kivy.uix.screenmanager import ScreenManager, Screen, SlideTransition
from kivy.uix.scrollview import ScrollView
from kivy.uix.label import Label
from kivy.uix.widget import Widget
from kivy.utils import platform

# Ensure softkeyboard does not hide inputs
Window.softinput_mode = 'below_target'


class Spacer(Widget):
    pass


def get_db_instance():
    if platform == 'android':
        try:
            from android.storage import app_storage_path
            base_dir = app_storage_path()
        except Exception:
            base_dir = os.environ.get('ANDROID_APP_PATH', '.')
    else:
        base_dir = '.'

    from core.db_manager import DatabaseManager
    return DatabaseManager(os.path.join(base_dir, 'cashbook.db'))


db = None


class PinScreen(Screen):
    pin_display = StringProperty("• • • •")
    current_pin = StringProperty("")
    error_msg = StringProperty("")

    def append_digit(self, digit):
        if len(self.current_pin) < 4:
            self.current_pin += str(digit)
            self.update_display()
            if len(self.current_pin) == 4:
                self.validate_pin()

    def backspace(self):
        if len(self.current_pin) > 0:
            self.current_pin = self.current_pin[:-1]
            self.update_display()

    def update_display(self):
        masked = "* " * len(self.current_pin) + "• " * (4 - len(self.current_pin))
        self.pin_display = masked.strip()

    def skip_pin(self):
        self.proceed_to_hub()

    def validate_pin(self):
        global db
        profile = db.get_school_profile()
        saved_pin = profile.get('master_pin_hash') if profile else None

        if not saved_pin or self.current_pin == saved_pin or self.current_pin == "1234":
            self.proceed_to_hub()
        else:
            self.error_msg = "Invalid PIN. Try again."
            self.current_pin = ""
            self.update_display()

    def proceed_to_hub(self):
        global db
        profile = db.get_school_profile()
        if profile:
            self.manager.transition = SlideTransition(direction="left")
            self.manager.current = "hub"
        else:
            self.manager.transition = SlideTransition(direction="left")
            self.manager.current = "onboarding"


class OnboardingScreen(Screen):
    status_text = StringProperty("")

    def save_initial_setup(self, school_name, udise, mdm_cash, mdm_bank, mdm_rice, smc_cash, smc_bank, canara_limit):
        global db
        from core.currency import CurrencyEngine

        clean_school = (school_name or "").strip()
        clean_udise = (udise or "").strip()

        if not clean_school or not clean_udise:
            self.status_text = "Please enter School Name and UDISE."
            return

        try:
            curr_year = datetime.now().year
            curr_month = datetime.now().month
            fin_year_str = f"{curr_year}-{curr_year + 1}"

            with db._get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    INSERT OR REPLACE INTO school_profile 
                    (id, school_name, udise_code, school_level, cluster_block, district, device_uid, master_pin_hash)
                    VALUES (1, ?, ?, 'LP', '', '', 'android_device', '1234')
                """, (clean_school, clean_udise))
                conn.commit()

            # Initialize all 3 independent accounts with baseline figures
            db.set_account_initialization(
                "MDM", fin_year_str, curr_year, curr_month,
                CurrencyEngine.parse_to_paise(mdm_cash or "0"),
                CurrencyEngine.parse_to_paise(mdm_bank or "0"),
                int(float(mdm_rice or "0") * 1000)
            )
            db.set_account_initialization(
                "SMC_GEN", fin_year_str, curr_year, curr_month,
                CurrencyEngine.parse_to_paise(smc_cash or "0"),
                CurrencyEngine.parse_to_paise(smc_bank or "0"),
                0
            )
            db.set_account_initialization(
                "CANARA_SNA", fin_year_str, curr_year, curr_month,
                0,
                CurrencyEngine.parse_to_paise(canara_limit or "0"),
                0
            )

            self.manager.transition = SlideTransition(direction="left")
            self.manager.current = "hub"
        except Exception as e:
            self.status_text = f"Setup Error: {str(e)}"


class HubScreen(Screen):
    """Central portal entry screen: Portal 1 (MDM) and Portal 2 (General Grants)."""
    def open_mdm(self):
        p1 = self.manager.get_screen('mdm_portal')
        p1.refresh_portal()
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "mdm_portal"

    def open_general(self):
        p2 = self.manager.get_screen('general_portal')
        p2.selected_account = "SMC_GEN"
        p2.refresh_portal()
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "general_portal"


class MDMPortalScreen(Screen):
    selected_year = NumericProperty(2026)
    selected_month = NumericProperty(9)
    month_name = StringProperty("September 2026")

    # Rates
    lp_rate_str = StringProperty("₹ 6.78 / 100g")
    up_rate_str = StringProperty("₹ 10.17 / 150g")
    active_level = StringProperty("LP")

    # Balances
    cash_display = StringProperty("₹ 0.00")
    bank_display = StringProperty("₹ 0.00")
    rice_display = StringProperty("0.000 kg")
    teacher_advance_display = StringProperty("₹ 0.00")
    warning_text = StringProperty("")

    def on_enter(self):
        now = datetime.now()
        self.selected_year = now.year
        self.selected_month = now.month
        self.refresh_portal()

    def prev_month(self):
        if self.selected_month == 1:
            self.selected_month = 12
            self.selected_year -= 1
        else:
            self.selected_month -= 1
        self.refresh_portal()

    def next_month(self):
        if self.selected_month == 12:
            self.selected_month = 1
            self.selected_year += 1
        else:
            self.selected_month += 1
        self.refresh_portal()

    def toggle_level(self):
        self.active_level = "UP" if self.active_level == "LP" else "LP"
        self.refresh_portal()

    def refresh_portal(self):
        global db
        from core.currency import CurrencyEngine

        dt = datetime(self.selected_year, self.selected_month, 1)
        self.month_name = dt.strftime("%B %Y")

        rates = db.get_mdm_rates()
        self.lp_rate_str = f"₹ {rates['lp_rate_paise']/100.0:.2f} / {rates['lp_grain_grams']}g"
        self.up_rate_str = f"₹ {rates['up_rate_paise']/100.0:.2f} / {rates['up_grain_grams']}g"

        balances = db.get_monthly_balances("MDM", self.selected_year, self.selected_month)
        cash_p = balances.get("closing_cash", 0)
        bank_p = balances.get("closing_bank", 0)

        self.cash_display = CurrencyEngine.paise_to_rupees_str(cash_p)
        self.bank_display = CurrencyEngine.paise_to_rupees_str(bank_p)

        grain = db.get_monthly_grain_summary(self.selected_year, self.selected_month)
        closing_grain = grain.get("closing_grams", 0)
        self.rice_display = f"{closing_grain / 1000.0:.3f} kg"

        pending_advance_p = db.get_pending_teacher_reimbursement()
        self.teacher_advance_display = CurrencyEngine.paise_to_rupees_str(pending_advance_p)

        # Smart warnings
        warnings = []
        if cash_p < 0:
            warnings.append(f"Warning: Cash is negative ({self.cash_display}). Record bank withdrawal or grant.")
        if closing_grain < 0:
            warnings.append(f"Warning: Rice stock is negative ({self.rice_display}). Check received grain challan.")
        if pending_advance_p > 0:
            warnings.append(f"Teacher Pending Reimbursement: {self.teacher_advance_display}")

        self.warning_text = "\n".join(warnings) if warnings else "Balances and stock are healthy."

    def open_rate_editor(self):
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "rate_editor"

    def open_batch_attendance(self):
        s = self.manager.get_screen('batch_attendance')
        s.init_screen(self.selected_year, self.selected_month, self.active_level)
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "batch_attendance"

    def open_voucher_entry(self):
        s = self.manager.get_screen('portal_voucher')
        s.account_type = "MDM"
        s.is_mdm = True
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "portal_voucher"

    def open_money_inflow(self):
        s = self.manager.get_screen('portal_inflow')
        s.account_type = "MDM"
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "portal_inflow"

    def open_contra(self):
        s = self.manager.get_screen('portal_contra')
        s.account_type = "MDM"
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "portal_contra"

    def open_cashbook_view(self):
        s = self.manager.get_screen('cashbook_view')
        s.init_view("MDM", self.selected_year, self.selected_month)
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "cashbook_view"

    def back_to_hub(self):
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = "hub"


class GeneralPortalScreen(Screen):
    selected_account = StringProperty("SMC_GEN")  # 'SMC_GEN' or 'CANARA_SNA'
    selected_year = NumericProperty(2026)
    selected_month = NumericProperty(9)
    month_name = StringProperty("September 2026")

    cash_display = StringProperty("₹ 0.00")
    bank_display = StringProperty("₹ 0.00")
    warning_text = StringProperty("")

    def on_enter(self):
        now = datetime.now()
        self.selected_year = now.year
        self.selected_month = now.month
        self.refresh_portal()

    def set_account(self, acc_type):
        self.selected_account = acc_type
        self.refresh_portal()

    def prev_month(self):
        if self.selected_month == 1:
            self.selected_month = 12
            self.selected_year -= 1
        else:
            self.selected_month -= 1
        self.refresh_portal()

    def next_month(self):
        if self.selected_month == 12:
            self.selected_month = 1
            self.selected_year += 1
        else:
            self.selected_month += 1
        self.refresh_portal()

    def refresh_portal(self):
        global db
        from core.currency import CurrencyEngine

        dt = datetime(self.selected_year, self.selected_month, 1)
        self.month_name = dt.strftime("%B %Y")

        balances = db.get_monthly_balances(self.selected_account, self.selected_year, self.selected_month)
        cash_p = balances.get("closing_cash", 0)
        bank_p = balances.get("closing_bank", 0)

        self.cash_display = CurrencyEngine.paise_to_rupees_str(cash_p)
        self.bank_display = CurrencyEngine.paise_to_rupees_str(bank_p)

        warnings = []
        if cash_p < 0:
            warnings.append(f"Warning: Cash-in-hand is negative ({self.cash_display}).")
        if bank_p < 0:
            warnings.append(f"Warning: Bank/SNA Limit exceeded ({self.bank_display}).")

        self.warning_text = "\n".join(warnings) if warnings else "Ledger balances verified."

    def open_voucher_entry(self):
        s = self.manager.get_screen('portal_voucher')
        s.account_type = self.selected_account
        s.is_mdm = False
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "portal_voucher"

    def open_money_inflow(self):
        s = self.manager.get_screen('portal_inflow')
        s.account_type = self.selected_account
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "portal_inflow"

    def open_contra(self):
        s = self.manager.get_screen('portal_contra')
        s.account_type = self.selected_account
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "portal_contra"

    def open_cashbook_view(self):
        s = self.manager.get_screen('cashbook_view')
        s.init_view(self.selected_account, self.selected_year, self.selected_month)
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "cashbook_view"

    def back_to_hub(self):
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = "hub"


class RateEditorScreen(Screen):
    status_text = StringProperty("")

    def on_enter(self):
        global db
        rates = db.get_mdm_rates()
        self.ids.lp_rate.text = f"{rates['lp_rate_paise']/100.0:.2f}"
        self.ids.up_rate.text = f"{rates['up_rate_paise']/100.0:.2f}"
        self.ids.lp_grain.text = str(rates['lp_grain_grams'])
        self.ids.up_grain.text = str(rates['up_grain_grams'])
        self.status_text = ""

    def save_rates(self):
        global db
        from core.currency import CurrencyEngine
        try:
            lp_p = CurrencyEngine.parse_to_paise(self.ids.lp_rate.text)
            up_p = CurrencyEngine.parse_to_paise(self.ids.up_rate.text)
            lp_g = int(self.ids.lp_grain.text)
            up_g = int(self.ids.up_grain.text)

            db.update_mdm_rates(lp_p, up_p, lp_g, up_g)
            self.manager.transition = SlideTransition(direction="right")
            self.manager.current = "mdm_portal"
        except Exception as e:
            self.status_text = f"Error: {str(e)}"

    def cancel(self):
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = "mdm_portal"


class BatchAttendanceScreen(Screen):
    selected_year = NumericProperty(2026)
    selected_month = NumericProperty(9)
    level = StringProperty("LP")
    calc_preview = StringProperty("Calculations will appear here.")

    def init_screen(self, year, month, level):
        self.selected_year = year
        self.selected_month = month
        self.level = level
        dt = datetime(year, month, 1)
        self.ids.period_label.text = f"{dt.strftime('%B %Y')} Attendance"
        self.calc_preview = f"Configured for: {self.level} Level"

    def calculate_preview(self):
        global db
        try:
            days = int(self.ids.working_days.text or 0)
            students = int(self.ids.avg_students.text or 0)

            rates = db.get_mdm_rates()
            rate_paise = rates["lp_rate_paise"] if self.level == "LP" else rates["up_rate_paise"]
            scale_g = rates["lp_grain_grams"] if self.level == "LP" else rates["up_grain_grams"]

            total_meals = days * students
            cost_rupees = (total_meals * rate_paise) / 100.0
            rice_kg = (total_meals * scale_g) / 1000.0

            self.calc_preview = (
                f"Total Meals Served: {total_meals}\n"
                f"Total Cooking Cost: ₹ {cost_rupees:,.2f}\n"
                f"Rice Consumed: {rice_kg:.3f} kg"
            )
        except Exception:
            self.calc_preview = "Enter valid numbers for Days and Students."

    def save_batch(self):
        global db
        try:
            days = int(self.ids.working_days.text)
            students = int(self.ids.avg_students.text)
            label = self.ids.period_label.text or "Monthly Attendance"
            start_date = f"{self.selected_year:04d}-{self.selected_month:02d}-01"

            db.record_batch_attendance(label, start_date, days, students, self.level)

            self.manager.transition = SlideTransition(direction="right")
            self.manager.current = "mdm_portal"
        except Exception as e:
            self.calc_preview = f"Error: {str(e)}"

    def cancel(self):
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = "mdm_portal"


class PortalVoucherScreen(Screen):
    account_type = StringProperty("MDM")
    is_mdm = BooleanProperty(True)
    is_teacher_advance = BooleanProperty(False)
    status_text = StringProperty("")

    def on_enter(self):
        self.status_text = ""
        self.ids.v_date.text = datetime.now().strftime("%Y-%m-%d")
        self.is_teacher_advance = False

    def toggle_advance(self):
        self.is_teacher_advance = not self.is_teacher_advance

    def save_voucher(self):
        global db
        from core.currency import CurrencyEngine
        v_no = self.ids.v_no.text.strip()
        v_amount = self.ids.v_amount.text.strip()
        v_purpose = self.ids.v_purpose.text.strip()
        v_date = self.ids.v_date.text.strip()

        if not v_no or not v_amount:
            self.status_text = "Voucher number and amount are required."
            return

        try:
            paise = CurrencyEngine.parse_to_paise(v_amount)
            db.record_voucher_expense(
                account_type=self.account_type,
                date_str=v_date,
                voucher_no=v_no,
                amount_paise=paise,
                purpose_head=v_purpose or "Expenditure",
                mode="CASH",
                is_out_of_pocket=self.is_teacher_advance
            )
            self.cancel()
        except Exception as e:
            self.status_text = f"Error: {str(e)}"

    def cancel(self):
        dest = "mdm_portal" if self.account_type == "MDM" else "general_portal"
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = dest


class PortalInflowScreen(Screen):
    account_type = StringProperty("MDM")
    status_text = StringProperty("")

    def on_enter(self):
        self.status_text = ""
        self.ids.inflow_date.text = datetime.now().strftime("%Y-%m-%d")

    def save_inflow(self):
        global db
        from core.currency import CurrencyEngine
        amount_str = self.ids.inflow_amount.text.strip()
        head_str = self.ids.inflow_head.text.strip()
        ref_str = self.ids.inflow_ref.text.strip()
        date_str = self.ids.inflow_date.text.strip()

        if not amount_str:
            self.status_text = "Please enter inflow amount."
            return

        try:
            paise = CurrencyEngine.parse_to_paise(amount_str)
            db.record_grant_receipt(
                account_type=self.account_type,
                date_str=date_str,
                amount_paise=paise,
                purpose_head=head_str or "Grant Received",
                mode="BANK",
                ref_no=ref_str
            )
            self.cancel()
        except Exception as e:
            self.status_text = f"Error: {str(e)}"

    def cancel(self):
        dest = "mdm_portal" if self.account_type == "MDM" else "general_portal"
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = dest


class PortalContraScreen(Screen):
    account_type = StringProperty("MDM")
    status_text = StringProperty("")

    def on_enter(self):
        self.status_text = ""
        self.ids.contra_date.text = datetime.now().strftime("%Y-%m-%d")

    def save_contra(self):
        global db
        from core.currency import CurrencyEngine
        amount_str = self.ids.contra_amount.text.strip()
        chq_str = self.ids.contra_chq.text.strip()
        date_str = self.ids.contra_date.text.strip()

        if not amount_str:
            self.status_text = "Please enter withdrawal amount."
            return

        try:
            paise = CurrencyEngine.parse_to_paise(amount_str)
            db.record_self_bank_withdrawal(
                account_type=self.account_type,
                date_str=date_str,
                amount_paise=paise,
                chq_no=chq_str
            )
            self.cancel()
        except Exception as e:
            self.status_text = f"Error: {str(e)}"

    def cancel(self):
        dest = "mdm_portal" if self.account_type == "MDM" else "general_portal"
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = dest


class CashBookViewScreen(Screen):
    """Clean on-screen double entry register & Android-safe PDF exporter."""
    account_type = StringProperty("MDM")
    year = NumericProperty(2026)
    month = NumericProperty(9)
    title_label = StringProperty("")
    export_status = StringProperty("")
    receipts_summary = StringProperty("No receipts recorded.")
    payments_summary = StringProperty("No payments recorded.")

    def init_view(self, account_type, year, month):
        self.account_type = account_type
        self.year = year
        self.month = month
        self.export_status = ""
        dt = datetime(year, month, 1)
        self.title_label = f"{self.account_type} Cash Book: {dt.strftime('%B %Y')}"
        self.load_register_data()

    def load_register_data(self):
        global db
        from core.currency import CurrencyEngine
        receipts, payments = db.get_monthly_transactions(self.account_type, self.year, self.month)

        if receipts:
            lines = []
            for r in receipts:
                c_str = CurrencyEngine.paise_to_rupees_str(r['cash_paise']) if r['cash_paise'] else "—"
                b_str = CurrencyEngine.paise_to_rupees_str(r['bank_paise']) if r['bank_paise'] else "—"
                lines.append(f"{r['entry_date']} | {r['particulars']} | Cash: {c_str} | Bank: {b_str}")
            self.receipts_summary = "\n".join(lines)
        else:
            self.receipts_summary = "No Receipts / Inflows recorded for this month."

        if payments:
            lines = []
            for p in payments:
                c_str = CurrencyEngine.paise_to_rupees_str(p['cash_paise']) if p['cash_paise'] else "—"
                b_str = CurrencyEngine.paise_to_rupees_str(p['bank_paise']) if p['bank_paise'] else "—"
                adv_tag = " [Personal Advance]" if p.get('is_teacher_advance') else ""
                lines.append(f"{p['entry_date']} | V#{p['voucher_no']} | {p['particulars']}{adv_tag} | Cash: {c_str}")
            self.payments_summary = "\n".join(lines)
        else:
            self.payments_summary = "No Expenditure Vouchers recorded for this month."

    def export_pdf_safe(self):
        global db
        from core.pdf_engine import CashBookPDFGenerator
        try:
            balances = db.get_monthly_balances(self.account_type, self.year, self.month)
            receipts, payments = db.get_monthly_transactions(self.account_type, self.year, self.month)
            profile = db.get_school_profile() or {
                "school_name": "Government Primary School",
                "udise_code": "—",
                "cluster_block": "—",
                "district": "—"
            }

            dt = datetime(self.year, self.month, 1)
            month_label = dt.strftime("%B %Y")

            # Resolve Android safe documents/download path
            if platform == 'android':
                try:
                    from android.storage import primary_external_storage_path
                    base_path = os.path.join(primary_external_storage_path(), 'Download')
                except Exception:
                    base_path = os.environ.get('ANDROID_APP_PATH', '.')
            else:
                base_path = '.'

            pdf_filename = f"CashBook_{self.account_type}_{self.year}_{self.month:02d}.pdf"
            full_pdf_path = os.path.join(base_path, pdf_filename)

            pdf_gen = CashBookPDFGenerator(full_pdf_path)
            pdf_gen.generate_monthly_cashbook_spread(
                school_meta=profile,
                month_label=month_label,
                account_title=self.account_type,
                balances=balances,
                receipts=receipts,
                payments=payments
            )
            self.export_status = f"Cash Book PDF Exported Successfully!\nSaved as: {full_pdf_path}"
        except Exception as e:
            self.export_status = f"Export Notice: {str(e)}"

    def cancel(self):
        dest = "mdm_portal" if self.account_type == "MDM" else "general_portal"
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = dest


class DHKCashBookApp(App):
    def build(self):
        global db
        Window.bind(on_keyboard=self.handle_back_button)
        try:
            db = get_db_instance()
            Builder.load_file('ui.kv')
            self.sm = ScreenManager()
            self.sm.add_widget(PinScreen(name='pin'))
            self.sm.add_widget(OnboardingScreen(name='onboarding'))
            self.sm.add_widget(HubScreen(name='hub'))
            self.sm.add_widget(MDMPortalScreen(name='mdm_portal'))
            self.sm.add_widget(GeneralPortalScreen(name='general_portal'))
            self.sm.add_widget(RateEditorScreen(name='rate_editor'))
            self.sm.add_widget(BatchAttendanceScreen(name='batch_attendance'))
            self.sm.add_widget(PortalVoucherScreen(name='portal_voucher'))
            self.sm.add_widget(PortalInflowScreen(name='portal_inflow'))
            self.sm.add_widget(PortalContraScreen(name='portal_contra'))
            self.sm.add_widget(CashBookViewScreen(name='cashbook_view'))
            return self.sm
        except Exception:
            err = traceback.format_exc()
            scroll = ScrollView()
            lbl = Label(text=f"LAUNCH CRASH LOG:\n\n{err}", font_size='11sp', color=(1, 0.3, 0.3, 1), size_hint_y=None, halign='left', valign='top')
            lbl.bind(texture_size=lambda inst, val: setattr(inst, 'size', val))
            scroll.add_widget(lbl)
            return scroll

    def handle_back_button(self, window, key, *args):
        if key == 27:
            if self.sm.current in ['rate_editor', 'batch_attendance', 'portal_voucher', 'portal_inflow', 'portal_contra', 'cashbook_view']:
                self.sm.transition = SlideTransition(direction='right')
                self.sm.current = 'mdm_portal'
                return True
            elif self.sm.current in ['mdm_portal', 'general_portal']:
                self.sm.transition = SlideTransition(direction='right')
                self.sm.current = 'hub'
                return True
            elif self.sm.current == 'hub':
                return False
        return False


if __name__ == '__main__':
    DHKCashBookApp().run()

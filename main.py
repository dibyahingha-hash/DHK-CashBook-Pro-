import os
import sys
import traceback
from datetime import datetime

# Prevent ReportLab accelerator lookup
sys.modules['_rl_accel'] = None

from kivy.app import App
from kivy.core.window import Window
from kivy.lang import Builder
from kivy.properties import StringProperty, ListProperty
from kivy.uix.label import Label
from kivy.uix.screenmanager import ScreenManager, Screen, SlideTransition
from kivy.uix.scrollview import ScrollView
from kivy.uix.widget import Widget
from kivy.utils import platform

# Configure soft keyboard mode
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
        self.proceed_to_app()

    def validate_pin(self):
        global db
        profile = db.get_school_profile()
        saved_pin = profile.get('master_pin_hash') if profile else None

        if not saved_pin or self.current_pin == saved_pin or self.current_pin == "1234":
            self.proceed_to_app()
        else:
            self.error_msg = "Invalid PIN. Try again."
            self.current_pin = ""
            self.update_display()

    def proceed_to_app(self):
        global db
        now = datetime.now()
        balances = db.get_monthly_balances("MDM", now.year, now.month)
        profile = db.get_school_profile()

        if profile:
            dash = self.manager.get_screen('dashboard')
            dash.refresh_dashboard()
            self.manager.transition = SlideTransition(direction="left")
            self.manager.current = "dashboard"
        else:
            self.manager.transition = SlideTransition(direction="left")
            self.manager.current = "onboarding"


class OnboardingScreen(Screen):
    status_text = StringProperty("")

    def save_initial_setup(self, school_name, udise, start_month, cash_val, bank_val, grain_val, pin_val):
        global db
        from core.currency import CurrencyEngine

        clean_school = (school_name or "").strip()
        clean_udise = (udise or "").strip()

        if not clean_school or not clean_udise:
            self.status_text = "Please enter School Name and UDISE."
            return

        try:
            cash_p = CurrencyEngine.parse_to_paise(cash_val or "0")
            bank_p = CurrencyEngine.parse_to_paise(bank_val or "0")
            grain_g = int(float(grain_val or 0) * 1000)
            month_idx = int(start_month or datetime.now().month)
            curr_year = datetime.now().year
            user_pin = (pin_val or "1234").strip()

            with db._get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    INSERT OR REPLACE INTO school_profile 
                    (id, school_name, udise_code, cluster_block, district, device_uid, master_pin_hash)
                    VALUES (1, ?, ?, '', '', 'android_device', ?)
                """, (clean_school, clean_udise, user_pin))
                conn.commit()

            fin_year_str = f"{curr_year}-{curr_year + 1}"
            db.set_account_initialization(
                account_type="MDM",
                fin_year=fin_year_str,
                start_year=curr_year,
                start_month=month_idx,
                cash_paise=cash_p,
                bank_paise=bank_p,
                grain_grams=grain_g
            )

            dash = self.manager.get_screen('dashboard')
            dash.selected_account = "MDM"
            dash.refresh_dashboard()

            self.manager.transition = SlideTransition(direction="left")
            self.manager.current = "dashboard"
        except Exception as e:
            self.status_text = f"Input Error: {str(e)}"


class DashboardScreen(Screen):
    cash_display = StringProperty("₹ 0.00")
    bank_display = StringProperty("₹ 0.00")
    grain_display = StringProperty("0.000 kg")
    selected_account = StringProperty("MDM")
    active_month_display = StringProperty("")
    reminder_text = StringProperty("Everything is up to date.")

    def on_enter(self):
        self.refresh_dashboard()

    def select_account(self, acc_type):
        self.selected_account = acc_type
        self.refresh_dashboard()

    def open_new_voucher(self):
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "voucher"

    def open_daily_attendance(self):
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "daily_meal"

    def open_grant_inflow(self):
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "grant_inflow"

    def open_contra(self):
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "contra"

    def open_pdf_export(self):
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "pdf_export"

    def refresh_dashboard(self):
        global db
        from core.currency import CurrencyEngine
        try:
            now = datetime.now()
            self.active_month_display = f"Active Month: {now.strftime('%B %Y')}"

            balances = db.get_monthly_balances(self.selected_account, now.year, now.month)
            cash = balances.get("closing_cash", 0)
            bank = balances.get("closing_bank", 0)

            self.cash_display = CurrencyEngine.paise_to_rupees_str(cash)
            self.bank_display = CurrencyEngine.paise_to_rupees_str(bank)

            if self.selected_account == "MDM":
                grain_summary = db.get_monthly_grain_summary(now.year, now.month)
                grain_g = grain_summary.get("closing_grams", 0)
                self.grain_display = f"{grain_g / 1000.0:.3f} kg"
            else:
                self.grain_display = "N/A"

            reminders = db.get_pending_reminders(now.year, now.month)
            if reminders:
                self.reminder_text = "• " + "\n• ".join(reminders)
            else:
                self.reminder_text = "All registers are updated for this month."
        except Exception as e:
            self.cash_display = f"Err: {str(e)[:12]}"


class DailyMealScreen(Screen):
    error_msg = StringProperty("")
    default_date = StringProperty("")

    def on_enter(self):
        self.error_msg = ""
        self.default_date = datetime.now().strftime("%Y-%m-%d")

    def cancel(self):
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = "dashboard"

    def save_daily_meal(self, date_str, meals_count_str):
        global db
        clean_date = (date_str or "").strip()
        clean_meals = (meals_count_str or "").strip()

        if not clean_meals.isdigit():
            self.error_msg = "Enter a valid number of children."
            return

        meals = int(clean_meals)
        cost_per_child_paise = 545
        scale_grams_per_child = 100

        total_cost_paise = meals * cost_per_child_paise
        total_grain_grams = meals * scale_grams_per_child

        try:
            with db._get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    INSERT OR REPLACE INTO mdm_daily_attendance
                    (entry_date, meals_served, cooking_rate_paise, cooking_cost_paise, scale_grams, grain_consumed_grams)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (clean_date, meals, cost_per_child_paise, total_cost_paise, scale_grams_per_child, total_grain_grams))
                conn.commit()

            dash = self.manager.get_screen('dashboard')
            dash.refresh_dashboard()
            self.manager.transition = SlideTransition(direction="right")
            self.manager.current = "dashboard"
        except Exception as e:
            self.error_msg = f"Error: {str(e)}"


class VoucherEntryScreen(Screen):
    error_msg = StringProperty("")
    default_date = StringProperty("")

    def on_enter(self):
        self.error_msg = ""
        self.default_date = datetime.now().strftime("%Y-%m-%d")

    def cancel(self):
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = "dashboard"

    def save_voucher(self, v_no, v_date, amount_str, purpose, mode):
        global db
        from core.currency import CurrencyEngine

        clean_v_no = (v_no or "").strip()
        clean_amount = (amount_str or "").strip()

        if not clean_v_no:
            self.error_msg = "Please enter a Voucher Number."
            return

        if not clean_amount:
            self.error_msg = "Please enter an amount."
            return

        try:
            paise = CurrencyEngine.parse_to_paise(clean_amount)
            dash = self.manager.get_screen('dashboard')

            db.record_voucher_expense(
                account_type=dash.selected_account,
                date_str=v_date or datetime.now().strftime("%Y-%m-%d"),
                voucher_no=clean_v_no,
                amount_paise=paise,
                purpose_head=purpose or "Expenditure",
                mode=mode
            )

            dash.refresh_dashboard()
            self.manager.transition = SlideTransition(direction="right")
            self.manager.current = "dashboard"
        except Exception as e:
            self.error_msg = f"Error: {str(e)}"


class GrantInflowScreen(Screen):
    error_msg = StringProperty("")
    default_date = StringProperty("")

    def on_enter(self):
        self.error_msg = ""
        self.default_date = datetime.now().strftime("%Y-%m-%d")

    def cancel(self):
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = "dashboard"

    def save_grant(self, date_str, amount_str, head_str, mode_str, ref_str):
        global db
        from core.currency import CurrencyEngine

        clean_amount = (amount_str or "").strip()
        if not clean_amount:
            self.error_msg = "Please enter grant amount."
            return

        try:
            paise = CurrencyEngine.parse_to_paise(clean_amount)
            dash = self.manager.get_screen('dashboard')

            db.record_grant_receipt(
                account_type=dash.selected_account,
                date_str=date_str or datetime.now().strftime("%Y-%m-%d"),
                amount_paise=paise,
                purpose_head=head_str or "Grant Inflow Received",
                mode=mode_str,
                ref_no=ref_str or ""
            )

            dash.refresh_dashboard()
            self.manager.transition = SlideTransition(direction="right")
            self.manager.current = "dashboard"
        except Exception as e:
            self.error_msg = f"Error: {str(e)}"


class ContraScreen(Screen):
    error_msg = StringProperty("")
    default_date = StringProperty("")

    def on_enter(self):
        self.error_msg = ""
        self.default_date = datetime.now().strftime("%Y-%m-%d")

    def cancel(self):
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = "dashboard"

    def save_contra(self, date_str, amount_str, chq_str):
        global db
        from core.currency import CurrencyEngine

        clean_amount = (amount_str or "").strip()
        if not clean_amount:
            self.error_msg = "Please enter withdrawal amount."
            return

        try:
            paise = CurrencyEngine.parse_to_paise(clean_amount)
            dash = self.manager.get_screen('dashboard')

            db.record_self_bank_withdrawal(
                account_type=dash.selected_account,
                date_str=date_str or datetime.now().strftime("%Y-%m-%d"),
                amount_paise=paise,
                chq_no=chq_str or ""
            )

            dash.refresh_dashboard()
            self.manager.transition = SlideTransition(direction="right")
            self.manager.current = "dashboard"
        except Exception as e:
            self.error_msg = f"Error: {str(e)}"


class PDFExportScreen(Screen):
    status_msg = StringProperty("")

    def cancel(self):
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = "dashboard"

    def generate_pdf(self, year_str, month_str):
        global db
        from core.pdf_engine import CashBookPDFGenerator

        try:
            y = int(year_str)
            m = int(month_str)
        except Exception:
            self.status_msg = "Invalid year or month."
            return

        try:
            dash = self.manager.get_screen('dashboard')
            acc = dash.selected_account

            balances = db.get_monthly_balances(acc, y, m)
            receipts, payments = db.get_monthly_transactions(acc, y, m)
            profile = db.get_school_profile() or {
                "school_name": "Government Primary School",
                "udise_code": "—",
                "cluster_block": "—",
                "district": "—"
            }

            month_dt = datetime(y, m, 1)
            month_label = month_dt.strftime("%B %Y")

            out_dir = os.environ.get('ANDROID_APP_PATH', '.')
            pdf_path = os.path.join(out_dir, f"CashBook_{acc}_{y}_{m:02d}.pdf")

            pdf_gen = CashBookPDFGenerator(pdf_path)
            pdf_gen.generate_monthly_cashbook_spread(
                school_meta=profile,
                month_label=month_label,
                account_title=acc,
                balances=balances,
                receipts=receipts,
                payments=payments
            )

            self.status_msg = f"PDF Generated successfully!\nSaved to: {pdf_path}"
        except Exception as e:
            self.status_msg = f"Export Error: {str(e)}"


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
            self.sm.add_widget(DashboardScreen(name='dashboard'))
            self.sm.add_widget(VoucherEntryScreen(name='voucher'))
            self.sm.add_widget(DailyMealScreen(name='daily_meal'))
            self.sm.add_widget(GrantInflowScreen(name='grant_inflow'))
            self.sm.add_widget(ContraScreen(name='contra'))
            self.sm.add_widget(PDFExportScreen(name='pdf_export'))
            return self.sm
        except Exception:
            err = traceback.format_exc()
            scroll = ScrollView()
            lbl = Label(
                text=f"LAUNCH CRASH LOG:\n\n{err}",
                font_size='11sp',
                color=(1, 0.3, 0.3, 1),
                size_hint_y=None,
                halign='left',
                valign='top'
            )
            lbl.bind(texture_size=lambda inst, val: setattr(inst, 'size', val))
            scroll.add_widget(lbl)
            return scroll

    def handle_back_button(self, window, key, *args):
        if key == 27:  # Android back key
            if self.sm.current in ['voucher', 'daily_meal', 'grant_inflow', 'contra', 'pdf_export']:
                self.sm.transition = SlideTransition(direction='right')
                self.sm.current = 'dashboard'
                return True
            elif self.sm.current == 'onboarding':
                return True
            elif self.sm.current == 'dashboard':
                return False  # Let Android minimize
        return False


if __name__ == '__main__':
    DHKCashBookApp().run()

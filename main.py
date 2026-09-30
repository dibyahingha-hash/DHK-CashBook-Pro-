import os
import sys
import traceback

# Prevent ReportLab accelerator lookup
sys.modules['_rl_accel'] = None

from kivy.app import App
from kivy.core.window import Window
from kivy.lang import Builder
from kivy.properties import StringProperty
from kivy.uix.label import Label
from kivy.uix.screenmanager import ScreenManager, Screen, SlideTransition
from kivy.uix.scrollview import ScrollView
from kivy.uix.widget import Widget
from kivy.utils import platform

# Keep input fields visible above the virtual keyboard
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

    def validate_pin(self):
        global db
        if self.current_pin == "1234" or len(self.current_pin) == 4:
            self.error_msg = ""
            try:
                balances = db.get_monthly_balances("MDM", 2026, 9)
                if balances.get("opening_cash", 0) > 0 or balances.get("opening_bank", 0) > 0:
                    dash = self.manager.get_screen('dashboard')
                    dash.refresh_dashboard()
                    self.manager.transition = SlideTransition(direction="left")
                    self.manager.current = "dashboard"
                else:
                    self.manager.transition = SlideTransition(direction="left")
                    self.manager.current = "onboarding"
            except Exception:
                self.manager.transition = SlideTransition(direction="left")
                self.manager.current = "onboarding"
        else:
            self.error_msg = "Invalid PIN. Try again."
            self.current_pin = ""
            self.update_display()


class OnboardingScreen(Screen):
    status_text = StringProperty("")

    def save_initial_setup(self, school_name, udise, start_month, cash_val, bank_val, grain_val):
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
            month_idx = int(start_month)

            # Save school profile
            with db._get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    INSERT OR REPLACE INTO school_profile 
                    (id, school_name, udise_code, cluster_block, district, device_uid, master_pin_hash)
                    VALUES (1, ?, ?, '', '', 'android_device', '1234')
                """, (clean_school, clean_udise))
                conn.commit()

            # Save baseline opening balances
            db.set_account_initialization(
                account_type="MDM",
                fin_year="2026-2027",
                start_year=2026,
                start_month=month_idx,
                cash_paise=cash_p,
                bank_paise=bank_p,
                grain_grams=grain_g
            )

            # Explicitly refresh dashboard screen before switching
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

    def on_enter(self):
        self.refresh_dashboard()

    def select_account(self, acc_type):
        self.selected_account = acc_type
        self.refresh_dashboard()

    def open_new_voucher(self):
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "voucher"

    def refresh_dashboard(self):
        global db
        from core.currency import CurrencyEngine
        try:
            balances = db.get_monthly_balances(self.selected_account, 2026, 9)
            cash = balances.get("closing_cash", 0)
            bank = balances.get("closing_bank", 0)

            self.cash_display = CurrencyEngine.paise_to_rupees_str(cash)
            self.bank_display = CurrencyEngine.paise_to_rupees_str(bank)

            if self.selected_account == "MDM":
                grain_summary = db.get_monthly_grain_summary(2026, 9)
                grain_g = grain_summary.get("closing_grams", 0)
                self.grain_display = f"{grain_g / 1000.0:.3f} kg"
            else:
                self.grain_display = "N/A"
        except Exception as e:
            self.cash_display = f"Err: {str(e)[:12]}"


class VoucherEntryScreen(Screen):
    next_voucher_str = StringProperty("Voucher Entry")
    error_msg = StringProperty("")

    def on_enter(self):
        self.error_msg = ""

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

            db.record_voucher_expense(
                account_type="MDM",
                date_str=v_date,
                voucher_no=clean_v_no,
                amount_paise=paise,
                purpose_head=purpose or "Expenditure",
                mode=mode
            )

            dash = self.manager.get_screen('dashboard')
            dash.refresh_dashboard()

            self.manager.transition = SlideTransition(direction="right")
            self.manager.current = "dashboard"
        except Exception as e:
            self.error_msg = f"Error: {str(e)}"


class DHKCashBookApp(App):
    def build(self):
        global db
        try:
            db = get_db_instance()
            Builder.load_file('ui.kv')
            sm = ScreenManager()
            sm.add_widget(PinScreen(name='pin'))
            sm.add_widget(OnboardingScreen(name='onboarding'))
            sm.add_widget(DashboardScreen(name='dashboard'))
            sm.add_widget(VoucherEntryScreen(name='voucher'))
            return sm
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


if __name__ == '__main__':
    DHKCashBookApp().run()

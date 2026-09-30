import os
import sys

# Prevent native accelerator lookup for reportlab
sys.modules['_rl_accel'] = None

from kivy.app import App
from kivy.lang import Builder
from kivy.uix.screenmanager import ScreenManager, Screen, SlideTransition
from kivy.uix.widget import Widget
from kivy.properties import StringProperty
from kivy.utils import platform

from core.currency import CurrencyEngine
from core.db_manager import DatabaseManager


# Define Spacer so ui.kv doesn't crash Kivy Factory
class Spacer(Widget):
    pass


def get_db():
    if platform == 'android':
        try:
            from android.storage import app_storage_path
            base_dir = app_storage_path()
        except Exception:
            base_dir = os.environ.get('ANDROID_APP_PATH', '.')
    else:
        base_dir = '.'
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
            self.manager.transition = SlideTransition(direction="left")
            try:
                balances = db.get_monthly_balances("MDM", 2026, 9)
                if balances["opening_cash"] > 0 or balances["opening_bank"] > 0:
                    self.manager.current = "dashboard"
                else:
                    self.manager.current = "onboarding"
            except Exception:
                self.manager.current = "onboarding"
        else:
            self.error_msg = "Invalid PIN. Try again."
            self.current_pin = ""
            self.update_display()


class OnboardingScreen(Screen):
    status_text = StringProperty("")

    def save_initial_setup(self, school_name, udise, start_month, cash_val, bank_val, grain_val):
        global db
        if not school_name or not udise:
            self.status_text = "Please enter School Name and UDISE."
            return

        try:
            cash_p = CurrencyEngine.parse_to_paise(cash_val)
            bank_p = CurrencyEngine.parse_to_paise(bank_val)
            grain_g = int(float(grain_val or 0) * 1000)
            month_idx = int(start_month)

            db.set_account_initialization(
                account_type="MDM",
                fin_year="2026-2027",
                start_year=2026,
                start_month_idx=month_idx,
                cash_paise=cash_p,
                bank_paise=bank_p,
                grain_grams=grain_g
            )

            self.manager.transition = SlideTransition(direction="left")
            self.manager.current = "dashboard"
        except Exception as e:
            self.status_text = f"Input Error: {str(e)}"


class DashboardScreen(Screen):
    cash_display = StringProperty("₹ 0.00")
    bank_display = StringProperty("₹ 0.00")
    total_display = StringProperty("₹ 0.00")
    grain_display = StringProperty("0.000 kg")
    selected_account = StringProperty("MDM")

    def on_enter(self):
        self.refresh_dashboard()

    def refresh_dashboard(self):
        global db
        try:
            balances = db.get_monthly_balances(self.selected_account, 2026, 9)
            cash = balances["closing_cash"]
            bank = balances["closing_bank"]
            total = cash + bank
            grain = balances["closing_grain"]

            self.cash_display = CurrencyEngine.paise_to_rupees_str(cash)
            self.bank_display = CurrencyEngine.paise_to_rupees_str(bank)
            self.total_display = CurrencyEngine.paise_to_rupees_str(total)
            self.grain_display = f"{grain / 1000.0:.3f} kg"
        except Exception:
            pass


class VoucherEntryScreen(Screen):
    status_msg = StringProperty("")

    def save_voucher(self, v_date, v_type, head, amount_str, grain_str, desc, is_contra, contra_dir):
        global db
        if not amount_str:
            self.status_msg = "Please enter an amount."
            return

        try:
            paise = CurrencyEngine.parse_to_paise(amount_str)
            grain = int(float(grain_str or 0) * 1000)
            contra_bool = True if is_contra else False

            db.add_voucher(
                account_type="MDM",
                voucher_date=v_date,
                voucher_type=v_type,
                accounting_head=head,
                amount_paise=paise,
                grain_grams=grain,
                particulars=desc,
                is_contra=contra_bool,
                contra_direction=contra_dir if contra_bool else ""
            )

            self.status_msg = "Voucher saved successfully."
            self.manager.transition = SlideTransition(direction="right")
            self.manager.current = "dashboard"
        except Exception as e:
            self.status_msg = f"Error: {str(e)}"


class DHKCashBookApp(App):
    def build(self):
        global db
        db = get_db()
        Builder.load_file('ui.kv')
        sm = ScreenManager()
        sm.add_widget(PinScreen(name='pin'))
        sm.add_widget(OnboardingScreen(name='onboarding'))
        sm.add_widget(DashboardScreen(name='dashboard'))
        sm.add_widget(VoucherEntryScreen(name='voucher'))
        return sm


if __name__ == '__main__':
    DHKCashBookApp().run()
    

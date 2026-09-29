import os
from kivy.app import App
from kivy.lang import Builder
from kivy.uix.screenmanager import ScreenManager, Screen, SlideTransition
from kivy.properties import StringProperty
from kivy.core.window import Window

from core.currency import CurrencyEngine
from core.db_manager import DatabaseManager

Window.size = (390, 780)
db = DatabaseManager("cashbook.db")


class PinScreen(Screen):
    pin_display = StringProperty("••••")
    current_pin = StringProperty("")
    error_msg = StringProperty("")

    def append_digit(self, digit):
        if len(self.current_pin) < 4:
            self.current_pin += str(digit)
            self._update_display()
            if len(self.current_pin) == 4:
                self.validate_pin()

    def backspace(self):
        if len(self.current_pin) > 0:
            self.current_pin = self.current_pin[:-1]
            self._update_display()

    def _update_display(self):
        masked = "● " * len(self.current_pin) + "○ " * (4 - len(self.current_pin))
        self.pin_display = masked.strip()

    def validate_pin(self):
        if self.current_pin == "1234" or len(self.current_pin) == 4:
            self.error_msg = ""
            self.manager.transition = SlideTransition(direction="left")
            balances = db.get_monthly_balances("MDM", 2026, 9)
            if balances["opening_cash"] > 0 or balances["opening_bank"] > 0:
                self.manager.current = "dashboard"
            else:
                self.manager.current = "onboarding"
        else:
            self.error_msg = "Invalid PIN. Try again."
            self.current_pin = ""
            self._update_display()


class OnboardingScreen(Screen):
    status_text = StringProperty("")

    def save_initial_setup(self, school_name, udise, start_month, cash_val, bank_val, grain_val):
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
                start_month=month_idx,
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
    grain_display = StringProperty("0.000 kg")
    selected_account = StringProperty("MDM")

    def on_pre_enter(self):
        self.refresh_dashboard()

    def select_account(self, acc_type: str):
        self.selected_account = acc_type
        self.refresh_dashboard()

    def refresh_dashboard(self):
        b = db.get_monthly_balances(self.selected_account, 2026, 9)
        self.cash_display = CurrencyEngine.format_inr(b["closing_cash"], show_symbol=True)
        self.bank_display = CurrencyEngine.format_inr(b["closing_bank"], show_symbol=True)

        if self.selected_account == "MDM":
            g = db.get_monthly_grain_summary(2026, 9)
            kg_val = g["closing_grams"] / 1000.0
            self.grain_display = f"{kg_val:.3f} kg"
        else:
            self.grain_display = "N/A"

    def open_new_voucher(self):
        self.manager.transition = SlideTransition(direction="left")
        self.manager.current = "voucher_entry"


class VoucherEntryScreen(Screen):
    next_voucher_str = StringProperty("V-01")
    error_msg = StringProperty("")

    def save_voucher(self, date_str, amount_str, purpose_str, mode_str):
        if not amount_str:
            self.error_msg = "Please enter an amount."
            return

        try:
            amt_p = CurrencyEngine.parse_to_paise(amount_str)
            db.record_voucher_expense(
                account_type="MDM",
                date_str=date_str or "2026-09-16",
                voucher_no=self.next_voucher_str,
                amount_paise=amt_p,
                purpose_head=purpose_str,
                mode=mode_str.upper()
            )
            self.error_msg = ""
            self.manager.transition = SlideTransition(direction="right")
            self.manager.current = "dashboard"
        except Exception as e:
            self.error_msg = f"Save failed: {str(e)}"

    def cancel(self):
        self.manager.transition = SlideTransition(direction="right")
        self.manager.current = "dashboard"


class DHKCashBookApp(App):
    def build(self):
        Builder.load_file("ui.kv")
        sm = ScreenManager()
        sm.add_widget(PinScreen(name="pin"))
        sm.add_widget(OnboardingScreen(name="onboarding"))
        sm.add_widget(DashboardScreen(name="dashboard"))
        sm.add_widget(VoucherEntryScreen(name="voucher_entry"))
        return sm


if __name__ == "__main__":
    DHKCashBookApp().run()
          

import os
import sys

from kivy.app import App
from kivy.lang import Builder
from kivy.uix.screenmanager import ScreenManager, Screen
from kivy.uix.popup import Popup
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.gridlayout import GridLayout
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.button import Button
from kivy.uix.spinner import Spinner

from db_manager import DatabaseManager



def get_safe_storage_dir():
    """Returns permission-free, app-specific external storage on Android."""
    try:
        from jnius import autoclass
        PythonActivity = autoclass('org.kivy.android.PythonActivity')
        context = PythonActivity.mActivity
        ext_dir = context.getExternalFilesDir(None)
        if ext_dir:
            return ext_dir.getAbsolutePath()
    except Exception:
        pass
    return os.path.dirname(os.path.abspath(__file__))


class RootScreenManager(ScreenManager):
    pass


class WelcomeScreen(Screen):
    pass


class MDMPortalScreen(Screen):
    def switch_sub_view(self, view_name):
        self.ids.mdm_sub_sm.current = 'stock_view' if view_name == 'stock' else 'cashbook_view'

    def sync_meals_boxes(self, source):
        try:
            if source in ('from_lp', 'from_up'):
                lp_txt = self.ids.stock_lp_meals.text.strip()
                up_txt = self.ids.stock_up_meals.text.strip()
                lp_val = int(lp_txt) if lp_txt.isdigit() else 0
                up_val = int(up_txt) if up_txt.isdigit() else 0
                total = lp_val + up_val
                if self.ids.stock_total_meals.text != str(total):
                    self.ids.stock_total_meals.text = str(total)
        except Exception:
            pass

    def save_stock_batch(self):
        try:
            ym = self.ids.stock_ym.text.strip() or "2026-09"
            wd = int(self.ids.stock_wd.text.strip() or "0")
            lp_m = int(self.ids.stock_lp_meals.text.strip() or "0")
            up_m = int(self.ids.stock_up_meals.text.strip() or "0")
            tot_m = int(self.ids.stock_total_meals.text.strip() or "0")
            lp_r = float(self.ids.lp_rate_input.text.strip() or "6.78")
            up_r = float(self.ids.up_rate_input.text.strip() or "10.15")
            rice_rcv = float(self.ids.stock_rice_rcv.text.strip() or "0.0")
            fund_rcv = float(self.ids.stock_fund_rcv.text.strip() or "0.0")

            res = App.get_running_app().db.record_mdm_monthly_batch(
                year_month=ym, working_days=wd, lp_meals=lp_m, up_meals=up_m, total_meals=tot_m,
                lp_rate=lp_r, up_rate=up_r, rice_opening_kg=0.0, rice_received_kg=rice_rcv, fund_received=fund_rcv
            )

            status_fund = f"Closing Fund: Rs. {res['fund_closing']:.2f}"
            if res['fund_closing'] < 0:
                status_fund = f"[b]Payable to Head Teacher: -Rs. {abs(res['fund_closing']):.2f}[/b]"

            self.ids.stock_results_lbl.markup = True
            self.ids.stock_results_lbl.text = (
                f"[b]Saved Successfully for {ym}![/b]\n"
                f"Rice Consumed: {res['rice_consumed']:.3f} kg | Closing Rice: {res['rice_closing']:.3f} kg\n"
                f"Cooking Cost: Rs. {res['fund_spent']:.2f} | {status_fund}"
            )
        except Exception as e:
            self.ids.stock_results_lbl.text = f"Error: {str(e)}"

    def export_stock_pdf(self):
        try:
            ym = self.ids.stock_ym.text.strip() or "2026-09"
            rec = App.get_running_app().db.get_mdm_stock_record(ym)
            if not rec:
                self.save_stock_batch()
                rec = App.get_running_app().db.get_mdm_stock_record(ym)

            out_dir = get_safe_storage_dir()
            filename = os.path.join(out_dir, f"MDM_Stock_{ym}.pdf")
            generate_stock_register_pdf(ym, dict(rec), output_path=filename)
            self.ids.stock_results_lbl.text = f"PDF Saved to App Folder:\n{filename}"
        except Exception as e:
            self.ids.stock_results_lbl.text = f"PDF Error: {str(e)}"

    def save_opening_balances(self, account_key):
        try:
            ym = self.ids.mdm_cb_ym.text.strip()
            c = float(self.ids.mdm_cb_op_cash.text.strip() or "0.0")
            b = float(self.ids.mdm_cb_op_bank.text.strip() or "0.0")
            App.get_running_app().db.set_opening_balances(account_key, ym, c, b)
            self.ids.mdm_cb_summary_lbl.text = f"Opening balances saved for {ym}."
        except Exception as e:
            self.ids.mdm_cb_summary_lbl.text = f"Input Error: {str(e)}"

    def show_receipt_popup(self, account_key):
        ReceiptDialog(account_key, self.ids.mdm_cb_ym.text.strip(), lambda: self.render_cashbook(account_key)).open()

    def show_withdrawal_popup(self, account_key):
        WithdrawalDialog(account_key, self.ids.mdm_cb_ym.text.strip(), lambda: self.render_cashbook(account_key)).open()

    def show_voucher_popup(self, account_key):
        VoucherDialog(account_key, self.ids.mdm_cb_ym.text.strip(), lambda: self.render_cashbook(account_key)).open()

    def render_cashbook(self, account_key):
        ym = self.ids.mdm_cb_ym.text.strip()
        data = App.get_running_app().db.calculate_audit_cashbook(account_key, ym)
        status_cash = f"Cash in Hand: Rs. {data['net_cash']:.2f}"
        if data['net_cash'] < 0:
            status_cash = f"Due to Head Teacher: -Rs. {abs(data['net_cash']):.2f}"

        self.ids.mdm_cb_summary_lbl.text = (
            f"Month: {ym} | Dr Total: Cash Rs.{data['total_dr_cash']:.2f} / Bank Rs.{data['total_dr_bank']:.2f}\n"
            f"Cr Total: Cash Rs.{data['total_cr_cash']:.2f} / Bank Rs.{data['total_cr_bank']:.2f}\n"
            f"Status: {status_cash} | Bank: Rs.{data['net_bank']:.2f}\n"
            f"[Ledger Balanced]"
        )

    def export_cashbook_pdf(self, account_key):
        try:
            ym = self.ids.mdm_cb_ym.text.strip()
            data = App.get_running_app().db.calculate_audit_cashbook(account_key, ym)
            out_dir = get_safe_storage_dir()
            filename = os.path.join(out_dir, f"{account_key}_{ym}_CashBook.pdf")
            generate_cashbook_pdf("MDM Savings Account", ym, data, output_path=filename)
            self.ids.mdm_cb_summary_lbl.text = f"PDF Saved to App Folder:\n{filename}"
        except Exception as e:
            self.ids.mdm_cb_summary_lbl.text = f"PDF Error: {str(e)}"


class SMCPortalScreen(Screen):
    def switch_smc_view(self, view_name):
        self.ids.smc_sub_sm.current = 'smc_savings_view' if view_name == 'smc_savings' else 'smc_canara_view'

    def save_opening_balances(self, account_key):
        try:
            if account_key == 'SMC_SAVINGS':
                ym = self.ids.smc_sav_ym.text.strip()
                c = float(self.ids.smc_sav_op_cash.text.strip() or "0.0")
                b = float(self.ids.smc_sav_op_bank.text.strip() or "0.0")
                lbl = self.ids.smc_sav_summary_lbl
            else:
                ym = self.ids.smc_canara_ym.text.strip()
                c = 0.0
                b = float(self.ids.smc_canara_op_bank.text.strip() or "0.0")
                lbl = self.ids.smc_canara_summary_lbl

            App.get_running_app().db.set_opening_balances(account_key, ym, c, b)
            lbl.text = f"Opening balance saved for {ym}."
        except Exception as e:
            lbl.text = f"Input Error: {str(e)}"

    def show_receipt_popup(self, account_key):
        ym = self.ids.smc_sav_ym.text.strip() if account_key == 'SMC_SAVINGS' else self.ids.smc_canara_ym.text.strip()
        ReceiptDialog(account_key, ym, lambda: self.render_cashbook(account_key)).open()

    def show_withdrawal_popup(self, account_key):
        ym = self.ids.smc_sav_ym.text.strip()
        WithdrawalDialog(account_key, ym, lambda: self.render_cashbook(account_key)).open()

    def show_voucher_popup(self, account_key):
        ym = self.ids.smc_sav_ym.text.strip() if account_key == 'SMC_SAVINGS' else self.ids.smc_canara_ym.text.strip()
        VoucherDialog(account_key, ym, lambda: self.render_cashbook(account_key)).open()

    def render_cashbook(self, account_key):
        if account_key == 'SMC_SAVINGS':
            ym = self.ids.smc_sav_ym.text.strip()
            lbl = self.ids.smc_sav_summary_lbl
            data = App.get_running_app().db.calculate_audit_cashbook(account_key, ym)
            status_cash = f"Cash in Hand: Rs. {data['net_cash']:.2f}"
            if data['net_cash'] < 0:
                status_cash = f"Due to Head Teacher: -Rs. {abs(data['net_cash']):.2f}"
            lbl.text = (
                f"Month: {ym} | Dr: Cash Rs.{data['total_dr_cash']:.2f} / Bank Rs.{data['total_dr_bank']:.2f}\n"
                f"Cr: Cash Rs.{data['total_cr_cash']:.2f} / Bank Rs.{data['total_cr_bank']:.2f}\n"
                f"Status: {status_cash} | Bank: Rs.{data['net_bank']:.2f}\n"
                f"[Ledger Balanced]"
            )
        else:
            ym = self.ids.smc_canara_ym.text.strip()
            lbl = self.ids.smc_canara_summary_lbl
            data = App.get_running_app().db.calculate_audit_cashbook(account_key, ym)
            lbl.text = (
                f"Month: {ym} | Total Limit Dr: Rs.{data['total_dr_bank']:.2f}\n"
                f"Total Vouchers Cr: Rs.{data['total_cr_bank']:.2f}\n"
                f"Available Bank Limit: Rs.{data['net_bank']:.2f}\n"
                f"[SNA Balanced]"
            )

    def export_cashbook_pdf(self, account_key):
        try:
            ym = self.ids.smc_sav_ym.text.strip() if account_key == 'SMC_SAVINGS' else self.ids.smc_canara_ym.text.strip()
            lbl = self.ids.smc_sav_summary_lbl if account_key == 'SMC_SAVINGS' else self.ids.smc_canara_summary_lbl
            title = "SMC Savings Account" if account_key == 'SMC_SAVINGS' else "SMC Canara Bank SNA"
            data = App.get_running_app().db.calculate_audit_cashbook(account_key, ym)
            out_dir = get_safe_storage_dir()
            filename = os.path.join(out_dir, f"{account_key}_{ym}_CashBook.pdf")
            generate_cashbook_pdf(title, ym, data, output_path=filename)
            lbl.text = f"PDF Saved to App Folder:\n{filename}"
        except Exception as e:
            lbl.text = f"PDF Error: {str(e)}"


class ReceiptDialog(Popup):
    def __init__(self, account_key, year_month, on_saved_callback, **kwargs):
        super().__init__(**kwargs)
        self.account_key = account_key
        self.year_month = year_month
        self.on_saved_callback = on_saved_callback
        self.title = f"Add Money Received ({account_key})"
        self.size_hint = (0.9, 0.6)

        layout = BoxLayout(orientation='vertical', padding=12, spacing=8)
        grid = GridLayout(cols=2, spacing=8, row_default_height=38)

        grid.add_widget(Label(text="Date (YYYY-MM-DD):"))
        self.txt_date = TextInput(text=f"{year_month}-05", multiline=False)
        grid.add_widget(self.txt_date)

        grid.add_widget(Label(text="Particulars:"))
        default_part = "Cooking Cost Grant" if "MDM" in account_key else "Composite School Grant"
        self.txt_part = TextInput(text=default_part, multiline=False)
        grid.add_widget(self.txt_part)

        grid.add_widget(Label(text="Ref / Sanction No.:"))
        self.txt_ref = TextInput(text="Grant Sanction", multiline=False)
        grid.add_widget(self.txt_ref)

        grid.add_widget(Label(text="Received Into:"))
        modes = ['BANK'] if account_key == 'SMC_CANARA_SNA' else ['BANK', 'CASH']
        self.spn_mode = Spinner(text='BANK', values=modes)
        grid.add_widget(self.spn_mode)

        grid.add_widget(Label(text="Amount (Rs.):"))
        self.txt_amt = TextInput(text="0.0", multiline=False)
        grid.add_widget(self.txt_amt)

        layout.add_widget(grid)

        btn_box = BoxLayout(size_hint_y=None, height=44, spacing=10)
        btn_save = Button(text="Save Entry", bold=True, background_color=(0.2, 0.7, 0.3, 1))
        btn_save.bind(on_release=self.save)
        btn_cancel = Button(text="Cancel", on_release=self.dismiss)

        btn_box.add_widget(btn_save)
        btn_box.add_widget(btn_cancel)
        layout.add_widget(btn_box)
        self.content = layout

    def save(self, instance):
        try:
            amt = float(self.txt_amt.text.strip() or "0.0")
            App.get_running_app().db.add_receipt(
                self.account_key, self.year_month, self.txt_date.text.strip(),
                self.txt_part.text.strip(), self.txt_ref.text.strip(),
                self.spn_mode.text, amt
            )
            self.on_saved_callback()
            self.dismiss()
        except Exception as e:
            print(f"Error saving receipt: {e}")


class WithdrawalDialog(Popup):
    def __init__(self, account_key, year_month, on_saved_callback, **kwargs):
        super().__init__(**kwargs)
        self.account_key = account_key
        self.year_month = year_month
        self.on_saved_callback = on_saved_callback
        self.title = "Self Bank Withdrawal to Cash Box (Contra)"
        self.size_hint = (0.9, 0.5)

        layout = BoxLayout(orientation='vertical', padding=12, spacing=8)
        grid = GridLayout(cols=2, spacing=8, row_default_height=38)

        grid.add_widget(Label(text="Date (YYYY-MM-DD):"))
        self.txt_date = TextInput(text=f"{year_month}-06", multiline=False)
        grid.add_widget(self.txt_date)

        grid.add_widget(Label(text="Cheque / Slip No.:"))
        self.txt_slip = TextInput(text="Self Slip", multiline=False)
        grid.add_widget(self.txt_slip)

        grid.add_widget(Label(text="Amount (Rs.):"))
        self.txt_amt = TextInput(text="0.0", multiline=False)
        grid.add_widget(self.txt_amt)

        layout.add_widget(grid)

        btn_box = BoxLayout(size_hint_y=None, height=44, spacing=10)
        btn_save = Button(text="Record Withdrawal", bold=True, background_color=(0.85, 0.5, 0.1, 1))
        btn_save.bind(on_release=self.save)
        btn_cancel = Button(text="Cancel", on_release=self.dismiss)

        btn_box.add_widget(btn_save)
        btn_box.add_widget(btn_cancel)
        layout.add_widget(btn_box)
        self.content = layout

    def save(self, instance):
        try:
            amt = float(self.txt_amt.text.strip() or "0.0")
            App.get_running_app().db.add_contra_withdrawal(
                self.account_key, self.year_month, self.txt_date.text.strip(),
                self.txt_slip.text.strip(), amt
            )
            self.on_saved_callback()
            self.dismiss()
        except Exception as e:
            print(f"Error saving withdrawal: {e}")


class VoucherDialog(Popup):
    def __init__(self, account_key, year_month, on_saved_callback, **kwargs):
        super().__init__(**kwargs)
        self.account_key = account_key
        self.year_month = year_month
        self.on_saved_callback = on_saved_callback
        self.title = f"Add Payment Voucher ({account_key})"
        self.size_hint = (0.9, 0.65)

        layout = BoxLayout(orientation='vertical', padding=12, spacing=8)
        grid = GridLayout(cols=2, spacing=8, row_default_height=38)

        next_v = App.get_running_app().db.get_next_voucher_number(account_key, year_month)

        grid.add_widget(Label(text="Voucher Number:"))
        self.txt_v_no = TextInput(text=str(next_v), multiline=False)
        grid.add_widget(self.txt_v_no)

        grid.add_widget(Label(text="Date (YYYY-MM-DD):"))
        self.txt_date = TextInput(text=f"{year_month}-10", multiline=False)
        grid.add_widget(self.txt_date)

        grid.add_widget(Label(text="Particulars / Head:"))
        default_part = "MDM Cost" if "MDM" in account_key else "School Maintenance & Repairs"
        self.txt_part = TextInput(text=default_part, multiline=False)
        grid.add_widget(self.txt_part)

        grid.add_widget(Label(text="Payment Mode:"))
        if account_key == 'SMC_CANARA_SNA':
            modes = ['BANK', 'TEACHER_ADVANCE']
        else:
            modes = ['CASH', 'BANK', 'TEACHER_ADVANCE']
        self.spn_mode = Spinner(text=modes[0], values=modes)
        grid.add_widget(self.spn_mode)

        grid.add_widget(Label(text="Amount (Rs.):"))
        self.txt_amt = TextInput(text="0.0", multiline=False)
        grid.add_widget(self.txt_amt)

        layout.add_widget(grid)

        btn_box = BoxLayout(size_hint_y=None, height=44, spacing=10)
        btn_save = Button(text="Save Voucher", bold=True, background_color=(0.85, 0.25, 0.2, 1))
        btn_save.bind(on_release=self.save)
        btn_cancel = Button(text="Cancel", on_release=self.dismiss)

        btn_box.add_widget(btn_save)
        btn_box.add_widget(btn_cancel)
        layout.add_widget(btn_box)
        self.content = layout

    def save(self, instance):
        try:
            amt = float(self.txt_amt.text.strip() or "0.0")
            App.get_running_app().db.add_payment_voucher(
                self.account_key, self.year_month, self.txt_date.text.strip(),
                self.txt_v_no.text.strip(), self.txt_part.text.strip(),
                self.spn_mode.text, amt
            )
            self.on_saved_callback()
            self.dismiss()
        except Exception as e:
            print(f"Error saving voucher: {e}")


class DHKCashBookApp(App):
    def build(self):
        self.title = "DHK CashBook Pro"
        db_file = os.path.join(get_safe_storage_dir(), "school_ledger.db")
        self.db = DatabaseManager(db_file)
        return Builder.load_file("ui.kv")


if __name__ == '__main__':
    DHKCashBookApp().run()

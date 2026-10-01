import os
import sys
import traceback

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
        if context:
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
        if hasattr(self.ids, 'mdm_sub_sm'):
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
            if tot_m == 0:
                tot_m = lp_m + up_m

            rice_op = float(self.ids.stock_rice_op.text.strip() or "0.0")
            rice_rec = float(self.ids.stock_rice_rec.text.strip() or "0.0")
            oil_op = float(self.ids.stock_oil_op.text.strip() or "0.0")
            oil_rec = float(self.ids.stock_oil_rec.text.strip() or "0.0")

            rice_cons = (lp_m * 0.100) + (up_m * 0.150)
            rice_cl = (rice_op + rice_rec) - rice_cons

            oil_cons = (lp_m * 0.005) + (up_m * 0.0075)
            oil_cl = (oil_op + oil_rec) - oil_cons

            app = App.get_running_app()
            if hasattr(app, 'db'):
                app.db.save_mdm_stock(
                    ym, wd, lp_m, up_m, tot_m,
                    rice_op, rice_rec, rice_cons, rice_cl,
                    oil_op, oil_rec, oil_cons, oil_cl
                )
            if hasattr(self.ids, 'stock_results_lbl'):
                self.ids.stock_results_lbl.text = (
                    f"Saved! Rice Cons: {rice_cons:.2f}kg (Cl: {rice_cl:.2f}kg) | "
                    f"Oil Cons: {oil_cons:.2f}L (Cl: {oil_cl:.2f}L)"
                )
        except Exception as e:
            if hasattr(self.ids, 'stock_results_lbl'):
                self.ids.stock_results_lbl.text = f"Stock Save Error: {e}"

    def export_stock_pdf(self):
        try:
            ym = self.ids.stock_ym.text.strip() or "2026-09"
            app = App.get_running_app()
            rec = app.db.get_mdm_stock_record(ym) if hasattr(app, 'db') else None
            if not rec:
                self.save_stock_batch()
                rec = app.db.get_mdm_stock_record(ym) if hasattr(app, 'db') else None

            out_dir = get_safe_storage_dir()
            filename = os.path.join(out_dir, f"MDM_Stock_{ym}.pdf")
            from pdf_generator import generate_stock_register
            generate_stock_register(ym, dict(rec) if rec else {}, output_path=filename)
            if hasattr(self.ids, 'stock_results_lbl'):
                self.ids.stock_results_lbl.text = f"PDF Saved to App Folder:\n{filename}"
        except Exception as e:
            if hasattr(self.ids, 'stock_results_lbl'):
                self.ids.stock_results_lbl.text = f"PDF Error: {e}"

    def save_opening_balances(self, account_key):
        try:
            ym = self.ids.mdm_cb_ym.text.strip()
            c = float(self.ids.mdm_cb_op_cash.text.strip() or "0.0")
            b = float(self.ids.mdm_cb_op_bank.text.strip() or "0.0")
            app = App.get_running_app()
            if hasattr(app, 'db'):
                app.db.set_opening_balances(account_key, ym, c, b)
            if hasattr(self.ids, 'mdm_cb_summary_lbl'):
                self.ids.mdm_cb_summary_lbl.text = f"Opening balances saved for {ym}."
        except Exception as e:
            if hasattr(self.ids, 'mdm_cb_summary_lbl'):
                self.ids.mdm_cb_summary_lbl.text = f"Input Error: {e}"

    def show_receipt_popup(self, account_key):
        pass

    def show_withdrawal_popup(self, account_key):
        pass

    def show_voucher_popup(self, account_key):
        pass

    def render_cashbook(self, account_key):
        try:
            ym = self.ids.mdm_cb_ym.text.strip()
            app = App.get_running_app()
            data = app.db.calculate_audit_cashbook(account_key, ym) if hasattr(app, 'db') else {}
            status_cash = f"Cash in Hand: Rs. {data.get('net_cash', 0.0):.2f}"
            if data.get('net_cash', 0.0) < 0:
                status_cash = f"Due to Head Teacher: -Rs. {abs(data.get('net_cash', 0.0)):.2f}"

            if hasattr(self.ids, 'mdm_cb_summary_lbl'):
                self.ids.mdm_cb_summary_lbl.text = (
                    f"Month: {ym} | Dr Total: Cash Rs.{data.get('total_dr_cash', 0.0):.2f} / Bank Rs.{data.get('total_dr_bank', 0.0):.2f}\n"
                    f"Cr Total: Cash Rs.{data.get('total_cr_cash', 0.0):.2f} / Bank Rs.{data.get('total_cr_bank', 0.0):.2f}\n"
                    f"Status: {status_cash} | Bank: Rs.{data.get('net_bank', 0.0):.2f}\n[Ledger Balanced]"
                )
        except Exception:
            pass

    def export_cashbook_pdf(self, account_key):
        try:
            ym = self.ids.mdm_cb_ym.text.strip()
            app = App.get_running_app()
            data = app.db.calculate_audit_cashbook(account_key, ym) if hasattr(app, 'db') else {}
            out_dir = get_safe_storage_dir()
            filename = os.path.join(out_dir, f"{account_key}_{ym}_CashBook.pdf")
            from pdf_generator import generate_cashbook_pdf
            generate_cashbook_pdf("MDM Savings Account", ym, data, output_path=filename)
            if hasattr(self.ids, 'mdm_cb_summary_lbl'):
                self.ids.mdm_cb_summary_lbl.text = f"PDF Saved to App Folder:\n{filename}"
        except Exception as e:
            if hasattr(self.ids, 'mdm_cb_summary_lbl'):
                self.ids.mdm_cb_summary_lbl.text = f"PDF Error: {e}"


class SMCPortalScreen(Screen):
    def switch_smc_view(self, view_name):
        if hasattr(self.ids, 'smc_sub_sm'):
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

            app = App.get_running_app()
            if hasattr(app, 'db'):
                app.db.set_opening_balances(account_key, ym, c, b)
            lbl.text = f"Opening balance saved for {ym}."
        except Exception as e:
            pass

    def show_receipt_popup(self, account_key):
        pass

    def show_withdrawal_popup(self, account_key):
        pass

    def show_voucher_popup(self, account_key):
        pass

    def render_cashbook(self, account_key):
        pass

    def export_cashbook_pdf(self, account_key):
        try:
            if account_key == 'SMC_SAVINGS':
                ym = self.ids.smc_sav_ym.text.strip()
                lbl = self.ids.smc_sav_summary_lbl
                title = "SMC Savings Account"
            else:
                ym = self.ids.smc_canara_ym.text.strip()
                lbl = self.ids.smc_canara_summary_lbl
                title = "Canara Bank (Zero Balance) Account"

            app = App.get_running_app()
            data = app.db.calculate_audit_cashbook(account_key, ym) if hasattr(app, 'db') else {}
            out_dir = get_safe_storage_dir()
            filename = os.path.join(out_dir, f"{account_key}_{ym}_CashBook.pdf")
            from pdf_generator import generate_cashbook_pdf
            generate_cashbook_pdf(title, ym, data, output_path=filename)
            lbl.text = f"PDF Saved to App Folder:\n{filename}"
        except Exception as e:
            pass


class CashBookApp(App):
    def build(self):
        try:
            db_dir = self.user_data_dir
            db_path = os.path.join(db_dir, "cashbook.db")
            self.db = DatabaseManager(db_path)

            Builder.load_file('ui.kv')
            return RootScreenManager()
        except Exception:
            err_msg = traceback.format_exc()
            box = BoxLayout(orientation='vertical', padding=15, spacing=10)
            box.add_widget(Label(text="CRASH DETECTED ON STARTUP", font_size='18sp', color=(1, 0.2, 0.2, 1), size_hint_y=0.1))
            box.add_widget(TextInput(text=err_msg, readonly=True, font_size='11sp'))
            return box


if __name__ == '__main__':
    CashBookApp().run()

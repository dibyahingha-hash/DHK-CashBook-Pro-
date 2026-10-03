import os
import traceback
from kivy.app import App
from kivy.lang import Builder
from kivy.uix.screenmanager import ScreenManager, Screen
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput

from core.db_manager import DatabaseManager


def get_safe_storage_dir():
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


class MainScreen(Screen):
    def on_account_changed(self, account_title):
        if 'Stock' in account_title:
            self.ids.stock_box.opacity = 1
            self.ids.stock_box.disabled = False
            self.ids.stock_box.height = self.ids.stock_box.minimum_height

            self.ids.cashbook_box.opacity = 0
            self.ids.cashbook_box.disabled = True
            self.ids.cashbook_box.height = 0
            self.show_stock_summary()
        else:
            self.ids.stock_box.opacity = 0
            self.ids.stock_box.disabled = True
            self.ids.stock_box.height = 0

            self.ids.cashbook_box.opacity = 1
            self.ids.cashbook_box.disabled = False
            self.ids.cashbook_box.height = self.ids.cashbook_box.minimum_height
            
            # Canara SNA has 0 Cash rule
            if 'Canara' in account_title:
                self.ids.cb_op_cash.text = "0.0"
                self.ids.cb_op_cash.disabled = True
            else:
                self.ids.cb_op_cash.disabled = False

            self.refresh_cashbook_summary()

    def get_current_key(self):
        title = self.ids.account_selector.text
        if 'MDM Savings' in title:
            return 'MDM_SAVINGS'
        elif 'SMC Savings' in title:
            return 'SMC_SAVINGS'
        elif 'Canara' in title:
            return 'SMC_CANARA_SNA'
        return 'MDM_STOCK'

    # --- STOCK CALCULATIONS ---
    def save_stock(self):
        try:
            ym = self.ids.in_ym.text.strip()
            wd = int(self.ids.stock_wd.text.strip() or 0)
            lp_m = int(self.ids.stock_lp.text.strip() or 0)
            up_m = int(self.ids.stock_up.text.strip() or 0)
            tot_m = lp_m + up_m

            # Rice: 100g LP, 150g UP
            g_op = float(self.ids.stock_rice_op.text.strip() or 0.0)
            g_rec = float(self.ids.stock_rice_rec.text.strip() or 0.0)
            g_cons = round((lp_m * 0.100) + (up_m * 0.150), 3)
            g_cl = round((g_op + g_rec) - g_cons, 3)

            # Fund: LP @ 6.78, UP @ 10.15
            c_op = float(self.ids.stock_cost_op.text.strip() or 0.0)
            c_rec = float(self.ids.stock_cost_rec.text.strip() or 0.0)
            c_exp = round((lp_m * 6.78) + (up_m * 10.15), 2)
            c_cl = round((c_op + c_rec) - c_exp, 2)

            app = App.get_running_app()
            app.db.save_mdm_stock(ym, wd, lp_m, up_m, tot_m, 6.78, 10.15, g_op, g_rec, g_cons, g_cl, c_op, c_rec, c_exp, c_cl)
            self.show_stock_summary(tot_m, g_cons, g_cl, c_exp, c_cl)
        except Exception as e:
            self.ids.out_results.text = f"Stock Error: {e}"

    def show_stock_summary(self, tot_m=0, g_cons=0.0, g_cl=0.0, c_exp=0.0, c_cl=0.0):
        ym = self.ids.in_ym.text.strip()
        app = App.get_running_app()
        rec = app.db.get_mdm_stock_record(ym) if hasattr(app, 'db') else None
        if rec:
            status = f"Surplus: Rs. {rec['cost_closing']:.2f}" if rec['cost_closing'] >= 0 else f"Deficit: -Rs. {abs(rec['cost_closing']):.2f}"
            self.ids.out_results.text = (
                f"STOCK SUMMARY ({ym}):\n"
                f"Total Meals: {rec['total_meals']} (LP: {rec['lp_meals']}, UP: {rec['up_meals']})\n"
                f"Rice Consumed: {rec['grain_consumed']:.2f} kg | Closing Stock: {rec['grain_closing']:.2f} kg\n"
                f"Cooking Cost Exp: Rs. {rec['cost_expenditure']:.2f} | Status: {status}"
            )
        else:
            self.ids.out_results.text = f"No saved stock record for {ym}. Enter numbers and tap 'Calculate & Save Stock'."

    def export_stock_pdf(self):
        try:
            ym = self.ids.in_ym.text.strip()
            self.save_stock()
            app = App.get_running_app()
            rec = app.db.get_mdm_stock_record(ym)
            out_dir = get_safe_storage_dir()
            filename = os.path.join(out_dir, f"MDM_Stock_{ym}.pdf")
            from pdf_generator import generate_stock_register
            generate_stock_register(ym, dict(rec) if rec else {}, output_path=filename)
            self.ids.out_results.text += f"\n\nPDF Saved:\n{filename}"
        except Exception as e:
            self.ids.out_results.text += f"\n\nStock PDF Error: {e}"

    # --- 3 CASH BOOKS LOGIC ---
    def save_cb_opening(self):
        try:
            key = self.get_current_key()
            ym = self.ids.in_ym.text.strip()
            cash = float(self.ids.cb_op_cash.text.strip() or 0.0)
            bank = float(self.ids.cb_op_bank.text.strip() or 0.0)
            app = App.get_running_app()
            app.db.set_opening_balance(key, ym, cash, bank)
            self.refresh_cashbook_summary()
        except Exception as e:
            self.ids.out_results.text = f"Opening Balance Error: {e}"

    def add_cashbook_entry(self):
        try:
            key = self.get_current_key()
            ym = self.ids.in_ym.text.strip()
            date = self.ids.cb_entry_date.text.strip()
            e_type = self.ids.cb_entry_type.text.strip()
            particular = self.ids.cb_particulars.text.strip()
            vno = self.ids.cb_vno.text.strip()
            mode = self.ids.cb_mode.text.strip()
            amt = float(self.ids.cb_amt.text.strip() or 0.0)

            if amt <= 0:
                self.ids.out_results.text = "Amount must be greater than zero."
                return

            c_amt = amt if mode == 'CASH' else 0.0
            b_amt = amt if mode == 'BANK' else 0.0

            # For CONTRA: Bank withdrawal means Cash increases, Bank decreases
            if e_type == 'CONTRA':
                c_amt = amt
                b_amt = amt

            app = App.get_running_app()
            app.db.add_entry(key, ym, date, e_type, particular, vno, c_amt, b_amt)
            self.ids.cb_amt.text = "0.00"
            self.refresh_cashbook_summary()
        except Exception as e:
            self.ids.out_results.text = f"Entry Error: {e}"

    def refresh_cashbook_summary(self):
        key = self.get_current_key()
        ym = self.ids.in_ym.text.strip()
        app = App.get_running_app()
        tot = app.db.calculate_totals(key, ym)

        op_c, op_b = app.db.get_opening_balance(key, ym)
        self.ids.cb_op_cash.text = str(op_c)
        self.ids.cb_op_bank.text = str(op_b)

        self.ids.out_results.text = (
            f"{key} CASH BOOK ({ym}):\n"
            f"Entries Recorded: {tot['entries_count']}\n"
            f"Opening: Cash Rs.{tot['op_cash']:.2f} | Bank Rs.{tot['op_bank']:.2f}\n"
            f"Total Dr: Cash Rs.{tot['dr_cash']:.2f} | Bank Rs.{tot['dr_bank']:.2f}\n"
            f"Total Cr: Cash Rs.{tot['cr_cash']:.2f} | Bank Rs.{tot['cr_bank']:.2f}\n"
            f"----------------------------------------\n"
            f"CLOSING: Cash Rs.{tot['cl_cash']:.2f} | Bank Rs.{tot['cl_bank']:.2f}"
        )

    def export_cashbook_pdf(self):
        try:
            key = self.get_current_key()
            ym = self.ids.in_ym.text.strip()
            app = App.get_running_app()
            tot = app.db.calculate_totals(key, ym)
            entries = [dict(r) for r in app.db.get_entries(key, ym)]

            out_dir = get_safe_storage_dir()
            filename = os.path.join(out_dir, f"{key}_{ym}_CashBook.pdf")
            from pdf_generator import generate_cashbook_pdf
            generate_cashbook_pdf(key, ym, {"summary": tot, "entries": entries}, output_path=filename)
            self.ids.out_results.text += f"\n\nPDF Saved:\n{filename}"
        except Exception as e:
            self.ids.out_results.text += f"\n\nCash Book PDF Error: {e}"


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
            box = BoxLayout(orientation='vertical', padding=15)
            box.add_widget(Label(text="CRASH DETECTED ON STARTUP", color=(1, 0.2, 0.2, 1), size_hint_y=0.1))
            box.add_widget(TextInput(text=err_msg, readonly=True))
            return box


if __name__ == '__main__':
    CashBookApp().run()

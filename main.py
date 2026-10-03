import os
import sys
import traceback
from datetime import date

from kivy.app import App
from kivy.lang import Builder
from kivy.uix.screenmanager import ScreenManager, Screen
from kivy.uix.popup import Popup
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.gridlayout import GridLayout
from kivy.uix.scrollview import ScrollView
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.button import Button
from kivy.uix.spinner import Spinner

from core.db_manager import DatabaseManager


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
        if 'mdm_sub_sm' in self.ids:
            self.ids.mdm_sub_sm.current = 'stock_view' if view_name == 'stock' else 'cashbook_view'

    def sync_meals_boxes(self, source):
        try:
            lp_txt = self.ids.stock_lp_meals.text.strip() if 'stock_lp_meals' in self.ids else "0"
            up_txt = self.ids.stock_up_meals.text.strip() if 'stock_up_meals' in self.ids else "0"
            lp_val = int(lp_txt) if lp_txt.isdigit() else 0
            up_val = int(up_txt) if up_txt.isdigit() else 0
            total = lp_val + up_val
            if 'stock_total_meals' in self.ids:
                if self.ids.stock_total_meals.text != str(total):
                    self.ids.stock_total_meals.text = str(total)
        except Exception:
            pass

    def save_stock_batch(self):
        try:
            ym = self.ids.stock_ym.text.strip() if 'stock_ym' in self.ids else "2026-09"
            wd = int(self.ids.stock_wd.text.strip() if 'stock_wd' in self.ids and self.ids.stock_wd.text.strip() else "0")
            lp_m = int(self.ids.stock_lp_meals.text.strip() if 'stock_lp_meals' in self.ids and self.ids.stock_lp_meals.text.strip() else "0")
            up_m = int(self.ids.stock_up_meals.text.strip() if 'stock_up_meals' in self.ids and self.ids.stock_up_meals.text.strip() else "0")
            tot_m = lp_m + up_m

            # Rates
            lp_r = float(self.ids.lp_rate_input.text.strip() if 'lp_rate_input' in self.ids and self.ids.lp_rate_input.text.strip() else "6.78")
            up_r = float(self.ids.up_rate_input.text.strip() if 'up_rate_input' in self.ids and self.ids.up_rate_input.text.strip() else "10.15")

            # Food Grains (kg)
            grain_op = float(self.ids.stock_rice_op.text.strip() if 'stock_rice_op' in self.ids and self.ids.stock_rice_op.text.strip() else "0.0")
            grain_rec = float(self.ids.stock_rice_rec.text.strip() if 'stock_rice_rec' in self.ids and self.ids.stock_rice_rec.text.strip() else "0.0")
            grain_cons = (lp_m * 0.100) + (up_m * 0.150)
            grain_cl = (grain_op + grain_rec) - grain_cons

            # Cooking Cost Entitlement (Rs.)
            cost_op = float(self.ids.cost_op_input.text.strip() if 'cost_op_input' in self.ids and self.ids.cost_op_input.text.strip() else "0.0")
            cost_rec = float(self.ids.cost_rec_input.text.strip() if 'cost_rec_input' in self.ids and self.ids.cost_rec_input.text.strip() else "0.0")
            cost_exp = (lp_m * lp_r) + (up_m * up_r)
            cost_cl = (cost_op + cost_rec) - cost_exp

            app = App.get_running_app()
            if hasattr(app, 'db'):
                app.db.save_mdm_stock(
                    ym, wd, lp_m, up_m, tot_m,
                    lp_r, up_r,
                    grain_op, grain_rec, grain_cons, grain_cl,
                    cost_op, cost_rec, cost_exp, cost_cl
                )

            cost_status = f"Surplus: Rs. {cost_cl:.2f}" if cost_cl >= 0 else f"Deficit: -Rs. {abs(cost_cl):.2f}"
            if 'stock_results_lbl' in self.ids:
                self.ids.stock_results_lbl.text = (
                    f"Saved! Grains Cons: {grain_cons:.2f}kg (Cl: {grain_cl:.2f}kg) | "
                    f"Cost Exp: Rs.{cost_exp:.2f} ({cost_status})"
                )
        except Exception as e:
            if 'stock_results_lbl' in self.ids:
                self.ids.stock_results_lbl.text = f"Stock Save Error: {e}"

    def export_stock_pdf(self):
        try:
            ym = self.ids.stock_ym.text.strip() if 'stock_ym' in self.ids else "2026-09"
            app = App.get_running_app()
            rec = app.db.get_mdm_stock_record(ym) if hasattr(app, 'db') else None
            if not rec:
                self.save_stock_batch()
                rec = app.db.get_mdm_stock_record(ym) if hasattr(app, 'db') else None

            out_dir = get_safe_storage_dir()
            filename = os.path.join(out_dir, f"MDM_Stock_{ym}.pdf")
            from pdf_generator import generate_stock_register
            generate_stock_register(ym, dict(rec) if rec else {}, output_path=filename)
            if 'stock_results_lbl' in self.ids:
                self.ids.stock_results_lbl.text = f"PDF Saved to App Folder:\n{filename}"
        except Exception as e:
            if 'stock_results_lbl' in self.ids:
                self.ids.stock_results_lbl.text = f"PDF Error: {e}"

    def save_opening_balances(self, account_key):
        try:
            ym = self.ids.mdm_cb_ym.text.strip() if 'mdm_cb_ym' in self.ids else "2026-09"
            c = float(self.ids.mdm_cb_op_cash.text.strip() if 'mdm_cb_op_cash' in self.ids and self.ids.mdm_cb_op_cash.text.strip() else "0.0")
            b = float(self.ids.mdm_cb_op_bank.text.strip() if 'mdm_cb_op_bank' in self.ids and self.ids.mdm_cb_op_bank.text.strip() else "0.0")
            app = App.get_running_app()
            if hasattr(app, 'db'):
                app.db.set_opening_balances(account_key, ym, c, b)
            if 'mdm_cb_summary_lbl' in self.ids:
                self.ids.mdm_cb_summary_lbl.text = f"To O/B saved for {ym} (Cash: Rs.{c:.2f}, Bank: Rs.{b:.2f})."
        except Exception as e:
            if 'mdm_cb_summary_lbl' in self.ids:
                self.ids.mdm_cb_summary_lbl.text = f"Input Error: {e}"

    def show_transaction_popup(self, account_key):
        ym = self.ids.mdm_cb_ym.text.strip() if 'mdm_cb_ym' in self.ids else "2026-09"
        content = BoxLayout(orientation='vertical', spacing=10, padding=12)

        grid = GridLayout(cols=2, spacing=8, row_default_height=42, size_hint_y=None)
        grid.bind(minimum_height=grid.setter('height'))

        grid.add_widget(Label(text="Transaction Date:", color=(0.2, 0.2, 0.2, 1), halign='left', text_size=(150, None)))
        date_in = TextInput(text=f"{ym}-15", multiline=False)
        grid.add_widget(date_in)

        grid.add_widget(Label(text="Type / Head:", color=(0.2, 0.2, 0.2, 1), halign='left', text_size=(150, None)))
        type_spinner = Spinner(
            text='To MDM (Grant Received)',
            values=('To MDM (Grant Received)', 'By MDM (Expenditure)', 'To Bank (Contra T/P)'),
            sync_height=True
        )
        grid.add_widget(type_spinner)

        grid.add_widget(Label(text="Particulars:", color=(0.2, 0.2, 0.2, 1), halign='left', text_size=(150, None)))
        particulars_in = TextInput(text="To MDM Cooking Cost Grant", multiline=False)
        grid.add_widget(particulars_in)

        grid.add_widget(Label(text="Payment Mode:", color=(0.2, 0.2, 0.2, 1), halign='left', text_size=(150, None)))
        mode_spinner = Spinner(text='BANK', values=('BANK', 'CASH'), sync_height=True)
        grid.add_widget(mode_spinner)

        grid.add_widget(Label(text="Amount in Rs.:", color=(0.2, 0.2, 0.2, 1), halign='left', text_size=(150, None)))
        amt_in = TextInput(hint_text="0.00", multiline=False, input_filter='float')
        grid.add_widget(amt_in)

        content.add_widget(grid)

        btn_bar = BoxLayout(size_hint_y=None, height=46, spacing=10)
        cancel_btn = Button(text="Cancel", background_color=(0.55, 0.55, 0.55, 1))
        save_btn = Button(text="Save Entry", background_color=(0.12, 0.45, 0.85, 1), bold=True)
        btn_bar.add_widget(cancel_btn)
        btn_bar.add_widget(save_btn)
        content.add_widget(btn_bar)

        popup = Popup(title=f"Add Voucher - {account_key}", content=content, size_hint=(0.92, 0.65), auto_dismiss=False)

        def on_add(btn):
            try:
                amt = float(amt_in.text.strip() or "0.0")
                if amt <= 0:
                    return
                app = App.get_running_app()
                t_choice = type_spinner.text
                if 'To Bank' in t_choice:
                    app.db.add_contra_withdrawal(account_key, ym, date_in.text.strip(), "Slip", amt)
                elif 'To MDM' in t_choice:
                    app.db.add_receipt(account_key, ym, date_in.text.strip(), particulars_in.text.strip(), "-", mode_spinner.text, amt)
                else:
                    app.db.add_payment_voucher(account_key, ym, date_in.text.strip(), "1", particulars_in.text.strip(), mode_spinner.text, amt)
                popup.dismiss()
                self.render_cashbook(account_key)
            except Exception:
                pass

        cancel_btn.bind(on_release=popup.dismiss)
        save_btn.bind(on_release=on_add)
        popup.open()

    def view_ledger(self, account_key):
        ym = self.ids.mdm_cb_ym.text.strip() if 'mdm_cb_ym' in self.ids else "2026-09"
        app = App.get_running_app()
        records = app.db.get_entries_for_month(account_key, ym) if hasattr(app, 'db') else []

        content = BoxLayout(orientation='vertical', spacing=10, padding=10)

        header = Label(
            text=f"[b]{account_key} Ledger ({ym})[/b]\nTotal Entries: {len(records)}",
            markup=True,
            size_hint_y=None,
            height='45dp',
            color=(0.1, 0.3, 0.7, 1)
        )
        content.add_widget(header)

        scroll = ScrollView(size_hint=(1, 1))
        grid = GridLayout(cols=1, spacing=8, size_hint_y=None)
        grid.bind(minimum_height=grid.setter('height'))

        if not records:
            grid.add_widget(Label(text="No transactions recorded this month.", size_hint_y=None, height='40dp', color=(0.4, 0.4, 0.4, 1)))
        else:
            for item in records:
                t_id = item["id"]
                t_date = item["entry_date"]
                particular = item["particulars"]
                mode = item["mode"]
                amt = float(item["amount"])

                row = BoxLayout(orientation='horizontal', size_hint_y=None, height='44dp', spacing=5)
                desc = f"{t_date} | {particular} ({mode}): Rs.{amt:.2f}"
                row.add_widget(Label(text=desc, size_hint_x=0.75, halign='left', text_size=(230, None), color=(0, 0, 0, 1)))

                del_btn = Button(text="Delete", size_hint_x=0.25, background_color=(0.85, 0.2, 0.2, 1))
                del_btn.bind(on_release=lambda btn, i=t_id: self._delete_entry(i, account_key))
                row.add_widget(del_btn)
                grid.add_widget(row)

        scroll.add_widget(grid)
        content.add_widget(scroll)

        action_bar = BoxLayout(size_hint_y=None, height='46dp', spacing=10)
        reset_btn = Button(text="Reset All This Month", background_color=(0.7, 0.1, 0.1, 1))
        reset_btn.bind(on_release=lambda btn: self._reset_month(account_key, ym))
        close_btn = Button(text="Close", background_color=(0.2, 0.5, 0.8, 1))
        action_bar.add_widget(reset_btn)
        action_bar.add_widget(close_btn)
        content.add_widget(action_bar)

        self._ledger_popup = Popup(title="Ledger Entries & Corrections", content=content, size_hint=(0.95, 0.85))
        close_btn.bind(on_release=self._ledger_popup.dismiss)
        self._ledger_popup.open()

    def _delete_entry(self, trans_id, account_key):
        app = App.get_running_app()
        if hasattr(app, 'db'):
            app.db.delete_transaction(trans_id)
        if hasattr(self, '_ledger_popup'):
            self._ledger_popup.dismiss()
        self.render_cashbook(account_key)
        self.view_ledger(account_key)

    def _reset_month(self, account_key, ym):
        app = App.get_running_app()
        if hasattr(app, 'db'):
            app.db.reset_month_data(account_key, ym)
        if hasattr(self, '_ledger_popup'):
            self._ledger_popup.dismiss()
        self.render_cashbook(account_key)
        self.view_ledger(account_key)

    def render_cashbook(self, account_key):
        try:
            ym = self.ids.mdm_cb_ym.text.strip() if 'mdm_cb_ym' in self.ids else "2026-09"
            app = App.get_running_app()
            data = app.db.calculate_audit_cashbook(account_key, ym) if hasattr(app, 'db') else {}
            status_cash = f"Cash in Hand: Rs. {data.get('net_cash', 0.0):.2f}"
            if data.get('net_cash', 0.0) < 0:
                status_cash = f"Due to In-Charge: -Rs. {abs(data.get('net_cash', 0.0)):.2f}"

            if 'mdm_cb_summary_lbl' in self.ids:
                self.ids.mdm_cb_summary_lbl.text = (
                    f"Month: {ym} | Dr (T/P): Cash Rs.{data.get('total_dr_cash', 0.0):.2f} / Bank Rs.{data.get('total_dr_bank', 0.0):.2f}\n"
                    f"Cr (T/P): Cash Rs.{data.get('total_cr_cash', 0.0):.2f} / Bank Rs.{data.get('total_cr_bank', 0.0):.2f}\n"
                    f"Status: {status_cash} | Bank: Rs.{data.get('net_bank', 0.0):.2f}\n[Ledger Balanced]"
                )
        except Exception:
            pass

    def export_cashbook_pdf(self, account_key):
        try:
            ym = self.ids.mdm_cb_ym.text.strip() if 'mdm_cb_ym' in self.ids else "2026-09"
            app = App.get_running_app()
            data = app.db.calculate_audit_cashbook(account_key, ym) if hasattr(app, 'db') else {}
            out_dir = get_safe_storage_dir()
            filename = os.path.join(out_dir, f"{account_key}_{ym}_CashBook.pdf")
            from pdf_generator import generate_cashbook_pdf
            generate_cashbook_pdf("MDM Savings Account", ym, data, output_path=filename)
            if 'mdm_cb_summary_lbl' in self.ids:
                self.ids.mdm_cb_summary_lbl.text = f"PDF Saved to App Folder:\n{filename}"
        except Exception as e:
            if 'mdm_cb_summary_lbl' in self.ids:
                self.ids.mdm_cb_summary_lbl.text = f"PDF Error: {e}"


class SMCPortalScreen(Screen):
    def switch_smc_view(self, view_name):
        if 'smc_sub_sm' in self.ids:
            self.ids.smc_sub_sm.current = 'smc_savings_view' if view_name == 'smc_savings' else 'smc_canara_view'

    def save_opening_balances(self, account_key):
        try:
            if account_key == 'SMC_SAVINGS':
                ym = self.ids.smc_sav_ym.text.strip() if 'smc_sav_ym' in self.ids else "2026-09"
                c = float(self.ids.smc_sav_op_cash.text.strip() if 'smc_sav_op_cash' in self.ids and self.ids.smc_sav_op_cash.text.strip() else "0.0")
                b = float(self.ids.smc_sav_op_bank.text.strip() if 'smc_sav_op_bank' in self.ids and self.ids.smc_sav_op_bank.text.strip() else "0.0")
                lbl = self.ids.get('smc_sav_summary_lbl')
            else:
                ym = self.ids.smc_canara_ym.text.strip() if 'smc_canara_ym' in self.ids else "2026-09"
                c = 0.0
                b = float(self.ids.smc_canara_op_bank.text.strip() if 'smc_canara_op_bank' in self.ids and self.ids.smc_canara_op_bank.text.strip() else "0.0")
                lbl = self.ids.get('smc_canara_summary_lbl')

            app = App.get_running_app()
            if hasattr(app, 'db'):
                app.db.set_opening_balances(account_key, ym, c, b)
            if lbl:
                lbl.text = f"To O/B saved for {ym}."
        except Exception:
            pass

    def view_ledger(self, account_key):
        ym = (self.ids.smc_sav_ym.text.strip() if account_key == 'SMC_SAVINGS' else self.ids.smc_canara_ym.text.strip()) if hasattr(self, 'ids') else "2026-09"
        app = App.get_running_app()
        records = app.db.get_entries_for_month(account_key, ym) if hasattr(app, 'db') else []

        content = BoxLayout(orientation='vertical', spacing=10, padding=10)

        header = Label(
            text=f"[b]{account_key} Ledger ({ym})[/b]\nTotal Entries: {len(records)}",
            markup=True,
            size_hint_y=None,
            height='45dp',
            color=(0.1, 0.3, 0.7, 1)
        )
        content.add_widget(header)

        scroll = ScrollView(size_hint=(1, 1))
        grid = GridLayout(cols=1, spacing=8, size_hint_y=None)
        grid.bind(minimum_height=grid.setter('height'))

        if not records:
            grid.add_widget(Label(text="No transactions recorded this month.", size_hint_y=None, height='40dp', color=(0.4, 0.4, 0.4, 1)))
        else:
            for item in records:
                t_id = item["id"]
                t_date = item["entry_date"]
                particular = item["particulars"]
                mode = item["mode"]
                amt = float(item["amount"])

                row = BoxLayout(orientation='horizontal', size_hint_y=None, height='44dp', spacing=5)
                desc = f"{t_date} | {particular} ({mode}): Rs.{amt:.2f}"
                row.add_widget(Label(text=desc, size_hint_x=0.75, halign='left', text_size=(230, None), color=(0, 0, 0, 1)))

                del_btn = Button(text="Delete", size_hint_x=0.25, background_color=(0.85, 0.2, 0.2, 1))
                del_btn.bind(on_release=lambda btn, i=t_id: self._delete_entry(i, account_key))
                row.add_widget(del_btn)
                grid.add_widget(row)

        scroll.add_widget(grid)
        content.add_widget(scroll)

        action_bar = BoxLayout(size_hint_y=None, height='46dp', spacing=10)
        reset_btn = Button(text="Reset All This Month", background_color=(0.7, 0.1, 0.1, 1))
        reset_btn.bind(on_release=lambda btn: self._reset_month(account_key, ym))
        close_btn = Button(text="Close", background_color=(0.2, 0.5, 0.8, 1))
        action_bar.add_widget(reset_btn)
        action_bar.add_widget(close_btn)
        content.add_widget(action_bar)

        self._smc_ledger_popup = Popup(title="SMC Ledger Entries", content=content, size_hint=(0.95, 0.85))
        close_btn.bind(on_release=self._smc_ledger_popup.dismiss)
        self._smc_ledger_popup.open()

    def _delete_entry(self, trans_id, account_key):
        app = App.get_running_app()
        if hasattr(app, 'db'):
            app.db.delete_transaction(trans_id)
        if hasattr(self, '_smc_ledger_popup'):
            self._smc_ledger_popup.dismiss()
        self.render_cashbook(account_key)
        self.view_ledger(account_key)

    def _reset_month(self, account_key, ym):
        app = App.get_running_app()
        if hasattr(app, 'db'):
            app.db.reset_month_data(account_key, ym)
        if hasattr(self, '_smc_ledger_popup'):
            self._smc_ledger_popup.dismiss()
        self.render_cashbook(account_key)
        self.view_ledger(account_key)

    def render_cashbook(self, account_key):
        try:
            if account_key == 'SMC_SAVINGS':
                ym = self.ids.smc_sav_ym.text.strip() if 'smc_sav_ym' in self.ids else "2026-09"
                lbl = self.ids.get('smc_sav_summary_lbl')
            else:
                ym = self.ids.smc_canara_ym.text.strip() if 'smc_canara_ym' in self.ids else "2026-09"
                lbl = self.ids.get('smc_canara_summary_lbl')

            app = App.get_running_app()
            data = app.db.calculate_audit_cashbook(account_key, ym) if hasattr(app, 'db') else {}
            if lbl:
                lbl.text = (
                    f"Month: {ym} | Dr (T/P): Cash Rs.{data.get('total_dr_cash', 0.0):.2f} / Bank Rs.{data.get('total_dr_bank', 0.0):.2f}\n"
                    f"Cr (T/P): Cash Rs.{data.get('total_cr_cash', 0.0):.2f} / Bank Rs.{data.get('total_cr_bank', 0.0):.2f}\n"
                    f"Status: In Hand Rs.{data.get('net_cash', 0.0):.2f} | Bank: Rs.{data.get('net_bank', 0.0):.2f}\n[Ledger Balanced]"
                )
        except Exception:
            pass

    def export_cashbook_pdf(self, account_key):
        try:
            if account_key == 'SMC_SAVINGS':
                ym = self.ids.smc_sav_ym.text.strip() if 'smc_sav_ym' in self.ids else "2026-09"
                lbl = self.ids.get('smc_sav_summary_lbl')
                title = "SMC Savings Account"
            else:
                ym = self.ids.smc_canara_ym.text.strip() if 'smc_canara_ym' in self.ids else "2026-09"
                lbl = self.ids.get('smc_canara_summary_lbl')
                title = "Canara Bank SNA (Zero Balance) Account"

            app = App.get_running_app()
            data = app.db.calculate_audit_cashbook(account_key, ym) if hasattr(app, 'db') else {}
            out_dir = get_safe_storage_dir()
            filename = os.path.join(out_dir, f"{account_key}_{ym}_CashBook.pdf")
            from pdf_generator import generate_cashbook_pdf
            generate_cashbook_pdf(title, ym, data, output_path=filename)
            if lbl:
                lbl.text = f"PDF Saved to App Folder:\n{filename}"
        except Exception as e:
            if lbl:
                lbl.text = f"PDF Error: {e}"


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

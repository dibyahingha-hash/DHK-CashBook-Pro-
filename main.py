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


class MDMPortalScreen(Screen):
    def calculate_and_save(self):
        try:
            ym = self.ids.in_ym.text.strip()
            wd = int(self.ids.in_wd.text.strip() or 0)
            lp_m = int(self.ids.in_lp_meals.text.strip() or 0)
            up_m = int(self.ids.in_up_meals.text.strip() or 0)
            tot_m = lp_m + up_m

            lp_r = float(self.ids.in_lp_rate.text.strip() or 6.78)
            up_r = float(self.ids.in_up_rate.text.strip() or 10.15)

            # Rice Math: 100g (0.1kg) LP, 150g (0.15kg) UP
            grain_op = float(self.ids.in_rice_op.text.strip() or 0.0)
            grain_rec = float(self.ids.in_rice_rec.text.strip() or 0.0)
            grain_cons = round((lp_m * 0.100) + (up_m * 0.150), 3)
            grain_cl = round((grain_op + grain_rec) - grain_cons, 3)

            # Fund Math: LP @ 6.78, UP @ 10.15
            cost_op = float(self.ids.in_cost_op.text.strip() or 0.0)
            cost_rec = float(self.ids.in_cost_rec.text.strip() or 0.0)
            cost_exp = round((lp_m * lp_r) + (up_m * up_r), 2)
            cost_cl = round((cost_op + cost_rec) - cost_exp, 2)

            status = f"Surplus: Rs. {cost_cl:.2f}" if cost_cl >= 0 else f"Deficit (Due to In-Charge): -Rs. {abs(cost_cl):.2f}"

            # Save to Database
            app = App.get_running_app()
            if hasattr(app, 'db'):
                app.db.save_mdm_stock(
                    ym, wd, lp_m, up_m, tot_m,
                    lp_r, up_r,
                    grain_op, grain_rec, grain_cons, grain_cl,
                    cost_op, cost_rec, cost_exp, cost_cl
                )

            # Display immediately on screen
            self.ids.out_results.text = (
                f"SUMMARY FOR {ym}:\n"
                f"----------------------------------------\n"
                f"Total Meals Served: {tot_m} (LP: {lp_m}, UP: {up_m})\n"
                f"Rice Consumed: {grain_cons:.2f} kg\n"
                f"Rice Closing Balance: {grain_cl:.2f} kg\n"
                f"----------------------------------------\n"
                f"Cooking Cost Expenditure: Rs. {cost_exp:.2f}\n"
                f"Closing Fund Status: {status}\n"
                f"Status: Data Saved to Database Successfully."
            )
        except Exception as e:
            self.ids.out_results.text = f"Calculation Error: {e}"

    def export_pdf(self):
        try:
            ym = self.ids.in_ym.text.strip()
            self.calculate_and_save()
            app = App.get_running_app()
            rec = app.db.get_mdm_stock_record(ym) if hasattr(app, 'db') else None

            out_dir = get_safe_storage_dir()
            filename = os.path.join(out_dir, f"MDM_Stock_{ym}.pdf")
            from pdf_generator import generate_stock_register
            generate_stock_register(ym, dict(rec) if rec else {}, output_path=filename)
            self.ids.out_results.text += f"\n\nPDF Generated at:\n{filename}"
        except Exception as e:
            self.ids.out_results.text += f"\n\nPDF Generation Error: {e}"


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

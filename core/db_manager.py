import sqlite3

class DatabaseManager:
    def __init__(self, db_path):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS mdm_stock_monthly (
                    year_month TEXT PRIMARY KEY,
                    working_days INTEGER,
                    lp_meals INTEGER,
                    up_meals INTEGER,
                    total_meals INTEGER,
                    lp_rate REAL,
                    up_rate REAL,
                    grain_opening REAL,
                    grain_received REAL,
                    grain_consumed REAL,
                    grain_closing REAL,
                    cost_opening REAL,
                    cost_received REAL,
                    cost_expenditure REAL,
                    cost_closing REAL
                )
            ''')
            conn.commit()

    def save_mdm_stock(self, ym, wd, lp_m, up_m, tot_m, lp_r, up_r, g_op, g_rec, g_cons, g_cl, c_op, c_rec, c_exp, c_cl):
        with self._get_connection() as conn:
            conn.execute('''
                INSERT OR REPLACE INTO mdm_stock_monthly (
                    year_month, working_days, lp_meals, up_meals, total_meals,
                    lp_rate, up_rate, grain_opening, grain_received, grain_consumed, grain_closing,
                    cost_opening, cost_received, cost_expenditure, cost_closing
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (ym, wd, lp_m, up_m, tot_m, lp_r, up_r, g_op, g_rec, g_cons, g_cl, c_op, c_rec, c_exp, c_cl))
            conn.commit()

    def get_mdm_stock_record(self, ym):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM mdm_stock_monthly WHERE year_month = ?", (ym,))
            return cursor.fetchone()

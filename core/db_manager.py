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
            # 1. Stock Register Table
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
            # 2. Opening Balances for the 3 Cash Books
            conn.execute('''
                CREATE TABLE IF NOT EXISTS cashbook_opening_balances (
                    account_key TEXT,
                    year_month TEXT,
                    opening_cash REAL DEFAULT 0.0,
                    opening_bank REAL DEFAULT 0.0,
                    PRIMARY KEY (account_key, year_month)
                )
            ''')
            # 3. Double-entry lines for Receipts (Dr) and Payments (Cr)
            conn.execute('''
                CREATE TABLE IF NOT EXISTS cashbook_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_key TEXT,
                    year_month TEXT,
                    entry_date TEXT,
                    entry_type TEXT, -- 'RECEIPT', 'PAYMENT', 'CONTRA'
                    particulars TEXT,
                    voucher_no TEXT,
                    cash_amount REAL DEFAULT 0.0,
                    bank_amount REAL DEFAULT 0.0
                )
            ''')
            conn.commit()

    # --- STOCK METHODS ---
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
            cur = conn.cursor()
            cur.execute("SELECT * FROM mdm_stock_monthly WHERE year_month = ?", (ym,))
            return cur.fetchone()

    # --- CASH BOOK METHODS ---
    def set_opening_balance(self, account_key, ym, cash, bank):
        with self._get_connection() as conn:
            conn.execute('''
                INSERT OR REPLACE INTO cashbook_opening_balances (account_key, year_month, opening_cash, opening_bank)
                VALUES (?, ?, ?, ?)
            ''', (account_key, ym, cash, bank))
            conn.commit()

    def get_opening_balance(self, account_key, ym):
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT opening_cash, opening_bank FROM cashbook_opening_balances WHERE account_key = ? AND year_month = ?", (account_key, ym))
            row = cur.fetchone()
            if row:
                return float(row['opening_cash']), float(row['opening_bank'])
            return 0.0, 0.0

    def add_entry(self, account_key, ym, date, e_type, particular, v_no, cash_amt, bank_amt):
        with self._get_connection() as conn:
            conn.execute('''
                INSERT INTO cashbook_entries (account_key, year_month, entry_date, entry_type, particulars, voucher_no, cash_amount, bank_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (account_key, ym, date, e_type, particular, v_no, cash_amt, bank_amt))
            conn.commit()

    def get_entries(self, account_key, ym):
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM cashbook_entries WHERE account_key = ? AND year_month = ? ORDER BY entry_date ASC, id ASC", (account_key, ym))
            return cur.fetchall()

    def delete_entry(self, entry_id):
        with self._get_connection() as conn:
            conn.execute("DELETE FROM cashbook_entries WHERE id = ?", (entry_id,))
            conn.commit()

    def calculate_totals(self, account_key, ym):
        op_cash, op_bank = self.get_opening_balance(account_key, ym)
        entries = self.get_entries(account_key, ym)

        dr_cash = op_cash
        dr_bank = op_bank
        cr_cash = 0.0
        cr_bank = 0.0

        for e in entries:
            e_type = e['entry_type']
            c_val = float(e['cash_amount'] or 0.0)
            b_val = float(e['bank_amount'] or 0.0)

            if e_type == 'RECEIPT':
                dr_cash += c_val
                dr_bank += b_val
            elif e_type == 'PAYMENT':
                cr_cash += c_val
                cr_bank += b_val
            elif e_type == 'CONTRA':
                # Cash withdrawal: Dr. Cash, Cr. Bank
                dr_cash += c_val
                cr_bank += b_val

        cl_cash = round(dr_cash - cr_cash, 2)
        cl_bank = round(dr_bank - cr_bank, 2)

        return {
            'op_cash': op_cash, 'op_bank': op_bank,
            'dr_cash': round(dr_cash, 2), 'dr_bank': round(dr_bank, 2),
            'cr_cash': round(cr_cash, 2), 'cr_bank': round(cr_bank, 2),
            'cl_cash': cl_cash, 'cl_bank': cl_bank,
            'entries_count': len(entries)
        }

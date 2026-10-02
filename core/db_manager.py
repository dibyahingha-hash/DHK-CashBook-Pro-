import sqlite3
import os

class DatabaseManager:
    def __init__(self, db_path="school_ledger.db"):
        self.db_path = db_path
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS cashbook_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_key TEXT NOT NULL,
                    year_month TEXT NOT NULL,
                    entry_type TEXT NOT NULL,
                    entry_date TEXT NOT NULL,
                    particulars TEXT NOT NULL,
                    ref_voucher_no TEXT,
                    mode TEXT NOT NULL,
                    amount REAL NOT NULL
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS monthly_balances (
                    account_key TEXT NOT NULL,
                    year_month TEXT NOT NULL,
                    opening_cash REAL NOT NULL DEFAULT 0.0,
                    opening_bank REAL NOT NULL DEFAULT 0.0,
                    PRIMARY KEY (account_key, year_month)
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS mdm_stock_monthly (
                    year_month TEXT PRIMARY KEY,
                    working_days INTEGER NOT NULL,
                    lp_meals INTEGER NOT NULL DEFAULT 0,
                    up_meals INTEGER NOT NULL DEFAULT 0,
                    total_meals INTEGER NOT NULL DEFAULT 0,
                    lp_rate REAL NOT NULL DEFAULT 6.78,
                    up_rate REAL NOT NULL DEFAULT 10.15,
                    grain_op REAL NOT NULL DEFAULT 0.0,
                    grain_rec REAL NOT NULL DEFAULT 0.0,
                    grain_cons REAL NOT NULL DEFAULT 0.0,
                    grain_cl REAL NOT NULL DEFAULT 0.0,
                    cost_op REAL NOT NULL DEFAULT 0.0,
                    cost_rec REAL NOT NULL DEFAULT 0.0,
                    cost_exp REAL NOT NULL DEFAULT 0.0,
                    cost_cl REAL NOT NULL DEFAULT 0.0
                )
            """)
            conn.commit()

    def set_opening_balances(self, account_key, year_month, opening_cash, opening_bank):
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO monthly_balances (account_key, year_month, opening_cash, opening_bank)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(account_key, year_month) DO UPDATE SET
                    opening_cash = excluded.opening_cash,
                    opening_bank = excluded.opening_bank
            """, (account_key, year_month, float(opening_cash), float(opening_bank)))
            conn.commit()

    def get_opening_balances(self, account_key, year_month):
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT opening_cash, opening_bank FROM monthly_balances WHERE account_key = ? AND year_month = ?", 
                (account_key, year_month)
            )
            row = cur.fetchone()
            if row:
                return float(row["opening_cash"]), float(row["opening_bank"])
            return 0.0, 0.0

    def add_receipt(self, account_key, year_month, entry_date, particulars, ref_no, mode, amount):
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO cashbook_entries (account_key, year_month, entry_type, entry_date, particulars, ref_voucher_no, mode, amount)
                VALUES (?, ?, 'RECEIPT', ?, ?, ?, ?, ?)
            """, (account_key, year_month, entry_date, particulars, ref_no, mode.upper(), float(amount)))
            conn.commit()

    def add_contra_withdrawal(self, account_key, year_month, entry_date, cheque_slip_no, amount):
        if account_key in ('SMC_CANARA', 'SMC_CANARA_SNA'):
            return
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO cashbook_entries (account_key, year_month, entry_type, entry_date, particulars, ref_voucher_no, mode, amount)
                VALUES (?, ?, 'CONTRA', ?, 'To Bank (Cash Withdrawn)', ?, 'CASH', ?)
            """, (account_key, year_month, entry_date, cheque_slip_no, float(amount)))
            conn.commit()

    def add_payment_voucher(self, account_key, year_month, entry_date, voucher_no, particulars, mode, amount):
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO cashbook_entries (account_key, year_month, entry_type, entry_date, particulars, ref_voucher_no, mode, amount)
                VALUES (?, ?, 'PAYMENT', ?, ?, ?, ?, ?)
            """, (account_key, year_month, entry_date, particulars, str(voucher_no), mode.upper(), float(amount)))
            conn.commit()

    def get_entries_for_month(self, account_key, year_month):
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT * FROM cashbook_entries 
                WHERE account_key = ? AND year_month = ? 
                ORDER BY entry_date ASC, id ASC
            """, (account_key, year_month))
            return cur.fetchall()

    def calculate_audit_cashbook(self, account_key, year_month):
        op_cash, op_bank = self.get_opening_balances(account_key, year_month)
        entries = self.get_entries_for_month(account_key, year_month)

        left_dr, right_cr = [], []

        # Dr. Side - Opening Balances
        if op_bank >= 0:
            left_dr.append({"date": f"{year_month}-01", "particulars": "To O/B", "ref": "-", "cash": max(0.0, op_cash), "bank": op_bank})
        else:
            left_dr.append({"date": f"{year_month}-01", "particulars": "To O/B", "ref": "-", "cash": max(0.0, op_cash), "bank": 0.0})
            right_cr.append({"date": f"{year_month}-01", "particulars": "By O/B (Bank Overdraft)", "ref": "-", "cash": 0.0, "bank": abs(op_bank)})

        if op_cash < 0:
            right_cr.append({"date": f"{year_month}-01", "particulars": "By O/B (Due to In-Charge / Deficit)", "ref": "-", "cash": abs(op_cash), "bank": 0.0})

        net_cash, net_bank = op_cash, op_bank

        for e in entries:
            e_type = e["entry_type"]
            mode = e["mode"]
            amt = float(e["amount"])
            dt = e["entry_date"]
            part = e["particulars"]
            ref = e["ref_voucher_no"] or "-"

            if e_type == "RECEIPT":
                if mode == "BANK":
                    left_dr.append({"date": dt, "particulars": part, "ref": ref, "cash": 0.0, "bank": amt})
                    net_bank += amt
                else:
                    left_dr.append({"date": dt, "particulars": part, "ref": ref, "cash": amt, "bank": 0.0})
                    net_cash += amt

            elif e_type == "CONTRA":
                left_dr.append({"date": dt, "particulars": "To Bank A/c (T/P)", "ref": ref, "cash": amt, "bank": 0.0})
                right_cr.append({"date": dt, "particulars": "By Cash A/c (T/P)", "ref": ref, "cash": 0.0, "bank": amt})
                net_cash += amt
                net_bank -= amt

            elif e_type == "PAYMENT":
                if mode == "BANK":
                    right_cr.append({"date": dt, "particulars": part, "ref": ref, "cash": 0.0, "bank": amt})
                    net_bank -= amt
                else:
                    right_cr.append({"date": dt, "particulars": part, "ref": ref, "cash": amt, "bank": 0.0})
                    net_cash -= amt

        # Closing Balances (By C/B)
        if net_cash >= 0:
            right_cr.append({"date": f"{year_month}-End", "particulars": "By C/B (Cash in Hand)", "ref": "-", "cash": net_cash, "bank": 0.0})
        else:
            left_dr.append({"date": f"{year_month}-End", "particulars": "To C/B (Deficit Due to In-Charge)", "ref": "-", "cash": abs(net_cash), "bank": 0.0})

        if net_bank >= 0:
            right_cr.append({"date": f"{year_month}-End", "particulars": "By C/B (In Bank Account)", "ref": "-", "cash": 0.0, "bank": net_bank})
        else:
            left_dr.append({"date": f"{year_month}-End", "particulars": "To C/B (Bank Overdraft)", "ref": "-", "cash": 0.0, "bank": abs(net_bank)})

        return {
            "dr_rows": left_dr,
            "cr_rows": right_cr,
            "total_dr_cash": sum(r["cash"] for r in left_dr),
            "total_dr_bank": sum(r["bank"] for r in left_dr),
            "total_cr_cash": sum(r["cash"] for r in right_cr),
            "total_cr_bank": sum(r["bank"] for r in right_cr),
            "net_cash": net_cash,
            "net_bank": net_bank
        }

    def save_mdm_stock(self, year_month, working_days, lp_meals, up_meals, total_meals,
                       lp_rate, up_rate,
                       grain_op, grain_rec, grain_cons, grain_cl,
                       cost_op, cost_rec, cost_exp, cost_cl):
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO mdm_stock_monthly 
                (year_month, working_days, lp_meals, up_meals, total_meals, 
                 lp_rate, up_rate,
                 grain_op, grain_rec, grain_cons, grain_cl, 
                 cost_op, cost_rec, cost_exp, cost_cl)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(year_month) DO UPDATE SET
                    working_days = excluded.working_days,
                    lp_meals = excluded.lp_meals,
                    up_meals = excluded.up_meals,
                    total_meals = excluded.total_meals,
                    lp_rate = excluded.lp_rate,
                    up_rate = excluded.up_rate,
                    grain_op = excluded.grain_op,
                    grain_rec = excluded.grain_rec,
                    grain_cons = excluded.grain_cons,
                    grain_cl = excluded.grain_cl,
                    cost_op = excluded.cost_op,
                    cost_rec = excluded.cost_rec,
                    cost_exp = excluded.cost_exp,
                    cost_cl = excluded.cost_cl
            """, (year_month, int(working_days), int(lp_meals), int(up_meals), int(total_meals),
                  float(lp_rate), float(up_rate),
                  float(grain_op), float(grain_rec), float(grain_cons), float(grain_cl),
                  float(cost_op), float(cost_rec), float(cost_exp), float(cost_cl)))
            conn.commit()

    def get_mdm_stock_record(self, year_month):
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM mdm_stock_monthly WHERE year_month = ?", (year_month,))
            return cur.fetchone()

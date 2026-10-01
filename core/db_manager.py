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
                    rice_op REAL NOT NULL DEFAULT 0.0,
                    rice_rec REAL NOT NULL DEFAULT 0.0,
                    rice_cons REAL NOT NULL DEFAULT 0.0,
                    rice_cl REAL NOT NULL DEFAULT 0.0,
                    oil_op REAL NOT NULL DEFAULT 0.0,
                    oil_rec REAL NOT NULL DEFAULT 0.0,
                    oil_cons REAL NOT NULL DEFAULT 0.0,
                    oil_cl REAL NOT NULL DEFAULT 0.0
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
        if account_key == 'SMC_CANARA_SNA':
            return
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO cashbook_entries (account_key, year_month, entry_type, entry_date, particulars, ref_voucher_no, mode, amount)
                VALUES (?, ?, 'CONTRA', ?, 'Self Bank Withdrawal for Cash Box', ?, 'CASH', ?)
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

    def get_next_voucher_number(self, account_key, year_month):
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT COUNT(*) as count FROM cashbook_entries 
                WHERE account_key = ? AND year_month = ? AND entry_type = 'PAYMENT'
            """, (account_key, year_month))
            row = cur.fetchone()
            return str((row["count"] if row else 0) + 1)

    def calculate_audit_cashbook(self, account_key, year_month):
        op_cash, op_bank = self.get_opening_balances(account_key, year_month)
        entries = self.get_entries_for_month(account_key, year_month)

        left_dr, right_cr = [], []

        if op_bank >= 0:
            left_dr.append({"date": f"{year_month}-01", "particulars": "To Opening Balance b/f", "ref": "-", "cash": max(0.0, op_cash), "bank": op_bank})
        else:
            left_dr.append({"date": f"{year_month}-01", "particulars": "To Opening Balance b/f", "ref": "-", "cash": max(0.0, op_cash), "bank": 0.0})
            right_cr.append({"date": f"{year_month}-01", "particulars": "By Bank Overdraft b/f", "ref": "-", "cash": 0.0, "bank": abs(op_bank)})

        if op_cash < 0:
            right_cr.append({"date": f"{year_month}-01", "particulars": "To Opening Balance b/f (Prior Dues to Teacher)", "ref": "-", "cash": abs(op_cash), "bank": 0.0})

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
                left_dr.append({"date": dt, "particulars": f"To Bank (Contra: {part})", "ref": ref, "cash": amt, "bank": 0.0})
                right_cr.append({"date": dt, "particulars": f"By Cash Box (Contra: {ref})", "ref": ref, "cash": 0.0, "bank": amt})
                net_cash += amt
                net_bank -= amt

            elif e_type == "PAYMENT":
                if mode == "BANK":
                    right_cr.append({"date": dt, "particulars": part, "ref": f"V-{ref}", "cash": 0.0, "bank": amt})
                    net_bank -= amt
                elif mode == "TEACHER_ADVANCE":
                    right_cr.append({"date": dt, "particulars": f"{part} (Paid by Teacher Advance)", "ref": f"V-{ref}", "cash": amt, "bank": 0.0})
                    net_cash -= amt
                else:
                    right_cr.append({"date": dt, "particulars": part, "ref": f"V-{ref}", "cash": amt, "bank": 0.0})
                    net_cash -= amt

        if net_cash >= 0:
            right_cr.append({"date": f"{year_month}-End", "particulars": "By Closing Balance c/d (Cash in Hand)", "ref": "-", "cash": net_cash, "bank": 0.0})
        else:
            left_dr.append({"date": f"{year_month}-End", "particulars": "By Closing Balance c/d (Due to Head Teacher)", "ref": "-", "cash": abs(net_cash), "bank": 0.0})

        if net_bank >= 0:
            right_cr.append({"date": f"{year_month}-End", "particulars": "By Closing Balance c/d (In Bank Account)", "ref": "-", "cash": 0.0, "bank": net_bank})
        else:
            left_dr.append({"date": f"{year_month}-End", "particulars": "By Bank Overdraft c/d", "ref": "-", "cash": 0.0, "bank": abs(net_bank)})

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
                       rice_op, rice_rec, rice_cons, rice_cl,
                       oil_op, oil_rec, oil_cons, oil_cl):
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO mdm_stock_monthly 
                (year_month, working_days, lp_meals, up_meals, total_meals, 
                 rice_op, rice_rec, rice_cons, rice_cl, 
                 oil_op, oil_rec, oil_cons, oil_cl)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(year_month) DO UPDATE SET
                    working_days = excluded.working_days,
                    lp_meals = excluded.lp_meals,
                    up_meals = excluded.up_meals,
                    total_meals = excluded.total_meals,
                    rice_op = excluded.rice_op,
                    rice_rec = excluded.rice_rec,
                    rice_cons = excluded.rice_cons,
                    rice_cl = excluded.rice_cl,
                    oil_op = excluded.oil_op,
                    oil_rec = excluded.oil_rec,
                    oil_cons = excluded.oil_cons,
                    oil_cl = excluded.oil_cl
            """, (year_month, int(working_days), int(lp_meals), int(up_meals), int(total_meals),
                  float(rice_op), float(rice_rec), float(rice_cons), float(rice_cl),
                  float(oil_op), float(oil_rec), float(oil_cons), float(oil_cl)))
            conn.commit()

    def get_mdm_stock_record(self, year_month):
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM mdm_stock_monthly WHERE year_month = ?", (year_month,))
            return cur.fetchone()

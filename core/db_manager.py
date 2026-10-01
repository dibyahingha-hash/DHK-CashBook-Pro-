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
            
            # --- CASH BOOK TRANSACTIONS ---
            # Supports 3 Accounts: 
            # 1. 'MDM_SAVINGS'
            # 2. 'SMC_SAVINGS'
            # 3. 'SMC_CANARA_SNA' (Strictly Bank-only, no cash)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS cashbook_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_key TEXT NOT NULL,        -- 'MDM_SAVINGS', 'SMC_SAVINGS', 'SMC_CANARA_SNA'
                    year_month TEXT NOT NULL,         -- 'YYYY-MM' (any era/decade accepted)
                    entry_type TEXT NOT NULL,         -- 'RECEIPT', 'CONTRA', 'PAYMENT'
                    entry_date TEXT NOT NULL,
                    particulars TEXT NOT NULL,
                    ref_voucher_no TEXT,              -- Cheque No., Advice No., or Voucher No.
                    mode TEXT NOT NULL,               -- 'CASH', 'BANK'
                    amount REAL NOT NULL
                )
            """)

            # --- MONTHLY OPENING BALANCES ---
            # Stores cash & bank per account. Cash can be negative (Dues to Teacher).
            cur.execute("""
                CREATE TABLE IF NOT EXISTS monthly_balances (
                    account_key TEXT NOT NULL,
                    year_month TEXT NOT NULL,
                    opening_cash REAL NOT NULL DEFAULT 0.0,
                    opening_bank REAL NOT NULL DEFAULT 0.0,
                    PRIMARY KEY (account_key, year_month)
                )
            """)

            # --- MDM STOCK & ATTENDANCE REGISTER ---
            # Independent of Cash Book. Houses LP, UP, and Combined totals.
            cur.execute("""
                CREATE TABLE IF NOT EXISTS mdm_stock_monthly (
                    year_month TEXT PRIMARY KEY,
                    working_days INTEGER NOT NULL,
                    lp_meals INTEGER NOT NULL DEFAULT 0,
                    up_meals INTEGER NOT NULL DEFAULT 0,
                    total_meals INTEGER NOT NULL DEFAULT 0,
                    lp_rate REAL NOT NULL DEFAULT 6.78,
                    up_rate REAL NOT NULL DEFAULT 10.15,
                    rice_opening_kg REAL NOT NULL DEFAULT 0.0,
                    rice_received_kg REAL NOT NULL DEFAULT 0.0,
                    rice_consumed_kg REAL NOT NULL DEFAULT 0.0,
                    rice_closing_kg REAL NOT NULL DEFAULT 0.0,
                    fund_opening REAL NOT NULL DEFAULT 0.0,
                    fund_received REAL NOT NULL DEFAULT 0.0,
                    fund_spent REAL NOT NULL DEFAULT 0.0,
                    fund_closing REAL NOT NULL DEFAULT 0.0
                )
            """)
            conn.commit()

    # ==========================================
    # 1. CASH BOOK & BALANCING ENGINE
    # ==========================================

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
        """
        Self Bank Withdrawal to Cash Box (Only allowed for Savings Accounts, not Canara SNA).
        Reduces Bank and increases Cash in Hand.
        """
        if account_key == 'SMC_CANARA_SNA':
            return  # Safety guard: Canara SNA does not permit cash withdrawals

        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO cashbook_entries (account_key, year_month, entry_type, entry_date, particulars, ref_voucher_no, mode, amount)
                VALUES (?, ?, 'CONTRA', ?, 'Self Bank Withdrawal for Cash Box', ?, 'CASH', ?)
            """, (account_key, year_month, entry_date, cheque_slip_no, float(amount)))
            conn.commit()

    def add_payment_voucher(self, account_key, year_month, entry_date, voucher_no, particulars, mode, amount):
        """
        Supports multiple vouchers per month without limit.
        mode can be: 'CASH', 'BANK' (Direct Cheque), or 'TEACHER_ADVANCE'.
        """
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

    def delete_entry(self, entry_id):
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM cashbook_entries WHERE id = ?", (entry_id,))
            conn.commit()

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
        """
        Builds the balanced dual-spread register (Dr. Receipts / Cr. Payments).
        Handles negative cash balances (Head Teacher advances) gracefully by 
        recording balancing liabilities so that Dr. Total == Cr. Total to the rupee.
        """
        op_cash, op_bank = self.get_opening_balances(account_key, year_month)
        entries = self.get_entries_for_month(account_key, year_month)

        left_dr = []    # Receipts (Dr.)
        right_cr = []   # Payments (Cr.)

        # 1. Opening Balance Row Handling
        if op_bank >= 0:
            left_dr.append({"date": f"{year_month}-01", "particulars": "To Opening Balance b/f", "ref": "-", "cash": max(0.0, op_cash), "bank": op_bank})
        else:
            left_dr.append({"date": f"{year_month}-01", "particulars": "To Opening Balance b/f", "ref": "-", "cash": max(0.0, op_cash), "bank": 0.0})
            right_cr.append({"date": f"{year_month}-01", "particulars": "By Bank Overdraft b/f", "ref": "-", "cash": 0.0, "bank": abs(op_bank)})

        # Negative cash opening is placed on Cr. side as carried liability
        if op_cash < 0:
            right_cr.append({"date": f"{year_month}-01", "particulars": "To Opening Balance b/f (Prior Dues to Teacher)", "ref": "-", "cash": abs(op_cash), "bank": 0.0})

        net_cash = op_cash
        net_bank = op_bank

        # 2. Entries Parsing
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
                # Bank pays out, physical Cash increases
                left_dr.append({"date": dt, "particulars": f"To Bank (Contra: {part})", "ref": ref, "cash": amt, "bank": 0.0})
                right_cr.append({"date": dt, "particulars": f"By Cash Box (Contra: {ref})", "ref": ref, "cash": 0.0, "bank": amt})
                net_cash += amt
                net_bank -= amt

            elif e_type == "PAYMENT":
                if mode == "BANK":
                    right_cr.append({"date": dt, "particulars": part, "ref": f"V-{ref}", "cash": 0.0, "bank": amt})
                    net_bank -= amt
                elif mode == "TEACHER_ADVANCE":
                    # Directly paid out-of-pocket
                    right_cr.append({"date": dt, "particulars": f"{part} (Paid by Teacher Advance)", "ref": f"V-{ref}", "cash": amt, "bank": 0.0})
                    net_cash -= amt
                else:  # CASH
                    right_cr.append({"date": dt, "particulars": part, "ref": f"V-{ref}", "cash": amt, "bank": 0.0})
                    net_cash -= amt

        # 3. Closing Balance & Final Balancing
        if net_cash >= 0:
            right_cr.append({"date": f"{year_month}-End", "particulars": "By Closing Balance c/d (Cash in Hand)", "ref": "-", "cash": net_cash, "bank": 0.0})
        else:
            # Negative cash placed on Dr. side as closing liability to balance columns
            left_dr.append({"date": f"{year_month}-End", "particulars": "By Closing Balance c/d (Due to Head Teacher)", "ref": "-", "cash": abs(net_cash), "bank": 0.0})

        if net_bank >= 0:
            right_cr.append({"date": f"{year_month}-End", "particulars": "By Closing Balance c/d (In Bank Account)", "ref": "-", "cash": 0.0, "bank": net_bank})
        else:
            left_dr.append({"date": f"{year_month}-End", "particulars": "By Bank Overdraft c/d", "ref": "-", "cash": 0.0, "bank": abs(net_bank)})

        total_dr_cash = sum(r["cash"] for r in left_dr)
        total_dr_bank = sum(r["bank"] for r in left_dr)
        total_cr_cash = sum(r["cash"] for r in right_cr)
        total_cr_bank = sum(r["bank"] for r in right_cr)

        return {
            "dr_rows": left_dr,
            "cr_rows": right_cr,
            "total_dr_cash": total_dr_cash,
            "total_dr_bank": total_dr_bank,
            "total_cr_cash": total_cr_cash,
            "total_cr_bank": total_cr_bank,
            "net_cash": net_cash,
            "net_bank": net_bank
        }

    # ==========================================
    # 2. INDEPENDENT MDM STOCK & ATTENDANCE
    # ==========================================

    def record_mdm_monthly_batch(self, year_month, working_days, lp_meals, up_meals, total_meals, 
                                 lp_rate=6.78, up_rate=10.15, rice_opening_kg=0.0, rice_received_kg=0.0, fund_received=0.0):
        """
        Accepts separate LP meals, UP meals, and combined total.
        Calculates exact grain consumption (100g LP / 150g UP) and cooking cost obligations.
        Closing fund can be negative (Payable to Head Teacher).
        """
        # If user passed total directly without breaking down, allocate based on values given
        lp_consumed_kg = round(lp_meals * 0.100, 3)
        up_consumed_kg = round(up_meals * 0.150, 3)
        total_rice_consumed = round(lp_consumed_kg + up_consumed_kg, 3)
        rice_closing = round(rice_opening_kg + rice_received_kg - total_rice_consumed, 3)

        lp_cost = round(lp_meals * float(lp_rate), 2)
        up_cost = round(up_meals * float(up_rate), 2)
        total_spent = round(lp_cost + up_cost, 2)
        
        fund_opening = 0.0  # Or fetched from prior month
        fund_closing = round(fund_opening + fund_received - total_spent, 2)

        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO mdm_stock_monthly 
                (year_month, working_days, lp_meals, up_meals, total_meals, lp_rate, up_rate, 
                 rice_opening_kg, rice_received_kg, rice_consumed_kg, rice_closing_kg, 
                 fund_opening, fund_received, fund_spent, fund_closing)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(year_month) DO UPDATE SET
                    working_days = excluded.working_days,
                    lp_meals = excluded.lp_meals,
                    up_meals = excluded.up_meals,
                    total_meals = excluded.total_meals,
                    lp_rate = excluded.lp_rate,
                    up_rate = excluded.up_rate,
                    rice_opening_kg = excluded.rice_opening_kg,
                    rice_received_kg = excluded.rice_received_kg,
                    rice_consumed_kg = excluded.rice_consumed_kg,
                    rice_closing_kg = excluded.rice_closing_kg,
                    fund_received = excluded.fund_received,
                    fund_spent = excluded.fund_spent,
                    fund_closing = excluded.fund_closing
            """, (year_month, int(working_days), int(lp_meals), int(up_meals), int(total_meals),
                  float(lp_rate), float(up_rate), float(rice_opening_kg), float(rice_received_kg),
                  total_rice_consumed, rice_closing, fund_opening, float(fund_received), total_spent, fund_closing))
            conn.commit()

        return {
            "rice_consumed": total_rice_consumed,
            "rice_closing": rice_closing,
            "fund_spent": total_spent,
            "fund_closing": fund_closing
        }

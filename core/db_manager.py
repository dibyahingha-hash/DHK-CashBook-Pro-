import sqlite3
import shutil
import os
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime

DB_NAME = "cashbook.db"
CURRENT_DB_VERSION = 2


class DatabaseManager:
    def __init__(self, db_path: str = DB_NAME):
        self.db_path = db_path
        self._init_database()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def _init_database(self):
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("PRAGMA user_version;")
            ver = cur.fetchone()[0]

            if ver == 0:
                cur.executescript("""
                CREATE TABLE IF NOT EXISTS school_profile (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    school_name TEXT NOT NULL,
                    udise_code TEXT NOT NULL UNIQUE,
                    school_level TEXT NOT NULL DEFAULT 'LP',
                    cluster_block TEXT,
                    district TEXT,
                    device_uid TEXT NOT NULL,
                    master_pin_hash TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS account_initialization (
                    account_type TEXT PRIMARY KEY,
                    financial_year TEXT NOT NULL,
                    start_year INTEGER NOT NULL,
                    start_month INTEGER NOT NULL,
                    opening_cash_paise INTEGER NOT NULL DEFAULT 0,
                    opening_bank_paise INTEGER NOT NULL DEFAULT 0,
                    opening_grain_grams INTEGER NOT NULL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS mdm_config_rates (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    lp_rate_paise INTEGER NOT NULL DEFAULT 678,
                    up_rate_paise INTEGER NOT NULL DEFAULT 1017,
                    lp_grain_grams INTEGER NOT NULL DEFAULT 100,
                    up_grain_grams INTEGER NOT NULL DEFAULT 150,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS mdm_daily_attendance (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entry_date TEXT NOT NULL,
                    period_label TEXT,
                    meals_served INTEGER NOT NULL,
                    cooking_rate_paise INTEGER NOT NULL,
                    cooking_cost_paise INTEGER NOT NULL,
                    scale_grams INTEGER NOT NULL,
                    grain_consumed_grams INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS mdm_grain_receipts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    receipt_date TEXT NOT NULL,
                    challan_number TEXT NOT NULL,
                    source_agency TEXT,
                    quantity_grams INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS transaction_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_type TEXT NOT NULL,
                    entry_date TEXT NOT NULL,
                    transaction_type TEXT NOT NULL,
                    payment_mode TEXT NOT NULL,
                    is_receipt INTEGER NOT NULL,
                    cash_paise INTEGER NOT NULL DEFAULT 0,
                    bank_paise INTEGER NOT NULL DEFAULT 0,
                    purpose_head TEXT NOT NULL,
                    voucher_no TEXT,
                    ref_chq_no TEXT,
                    is_contra INTEGER DEFAULT 0,
                    is_teacher_advance INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS teacher_advance_ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entry_date TEXT NOT NULL,
                    voucher_no TEXT,
                    amount_paise INTEGER NOT NULL,
                    purpose_head TEXT NOT NULL,
                    is_reimbursed INTEGER NOT NULL DEFAULT 0,
                    reimbursement_date TEXT,
                    reimbursement_voucher_no TEXT
                );
                """)
                cur.execute("""
                    INSERT OR IGNORE INTO mdm_config_rates (id, lp_rate_paise, up_rate_paise, lp_grain_grams, up_grain_grams)
                    VALUES (1, 678, 1017, 100, 150);
                """)
                cur.execute(f"PRAGMA user_version = {CURRENT_DB_VERSION};")
                conn.commit()

    # --- Rates Configuration ---
    def get_mdm_rates(self) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM mdm_config_rates WHERE id = 1")
            row = cur.fetchone()
            if row:
                return dict(row)
            return {"lp_rate_paise": 678, "up_rate_paise": 1017, "lp_grain_grams": 100, "up_grain_grams": 150}

    def update_mdm_rates(self, lp_rate_p: int, up_rate_p: int, lp_grain_g: int, up_grain_g: int):
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                UPDATE mdm_config_rates 
                SET lp_rate_paise = ?, up_rate_paise = ?, lp_grain_grams = ?, up_grain_grams = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = 1
            """, (lp_rate_p, up_rate_p, lp_grain_g, up_grain_g))
            conn.commit()

    # --- Profile & Setup ---
    def get_school_profile(self) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM school_profile WHERE id = 1")
            row = cur.fetchone()
            return dict(row) if row else None

    def set_account_initialization(self, account_type: str, fin_year: str, start_year: int,
                                   start_month: int, cash_paise: int, bank_paise: int,
                                   grain_grams: int = 0):
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT OR REPLACE INTO account_initialization 
                (account_type, financial_year, start_year, start_month, opening_cash_paise, opening_bank_paise, opening_grain_grams)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (account_type, fin_year, start_year, start_month, cash_paise, bank_paise, grain_grams))
            conn.commit()

    # --- Teacher Advance & Out-of-Pocket Expenses ---
    def record_voucher_expense(self, account_type: str, date_str: str, voucher_no: str,
                               amount_paise: int, purpose_head: str, mode: str = "CASH",
                               is_out_of_pocket: bool = False) -> int:
        with self._get_connection() as conn:
            cur = conn.cursor()
            if is_out_of_pocket:
                cur.execute("""
                    INSERT INTO teacher_advance_ledger (entry_date, voucher_no, amount_paise, purpose_head, is_reimbursed)
                    VALUES (?, ?, ?, ?, 0)
                """, (date_str, voucher_no, amount_paise, purpose_head))
                cur.execute("""
                    INSERT INTO transaction_records 
                    (account_type, entry_date, transaction_type, payment_mode, is_receipt, cash_paise, bank_paise, purpose_head, voucher_no, is_teacher_advance)
                    VALUES (?, ?, 'TEACHER_ADVANCE_EXPENSE', 'ADVANCE', 0, 0, 0, ?, ?, 1)
                """, (account_type, date_str, purpose_head, voucher_no))
                conn.commit()
                return cur.lastrowid
            else:
                cash_p = amount_paise if mode == "CASH" else 0
                bank_p = amount_paise if mode == "BANK" else 0
                cur.execute("""
                    INSERT INTO transaction_records 
                    (account_type, entry_date, transaction_type, payment_mode, is_receipt, cash_paise, bank_paise, purpose_head, voucher_no)
                    VALUES (?, ?, 'EXPENSE', ?, 0, ?, ?, ?, ?)
                """, (account_type, date_str, mode, cash_p, bank_p, purpose_head, voucher_no))
                conn.commit()
                return cur.lastrowid

    def get_pending_teacher_reimbursement(self) -> int:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT TOTAL(amount_paise) FROM teacher_advance_ledger WHERE is_reimbursed = 0")
            row = cur.fetchone()
            return int(row[0]) if row else 0

    def reimburse_teacher_advance(self, account_type: str, date_str: str, voucher_no: str, amount_paise: int, mode: str = "CASH") -> int:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                UPDATE teacher_advance_ledger 
                SET is_reimbursed = 1, reimbursement_date = ?, reimbursement_voucher_no = ?
                WHERE is_reimbursed = 0
            """, (date_str, voucher_no))

            cash_p = amount_paise if mode == "CASH" else 0
            bank_p = amount_paise if mode == "BANK" else 0
            cur.execute("""
                INSERT INTO transaction_records 
                (account_type, entry_date, transaction_type, payment_mode, is_receipt, cash_paise, bank_paise, purpose_head, voucher_no)
                VALUES (?, ?, 'TEACHER_REIMBURSEMENT', ?, 0, ?, ?, 'Self-reimbursement to Head Teacher for MDM advance expenditure', ?)
            """, (account_type, date_str, mode, cash_p, bank_p, voucher_no))
            conn.commit()
            return cur.lastrowid

    # --- Financial Movements ---
    def record_grant_receipt(self, account_type: str, date_str: str, amount_paise: int,
                             purpose_head: str, mode: str = "BANK", ref_no: str = "") -> int:
        cash_p = amount_paise if mode == "CASH" else 0
        bank_p = amount_paise if mode == "BANK" else 0
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO transaction_records 
                (account_type, entry_date, transaction_type, payment_mode, is_receipt, cash_paise, bank_paise, purpose_head, ref_chq_no)
                VALUES (?, ?, 'GRANT_RECEIPT', ?, 1, ?, ?, ?, ?)
            """, (account_type, date_str, mode, cash_p, bank_p, purpose_head, ref_no))
            conn.commit()
            return cur.lastrowid

    def record_self_bank_withdrawal(self, account_type: str, date_str: str,
                                    amount_paise: int, chq_no: str) -> Tuple[int, int]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO transaction_records 
                (account_type, entry_date, transaction_type, payment_mode, is_receipt, cash_paise, bank_paise, purpose_head, ref_chq_no, is_contra)
                VALUES (?, ?, 'BANK_WITHDRAWAL', 'BANK', 0, 0, ?, 'Self Bank Withdrawal deposited into Cash Box', ?, 1)
            """, (account_type, date_str, amount_paise, chq_no))
            payment_id = cur.lastrowid

            cur.execute("""
                INSERT INTO transaction_records 
                (account_type, entry_date, transaction_type, payment_mode, is_receipt, cash_paise, bank_paise, purpose_head, ref_chq_no, is_contra)
                VALUES (?, ?, 'BANK_WITHDRAWAL', 'CASH', 1, ?, 0, 'Self Bank Withdrawal for school expenses', ?, 1)
            """, (account_type, date_str, amount_paise, chq_no))
            receipt_id = cur.lastrowid
            conn.commit()
            return payment_id, receipt_id

    # --- Flexible Attendance Entry (Batch & Multi-month) ---
    def record_batch_attendance(self, label: str, start_date_str: str, total_days: int, avg_children: int, level: str = "LP"):
        rates = self.get_mdm_rates()
        rate_paise = rates["lp_rate_paise"] if level == "LP" else rates["up_rate_paise"]
        grain_scale = rates["lp_grain_grams"] if level == "LP" else rates["up_grain_grams"]

        total_meals = total_days * avg_children
        total_cost_p = total_meals * rate_paise
        total_grain_g = total_meals * grain_scale

        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO mdm_daily_attendance 
                (entry_date, period_label, meals_served, cooking_rate_paise, cooking_cost_paise, scale_grams, grain_consumed_grams)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (start_date_str, label, total_meals, rate_paise, total_cost_p, grain_scale, total_grain_g))
            conn.commit()

    # --- Balances & Registers ---
    def get_monthly_balances(self, account_type: str, year: int, month: int) -> Dict[str, int]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM account_initialization WHERE account_type = ?", (account_type,))
            init_row = cur.fetchone()
            if not init_row:
                return {"opening_cash": 0, "opening_bank": 0, "month_in_cash": 0, "month_in_bank": 0,
                        "month_out_cash": 0, "month_out_bank": 0, "closing_cash": 0, "closing_bank": 0}

            start_dt = datetime(init_row["start_year"], init_row["start_month"], 1)
            target_dt = datetime(year, month, 1)

            cur.execute("""
                SELECT 
                    TOTAL(CASE WHEN is_receipt = 1 THEN cash_paise ELSE -cash_paise END) as net_cash,
                    TOTAL(CASE WHEN is_receipt = 1 THEN bank_paise ELSE -bank_paise END) as net_bank
                FROM transaction_records
                WHERE account_type = ? AND entry_date >= ? AND entry_date < ?
            """, (account_type, start_dt.strftime("%Y-%m-%d"), target_dt.strftime("%Y-%m-%d")))
            prior = cur.fetchone()

            opening_cash = init_row["opening_cash_paise"] + int(prior["net_cash"])
            opening_bank = init_row["opening_bank_paise"] + int(prior["net_bank"])

            next_m = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
            cur.execute("""
                SELECT 
                    TOTAL(CASE WHEN is_receipt = 1 THEN cash_paise ELSE 0 END) as in_cash,
                    TOTAL(CASE WHEN is_receipt = 1 THEN bank_paise ELSE 0 END) as in_bank,
                    TOTAL(CASE WHEN is_receipt = 0 THEN cash_paise ELSE 0 END) as out_cash,
                    TOTAL(CASE WHEN is_receipt = 0 THEN bank_paise ELSE 0 END) as out_bank
                FROM transaction_records
                WHERE account_type = ? AND entry_date >= ? AND entry_date < ?
            """, (account_type, target_dt.strftime("%Y-%m-%d"), next_m.strftime("%Y-%m-%d")))
            curr = cur.fetchone()

            in_cash = int(curr["in_cash"])
            in_bank = int(curr["in_bank"])
            out_cash = int(curr["out_cash"])
            out_bank = int(curr["out_bank"])

            return {
                "opening_cash": opening_cash,
                "opening_bank": opening_bank,
                "month_in_cash": in_cash,
                "month_in_bank": in_bank,
                "month_out_cash": out_cash,
                "month_out_bank": out_bank,
                "closing_cash": opening_cash + in_cash - out_cash,
                "closing_bank": opening_bank + in_bank - out_bank
            }

    def get_monthly_grain_summary(self, year: int, month: int) -> Dict[str, int]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM account_initialization WHERE account_type = 'MDM'")
            init_row = cur.fetchone()
            if not init_row:
                return {"opening_grams": 0, "received_grams": 0, "consumed_grams": 0, "closing_grams": 0}

            start_dt = datetime(init_row["start_year"], init_row["start_month"], 1)
            target_dt = datetime(year, month, 1)

            cur.execute("""
                SELECT 
                    (SELECT TOTAL(quantity_grams) FROM mdm_grain_receipts WHERE receipt_date >= ? AND receipt_date < ?) -
                    (SELECT TOTAL(grain_consumed_grams) FROM mdm_daily_attendance WHERE entry_date >= ? AND entry_date < ?) as prior_net
            """, (start_dt.strftime("%Y-%m-%d"), target_dt.strftime("%Y-%m-%d"),
                  start_dt.strftime("%Y-%m-%d"), target_dt.strftime("%Y-%m-%d")))
            prior_net = int(cur.fetchone()[0])
            opening_g = init_row["opening_grain_grams"] + prior_net

            next_m = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
            cur.execute("SELECT TOTAL(quantity_grams) FROM mdm_grain_receipts WHERE receipt_date >= ? AND receipt_date < ?",
                        (target_dt.strftime("%Y-%m-%d"), next_m.strftime("%Y-%m-%d")))
            month_rcvd = int(cur.fetchone()[0])

            cur.execute("SELECT TOTAL(grain_consumed_grams) FROM mdm_daily_attendance WHERE entry_date >= ? AND entry_date < ?",
                        (target_dt.strftime("%Y-%m-%d"), next_m.strftime("%Y-%m-%d")))
            month_cons = int(cur.fetchone()[0])

            return {
                "opening_grams": opening_g,
                "received_grams": month_rcvd,
                "consumed_grams": month_cons,
                "closing_grams": opening_g + month_rcvd - month_cons
            }

    def get_monthly_transactions(self, account_type: str, year: int, month: int) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        start_date = f"{year:04d}-{month:02d}-01"
        next_m_dt = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
        end_date = next_m_dt.strftime("%Y-%m-%d")

        receipts, payments = [], []
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT entry_date, purpose_head as particulars, voucher_no, ref_chq_no,
                       cash_paise, bank_paise, is_receipt, is_contra, is_teacher_advance
                FROM transaction_records
                WHERE account_type = ? AND entry_date >= ? AND entry_date < ?
                ORDER BY entry_date ASC, id ASC
            """, (account_type, start_date, end_date))

            for row in cur.fetchall():
                d = dict(row)
                if d['is_receipt'] == 1:
                    receipts.append(d)
                else:
                    payments.append(d)

        return receipts, payments

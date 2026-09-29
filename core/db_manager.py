import sqlite3
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from core.currency import CurrencyEngine

DB_NAME = "cashbook.db"
CURRENT_DB_VERSION = 1


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
                    cluster_block TEXT,
                    district TEXT,
                    device_uid TEXT NOT NULL,
                    master_pin_hash TEXT NOT NULL,
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

                CREATE TABLE IF NOT EXISTS mdm_cooking_rates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT NOT NULL,
                    rate_paise INTEGER NOT NULL,
                    effective_from TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS mdm_grain_scales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT NOT NULL,
                    grams_per_child INTEGER NOT NULL,
                    effective_from TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS academic_calendar (
                    holiday_date TEXT PRIMARY KEY,
                    occasion TEXT NOT NULL,
                    is_gazetted INTEGER NOT NULL DEFAULT 1
                );

                CREATE TABLE IF NOT EXISTS mdm_daily_attendance (
                    entry_date TEXT PRIMARY KEY,
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

                CREATE TABLE IF NOT EXISTS mdm_grain_adjustments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    adj_date TEXT NOT NULL,
                    quantity_grams INTEGER NOT NULL,
                    reason TEXT NOT NULL
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
                    contra_pair_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS licensing (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    udise_code TEXT NOT NULL,
                    trial_start_month TEXT NOT NULL,
                    is_paid INTEGER NOT NULL DEFAULT 0,
                    license_key TEXT,
                    activated_at TIMESTAMP
                );
                """)
                cur.execute(f"PRAGMA user_version = {CURRENT_DB_VERSION};")
                conn.commit()

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

    def record_voucher_expense(self, account_type: str, date_str: str, voucher_no: str,
                               amount_paise: int, purpose_head: str, mode: str = "CASH") -> int:
        cash_p = amount_paise if mode == "CASH" else 0
        bank_p = amount_paise if mode == "BANK" else 0

        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO transaction_records 
                (account_type, entry_date, transaction_type, payment_mode, is_receipt, cash_paise, bank_paise, purpose_head, voucher_no)
                VALUES (?, ?, 'EXPENSE', ?, 0, ?, ?, ?, ?)
            """, (account_type, date_str, mode, cash_p, bank_p, purpose_head, voucher_no))
            conn.commit()
            return cur.lastrowid

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
                (account_type, entry_date, transaction_type, payment_mode, is_receipt, cash_paise, bank_paise, purpose_head, ref_chq_no, is_contra, contra_pair_id)
                VALUES (?, ?, 'BANK_WITHDRAWAL', 'CASH', 1, ?, 0, 'Self Bank Withdrawal for school expenses', ?, 1, ?)
            """, (account_type, date_str, amount_paise, chq_no, payment_id))
            receipt_id = cur.lastrowid

            cur.execute("UPDATE transaction_records SET contra_pair_id = ? WHERE id = ?", (receipt_id, payment_id))
            conn.commit()
            return payment_id, receipt_id

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

            if target_dt < start_dt:
                return {"opening_cash": 0, "opening_bank": 0, "month_in_cash": 0, "month_in_bank": 0,
                        "month_out_cash": 0, "month_out_bank": 0, "closing_cash": 0, "closing_bank": 0}

            cur.execute("""
                SELECT 
                    TOTAL(CASE WHEN is_receipt = 1 THEN cash_paise ELSE -cash_paise END) as net_cash,
                    TOTAL(CASE WHEN is_receipt = 1 THEN bank_paise ELSE -bank_paise END) as net_bank
                FROM transaction_records
                WHERE account_type = ? 
                  AND entry_date >= ? 
                  AND entry_date < ?
            """, (account_type, start_dt.strftime("%Y-%m-%d"), target_dt.strftime("%Y-%m-%d")))
            prior_row = cur.fetchone()

            opening_cash = init_row["opening_cash_paise"] + int(prior_row["net_cash"])
            opening_bank = init_row["opening_bank_paise"] + int(prior_row["net_bank"])

            first_day_curr = target_dt.strftime("%Y-%m-%d")
            next_month_dt = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
            first_day_next = next_month_dt.strftime("%Y-%m-%d")

            cur.execute("""
                SELECT 
                    TOTAL(CASE WHEN is_receipt = 1 THEN cash_paise ELSE 0 END) as in_cash,
                    TOTAL(CASE WHEN is_receipt = 1 THEN bank_paise ELSE 0 END) as in_bank,
                    TOTAL(CASE WHEN is_receipt = 0 THEN cash_paise ELSE 0 END) as out_cash,
                    TOTAL(CASE WHEN is_receipt = 0 THEN bank_paise ELSE 0 END) as out_bank
                FROM transaction_records
                WHERE account_type = ? 
                  AND entry_date >= ? 
                  AND entry_date < ?
            """, (account_type, first_day_curr, first_day_next))
            curr_row = cur.fetchone()

            in_cash = int(curr_row["in_cash"])
            in_bank = int(curr_row["in_bank"])
            out_cash = int(curr_row["out_cash"])
            out_bank = int(curr_row["out_bank"])

            closing_cash = opening_cash + in_cash - out_cash
            closing_bank = opening_bank + in_bank - out_bank

            return {
                "opening_cash": opening_cash,
                "opening_bank": opening_bank,
                "month_in_cash": in_cash,
                "month_in_bank": in_bank,
                "month_out_cash": out_cash,
                "month_out_bank": out_bank,
                "closing_cash": closing_cash,
                "closing_bank": closing_bank
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
                    (SELECT TOTAL(grain_consumed_grams) FROM mdm_daily_attendance WHERE entry_date >= ? AND entry_date < ?) -
                    (SELECT TOTAL(quantity_grams) FROM mdm_grain_adjustments WHERE adj_date >= ? AND adj_date < ?) as prior_net
            """, (start_dt.strftime("%Y-%m-%d"), target_dt.strftime("%Y-%m-%d"),
                  start_dt.strftime("%Y-%m-%d"), target_dt.strftime("%Y-%m-%d"),
                  start_dt.strftime("%Y-%m-%d"), target_dt.strftime("%Y-%m-%d")))
            prior_net = int(cur.fetchone()[0])
            opening_grams = init_row["opening_grain_grams"] + prior_net

            first_day_curr = target_dt.strftime("%Y-%m-%d")
            next_month_dt = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
            first_day_next = next_month_dt.strftime("%Y-%m-%d")

            cur.execute("SELECT TOTAL(quantity_grams) FROM mdm_grain_receipts WHERE receipt_date >= ? AND receipt_date < ?",
                        (first_day_curr, first_day_next))
            month_rcvd = int(cur.fetchone()[0])

            cur.execute("SELECT TOTAL(grain_consumed_grams) FROM mdm_daily_attendance WHERE entry_date >= ? AND entry_date < ?",
                        (first_day_curr, first_day_next))
            month_consumed = int(cur.fetchone()[0])

            cur.execute("SELECT TOTAL(quantity_grams) FROM mdm_grain_adjustments WHERE adj_date >= ? AND adj_date < ?",
                        (first_day_curr, first_day_next))
            month_adjusted = int(cur.fetchone()[0])

            closing_grams = opening_grams + month_rcvd - month_consumed - month_adjusted

            return {
                "opening_grams": opening_grams,
                "received_grams": month_rcvd,
                "consumed_grams": month_consumed,
                "adjusted_grams": month_adjusted,
                "closing_grams": closing_grams
                                 }
          

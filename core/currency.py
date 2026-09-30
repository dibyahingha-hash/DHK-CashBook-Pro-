import re
from typing import Tuple

class CurrencyEngine:
    @staticmethod
    def parse_to_paise(val) -> int:
        if val is None:
            return 0
        s = str(val).strip()
        # Remove currency symbol, commas, and whitespace
        s = re.sub(r'[^\d.-]', '', s)
        if not s or s == '-' or s == '.':
            return 0
        try:
            val_float = float(s)
            # Round properly to nearest integer paise
            return int(round(val_float * 100))
        except (ValueError, TypeError):
            return 0

    @staticmethod
    def paise_to_rupees_str(paise: int) -> str:
        if paise is None:
            paise = 0
        is_negative = paise < 0
        paise = abs(int(paise))

        rupees = paise // 100
        rem_paise = paise % 100

        # Indian Numbering Format (e.g. 1,00,000.00)
        s = str(rupees)
        if len(s) > 3:
            last_three = s[-3:]
            remaining = s[:-3]
            groups = []
            while len(remaining) > 2:
                groups.insert(0, remaining[-2:])
                remaining = remaining[:-2]
            if remaining:
                groups.insert(0, remaining)
            formatted_rupees = ",".join(groups) + "," + last_three
        else:
            formatted_rupees = s

        sign = "-" if is_negative else ""
        return f"{sign}₹ {formatted_rupees}.{rem_paise:02d}"

    @staticmethod
    def format_for_register(paise: int) -> Tuple[str, str]:
        """Splits paise into formatted (Rupees_str, Paise_str) for register table columns."""
        if paise is None:
            paise = 0
        is_negative = paise < 0
        paise = abs(int(paise))

        rupees = paise // 100
        rem_paise = paise % 100

        s = str(rupees)
        if len(s) > 3:
            last_three = s[-3:]
            remaining = s[:-3]
            groups = []
            while len(remaining) > 2:
                groups.insert(0, remaining[-2:])
                remaining = remaining[:-2]
            if remaining:
                groups.insert(0, remaining)
            formatted_rupees = ",".join(groups) + "," + last_three
        else:
            formatted_rupees = s

        sign = "-" if is_negative else ""
        return f"{sign}{formatted_rupees}", f"{rem_paise:02d}"

    @staticmethod
    def format_inr(paise: int, show_symbol: bool = True) -> str:
        s = CurrencyEngine.paise_to_rupees_str(paise)
        if not show_symbol:
            return s.replace("₹ ", "").strip()
        return s

    @staticmethod
    def in_words_inr(paise: int) -> str:
        """Converts integer paise into standard Indian financial English words."""
        if paise is None or paise == 0:
            return "Zero Rupees Only"

        units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
                 "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
                 "Seventeen", "Eighteen", "Nineteen"]
        tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

        def num_to_words(n: int) -> str:
            if n == 0:
                return ""
            elif n < 20:
                return units[n] + " "
            elif n < 100:
                return tens[n // 10] + (" " + units[n % 10] if n % 10 != 0 else "") + " "
            elif n < 1000:
                return units[n // 100] + " Hundred " + (num_to_words(n % 100) if n % 100 != 0 else "")
            elif n < 100000:
                return num_to_words(n // 1000) + "Thousand " + (num_to_words(n % 1000) if n % 1000 != 0 else "")
            elif n < 10000000:
                return num_to_words(n // 100000) + "Lakh " + (num_to_words(n % 100000) if n % 100000 != 0 else "")
            else:
                return num_to_words(n // 10000000) + "Crore " + (num_to_words(n % 10000000) if n % 10000000 != 0 else "")

        is_neg = paise < 0
        paise = abs(int(paise))
        rupees = paise // 100
        rem_p = paise % 100

        parts = []
        if is_neg:
            parts.append("Minus")

        if rupees > 0:
            parts.append(num_to_words(rupees).strip() + " Rupees")

        if rem_p > 0:
            if rupees > 0:
                parts.append("and")
            parts.append(num_to_words(rem_p).strip() + " Paise")

        parts.append("Only")
        return " ".join(parts).strip()

"""
dhk_cashbook/core/currency.py

Core Mathematical & Precision Arithmetic Engine for DHK CashBook Pro.
Strictly eliminates IEEE-754 floating-point drift by operating purely
on 64-bit integer paise (1 INR = 100 paise).
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Tuple, Union


class CurrencyEngine:
    """Immutable, zero-loss currency handler for school accounting."""

    @staticmethod
    def parse_to_paise(val: Union[str, int, float, Decimal]) -> int:
        """
        Safely converts any user input (string, int, float, or Decimal)
        into exact integer paise.
        
        Examples:
            "450.50"  -> 45050
            "6.78"    -> 678
            500       -> 50000
            "0.05"    -> 5
        """
        if val is None or val == "":
            return 0

        # Clean string inputs (remove currency symbols, commas, spaces)
        if isinstance(val, str):
            clean_str = val.replace("₹", "").replace(",", "").strip()
            if not clean_str:
                return 0
            d = Decimal(clean_str)
        elif isinstance(val, float):
            d = Decimal(str(val))
        elif isinstance(val, int):
            return val * 100
        elif isinstance(val, Decimal):
            d = val
        else:
            raise TypeError(f"Unsupported currency type: {type(val)}")

        # Quantize to 2 decimal places with strict Half-Up rounding
        paise_decimal = (d * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        return int(paise_decimal)

    @staticmethod
    def split_rs_paise(paise: int) -> Tuple[int, int]:
        """
        Splits total paise into separate (Rupees, Paise) for the 2-column printout.
        Handles negative figures correctly if an overdraft check is inspected.
        """
        sign = -1 if paise < 0 else 1
        abs_p = abs(paise)
        rupees = (abs_p // 100) * sign
        rem_paise = abs_p % 100
        return rupees, rem_paise

    @staticmethod
    def format_inr(paise: int, show_symbol: bool = False) -> str:
        """
        Formats integer paise into standard Indian numbering system:
        e.g., 12500750 paise -> '1,25,007.50' or '₹ 1,25,007.50'
        """
        is_negative = paise < 0
        abs_paise = abs(paise)
        rupees = abs_paise // 100
        rem_paise = abs_paise % 100

        rs_str = str(rupees)

        # Standard Indian numbering comma grouping (3, 2, 2...)
        if len(rs_str) <= 3:
            formatted_rs = rs_str
        else:
            last_three = rs_str[-3:]
            remaining = rs_str[:-3]
            groups = []
            while len(remaining) > 2:
                groups.insert(0, remaining[-2:])
                remaining = remaining[:-2]
            if remaining:
                groups.insert(0, remaining)
            formatted_rs = ",".join(groups) + "," + last_three

        formatted_str = f"{formatted_rs}.{rem_paise:02d}"
        if is_negative:
            formatted_str = f"-{formatted_str}"

        return f"₹ {formatted_str}" if show_symbol else formatted_str

    @staticmethod
    def format_for_register(paise: int) -> Tuple[str, str]:
        """
        Returns a tuple of strings (Rupees, Paise) ready to plug into the
        physical cash book columns:
        Example: 542050 -> ("5,420", "50")
                 0      -> ("—", "—")
        """
        if paise == 0:
            return "—", "—"

        rupees, p = CurrencyEngine.split_rs_paise(paise)
        formatted_rs = CurrencyEngine.format_inr(rupees * 100).split(".")[0]
        return formatted_rs, f"{p:02d}"

    @staticmethod
    def in_words_inr(paise: int) -> str:
        """
        Converts integer paise into formal accounting certificate words:
        e.g., 142550 -> 'Rupees One Thousand Four Hundred Twenty-Five and Fifty Paise only'
        """
        if paise == 0:
            return "Rupees Zero only"

        ones = [
            "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
            "Seventeen", "Eighteen", "Nineteen"
        ]
        tens = [
            "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
        ]

        def _two_digits(n: int) -> str:
            if n == 0:
                return ""
            if n < 20:
                return ones[n]
            t = tens[n // 10]
            o = ones[n % 10]
            return f"{t} {o}".strip()

        def _three_digits(n: int) -> str:
            h = n // 100
            rem = n % 100
            if h > 0 and rem > 0:
                return f"{ones[h]} Hundred {_two_digits(rem)}"
            if h > 0:
                return f"{ones[h]} Hundred"
            return _two_digits(rem)

        abs_p = abs(paise)
        rupees = abs_p // 100
        rem_paise = abs_p % 100

        words = []

        crore = rupees // 10000000
        rupees %= 10000000

        lakh = rupees // 100000
        rupees %= 100000

        thousand = rupees // 1000
        rupees %= 1000

        hundreds = rupees

        if crore > 0:
            words.append(f"{_two_digits(crore)} Crore")
        if lakh > 0:
            words.append(f"{_two_digits(lakh)} Lakh")
        if thousand > 0:
            words.append(f"{_two_digits(thousand)} Thousand")
        if hundreds > 0:
            words.append(_three_digits(hundreds))

        rs_text = " ".join(words).strip()
        if not rs_text:
            rs_text = "Zero"

        prefix = "Rupees " + rs_text

        if rem_paise > 0:
            p_text = _two_digits(rem_paise)
            return f"{prefix} and {p_text} Paise only"
        return f"{prefix} only"


# =====================================================================
# Unit Validation Suite (Self-Test)
# =====================================================================
if __name__ == "__main__":
    ce = CurrencyEngine

    # Test 1: Float Drift Elimination
    p1 = ce.parse_to_paise("6.78")  # MDM LP Rate
    p2 = ce.parse_to_paise("10.17") # MDM UP Rate
    assert p1 == 678
    assert p2 == 1017

    # 45 meals calculation verification
    daily_cost_paise = 45 * p1
    assert daily_cost_paise == 30510  # 45 * 678 = 30,510 paise = Rs. 305.10

    # Test 2: Indian Lakhs/Crores Comma Formatting
    assert ce.format_inr(125000) == "1,250.00"
    assert ce.format_inr(15042075) == "1,50,420.75"
    assert ce.format_inr(1000000000) == "1,00,00,000.00"

    # Test 3: Dual Column Register Splitting
    rs_col, p_col = ce.format_for_register(542050)
    assert rs_col == "5,420"
    assert p_col == "50"

    # Test 4: Certificate in Words Conversion
    assert ce.in_words_inr(125000) == "Rupees One Thousand Two Hundred Fifty only"
    assert ce.in_words_inr(30510) == "Rupees Three Hundred Five and Ten Paise only"
    assert ce.in_words_inr(843050) == "Rupees Eight Thousand Four Hundred Thirty and Fifty Paise only"

    print("All Phase 1 Currency Engine tests passed with 100% precision.")
          

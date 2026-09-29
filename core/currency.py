from decimal import Decimal, ROUND_HALF_UP
from typing import Tuple, Union


class CurrencyEngine:
    @staticmethod
    def parse_to_paise(val: Union[str, int, float, Decimal]) -> int:
        if val is None or val == "":
            return 0
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
        paise_decimal = (d * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        return int(paise_decimal)

    @staticmethod
    def split_rs_paise(paise: int) -> Tuple[int, int]:
        sign = -1 if paise < 0 else 1
        abs_p = abs(paise)
        rupees = (abs_p // 100) * sign
        rem_paise = abs_p % 100
        return rupees, rem_paise

    @staticmethod
    def format_inr(paise: int, show_symbol: bool = False) -> str:
        is_negative = paise < 0
        abs_paise = abs(paise)
        rupees = abs_paise // 100
        rem_paise = abs_paise % 100

        rs_str = str(rupees)
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
        if paise == 0:
            return "—", "—"
        rupees, p = CurrencyEngine.split_rs_paise(paise)
        formatted_rs = CurrencyEngine.format_inr(rupees * 100).split(".")[0]
        return formatted_rs, f"{p:02d}"

    @staticmethod
    def in_words_inr(paise: int) -> str:
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

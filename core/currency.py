import re

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
            # Group in sets of two digits
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

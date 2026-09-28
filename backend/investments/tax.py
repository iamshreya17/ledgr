from datetime import date
from decimal import Decimal

from django.utils import timezone


def calculate_tax_estimate(investment, as_of=None):
    """Illustrative sale-today estimate. Asset subtypes, deductions and yearly totals are unknown."""
    as_of = as_of or timezone.localdate()
    days = max(0, (as_of - investment.purchase_date).days)
    gain = max(investment.current_value - investment.purchase_price, Decimal("0"))
    kind = investment.type
    equity = kind in ("STOCK", "MUTUAL_FUND")
    property_or_gold = kind in ("GOLD", "REAL_ESTATE")
    classification = "LONG_TERM" if days > (365 if equity else 730) else "SHORT_TERM"
    tax = None
    if kind == "CRYPTO":
        classification = "NOT_APPLICABLE"
        tax = gain * Decimal("0.30")
        note = "Virtual digital asset gain estimated at 30%; no loss set-off. Cess, surcharge and TDS are excluded."
    elif equity:
        if classification == "LONG_TERM":
            tax = max(gain - Decimal("125000"), Decimal("0")) * Decimal("0.125")
            note = "Assumes listed equity or equity-oriented mutual fund with STT paid. ₹1,25,000 annual LTCG threshold is applied to this investment alone; other sales can exhaust it."
        else:
            tax = gain * Decimal("0.20")
            note = "Assumes listed equity or equity-oriented mutual fund with STT paid. Estimated short-term rate is 20%."
    elif property_or_gold:
        if classification == "LONG_TERM":
            tax = gain * Decimal("0.125")
            note = "Estimated long-term rate is 12.5% without indexation. Property acquired before 23 July 2024 may have a different beneficial option."
        else:
            note = "Short-term gain is generally taxed at your income tax slab rate, which is unknown."
    else:
        note = "Asset tax treatment depends on its exact subtype and your income tax slab. No reliable amount can be estimated from the recorded fields."
    return {
        "holding_period_days": days,
        "classification": classification,
        "estimated_tax": str(tax.quantize(Decimal("0.01"))) if tax is not None else None,
        "note": note + " This ignores cess, surcharge, exemptions, acquisition costs and other transactions.",
    }

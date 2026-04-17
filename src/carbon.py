# src/carbon.py
"""
Carbon footprint calculator module.

This is a simple, configurable calculator that converts fertilizer quantities to CO2-eq
using per-kg emission factors (manufacturing + upstream). Factors are placeholders:
replace with authoritative IPCC or lifecycle assessment values before production use.
"""

from typing import Dict

# Example factors (kg CO2e per kg of fertilizer nutrient)
# NOTE: These are illustrative. Replace with domain-verified numbers for production.
DEFAULT_EMISSION_FACTORS = {
    "N": 6.7,   # e.g., kgCO2e per kg of N (manufacturing + supply chain) — placeholder
    "P": 1.1,   # kgCO2e per kg P
    "K": 0.9    # kgCO2e per kg K
}

def compute_co2eq_from_npk(n_kg: float, p_kg: float, k_kg: float, factors: Dict[str, float]=None) -> float:
    """
    Compute total CO2-eq per hectare for given N, P, K (kg/ha).
    Returns total kgCO2e/ha.
    """
    if factors is None:
        factors = DEFAULT_EMISSION_FACTORS
    total = (n_kg * factors.get("N", 0.0)) + (p_kg * factors.get("P", 0.0)) + (k_kg * factors.get("K", 0.0))
    return float(total)

def co2eq_savings(baseline: Dict[str, float], optimized: Dict[str, float], factors: Dict[str, float]=None) -> float:
    """
    Compute savings (baseline - optimized) in kgCO2e/ha
    baseline and optimized are dicts with keys 'N','P','K' (kg/ha)
    """
    base = compute_co2eq_from_npk(baseline["N"], baseline["P"], baseline["K"], factors)
    opt = compute_co2eq_from_npk(optimized["N"], optimized["P"], optimized["K"], factors)
    return float(base - opt)

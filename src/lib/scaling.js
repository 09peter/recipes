export const MULTIPLIERS = [0.5, 1, 2, 3, 4];

/**
 * Scale one ingredient per PRD §6.
 * Returns a display string for the amount+unit, or null if there's nothing
 * numeric to show (non-scalable "to taste" items show their note instead).
 */
export function scaledAmount(ing, multiplier) {
  if (ing.amount == null) return null;

  const amount = ing.scalable ? ing.amount * multiplier : ing.amount;

  if (ing.unit == null) {
    // Whole-count items (eggs, cloves): nearest sensible half
    const rounded = Math.round(amount * 2) / 2;
    return formatNumber(rounded);
  }

  // Weight/volume: 1 decimal place
  const rounded = Math.round(amount * 10) / 10;
  return `${formatNumber(rounded)} ${ing.unit}`;
}

function formatNumber(n) {
  // Values arrive pre-rounded to at most one decimal; drop trailing ".0"
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Round to 2 decimal places (half away from zero), avoiding floating-point drift like 0.1 + 0.2. */
export function roundMoney(value: number): number {
  return Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100;
}

/** percent of amount, rounded to money precision. */
export function percentOf(amount: number, percent: number): number {
  return roundMoney((amount * percent) / 100);
}

export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((total, v) => total + v, 0));
}

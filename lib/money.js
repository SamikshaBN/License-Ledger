// All money in LicenseLedger is shown in Indian rupees with Indian digit grouping (e.g. ₹1,23,456.00).
export const inr = (n) =>
  Number(n ?? 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

// One place for money formatting: Indian rupees with lakh/crore grouping (for example ₹1,23,456.00)
export const money = (n) =>
  Number(n ?? 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

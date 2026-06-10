// Indian-format amount-to-words for tax invoices (Rupees / Paise, lakh / crore).

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ' ' + ONES[o] : '');
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let s = '';
  if (h) s += ONES[h] + ' Hundred';
  if (r) s += (h ? ' ' : '') + twoDigits(r);
  return s;
}

function intToWords(num: number): string {
  if (num === 0) return 'Zero';
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  const hundred = num % 1000;
  const parts: string[] = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh) parts.push(twoDigits(lakh) + ' Lakh');
  if (thousand) parts.push(threeDigits(thousand) + ' Thousand');
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(' ').trim();
}

/** "Rupees One Thousand Two Hundred and Fifty Paise Only" */
export function rupeesInWords(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.abs(amount) : 0;
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);
  let s = 'Rupees ' + (intToWords(rupees) || 'Zero');
  if (paise) s += ' and ' + twoDigits(paise) + ' Paise';
  return s + ' Only';
}

import { parsePublicMoney } from '../services/scraper/PublicRecordParsing.js';
export function recordMoney(value: string): number {
  if (!value.trim()) return 0;
  const cents = parsePublicMoney(value);
  if (cents === null || cents > 2147483647) throw new Error('Invalid or out-of-range money value');
  return cents;
}
export function recordDate(value: string): Date | null {
  if (!value.trim()) return null;
  let year: number, month: number, day: number;
  let match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) [,year,month,day] = match.map(Number);
  else {
    match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!match) throw new Error('Ambiguous or invalid record date');
    [,month,day,year] = match.map(Number);
  }
  const date = new Date(Date.UTC(year,month-1,day));
  if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month-1 || date.getUTCDate() !== day) throw new Error('Invalid calendar date');
  return date;
}

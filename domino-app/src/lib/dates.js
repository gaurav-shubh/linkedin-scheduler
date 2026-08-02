const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n) {
  return String(n).padStart(2, '0');
}

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return d;
}

function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThursday) / DAY_MS - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function weekKey(date = new Date()) {
  const { year, week } = isoWeekNumber(date);
  return `${year}-W${pad(week)}`;
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function yearKey(date = new Date()) {
  return `${date.getFullYear()}`;
}

export function weekRangeLabel(key) {
  const [yearStr, weekStr] = key.split('-W');
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4 = new Date(year, 0, 4);
  const start = addDays(jan4, (week - 1) * 7 - ((jan4.getDay() + 6) % 7));
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = `${MONTH_NAMES[start.getMonth()].slice(0, 3)} ${start.getDate()}`;
  const endLabel = sameMonth ? `${end.getDate()}` : `${MONTH_NAMES[end.getMonth()].slice(0, 3)} ${end.getDate()}`;
  return `${startLabel} – ${endLabel}`;
}

export function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function friendlyDate(key) {
  const d = parseDateKey(key);
  return `${WEEKDAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function isToday(key) {
  return key === dateKey();
}

export function daysInMonth(monthKeyStr) {
  const [year, month] = monthKeyStr.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

export { MONTH_NAMES, WEEKDAY_NAMES };

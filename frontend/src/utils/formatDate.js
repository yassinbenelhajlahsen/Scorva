function formatDate(input) {
  if (!input) return "Unknown";

  let date;

  // Match D/M/YYYY or DD/MM/YYYY (treat slash format as day/month/year)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(input)) {
    const [day, month, year] = input.split("/").map(Number);
    date = new Date(Date.UTC(year, month - 1, day));
  }
  // Match YYYY-M-D or YYYY-MM-DD (treat dash format as year-month-day)
  else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(input)) {
    const [year, month, day] = input.split("-").map(Number);
    date = new Date(Date.UTC(year, month - 1, day));
  } else {
    // Fallback: let engine parse, then re‐build a UTC date to avoid timezone shift
    const parsed = new Date(input);
    if (isNaN(parsed.getTime())) return "Invalid date";
    const y = parsed.getUTCFullYear();
    const m = parsed.getUTCMonth();
    const d = parsed.getUTCDate();
    date = new Date(Date.UTC(y, m, d));
  }

  if (isNaN(date.getTime())) return "Invalid date";

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const utcDay = date.getUTCDate();
  const utcMonthName = monthNames[date.getUTCMonth()];
  const utcYear = date.getUTCFullYear();

  const suffix =
    utcDay % 10 === 1 && utcDay !== 11
      ? "st"
      : utcDay % 10 === 2 && utcDay !== 12
        ? "nd"
        : utcDay % 10 === 3 && utcDay !== 13
          ? "rd"
          : "th";

  return `${utcMonthName} ${utcDay}${suffix}, ${utcYear}`;
}

export function formatDateShort(input) {
  if (!input) return "Unknown";

  let date;

  // Match D/M/YYYY or DD/MM/YYYY (treat slash format as day/month/year)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(input)) {
    const [day, month, year] = input.split("/").map(Number);
    date = new Date(Date.UTC(year, month - 1, day));
  }
  // Match YYYY-M-D or YYYY-MM-DD (treat dash format as year-month-day)
  else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(input)) {
    const [year, month, day] = input.split("-").map(Number);
    date = new Date(Date.UTC(year, month - 1, day));
  } else {
    // Fallback: let engine parse, then re‐build a UTC date to avoid timezone shift
    const parsed = new Date(input);
    if (isNaN(parsed.getTime())) return "Invalid date";
    const y = parsed.getUTCFullYear();
    const m = parsed.getUTCMonth();
    const d = parsed.getUTCDate();
    date = new Date(Date.UTC(y, m, d));
  }

  if (isNaN(date.getTime())) return "Invalid date";

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const utcDay = date.getUTCDate();
  const utcMonthName = monthNames[date.getUTCMonth()];

  const suffix =
    utcDay % 10 === 1 && utcDay !== 11
      ? "st"
      : utcDay % 10 === 2 && utcDay !== 12
        ? "nd"
        : utcDay % 10 === 3 && utcDay !== 13
          ? "rd"
          : "th";

  return `${utcMonthName} ${utcDay}${suffix}`;
}

export function getPeriodLabel(period, league) {
  if (!period) return "";
  const prefix = league === "nhl" ? "P" : "Q";
  const maxRegular = league === "nhl" ? 3 : 4;
  if (period <= maxRegular) return `${prefix}${period}`;
  return "OT" + (period > maxRegular + 1 ? period - maxRegular : "");
}

export function formatDateShortWithTime(dateInput, startTime) {
  const date = formatDateShort(dateInput);
  if (!startTime) return date;
  return `${date} @ ${startTime}`;
}

export function formatDateWithTime(dateInput, startTime) {
  const date = formatDate(dateInput);
  if (!startTime) return date;
  return `${date} @ ${startTime}`;
}

export default formatDate;

export function parseUTC(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toUTCDateString(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getTodayET() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function addDays(dateStr, n) {
  const d = parseUTC(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return toUTCDateString(d);
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

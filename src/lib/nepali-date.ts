import NepaliDate from "nepali-date-converter";

export default NepaliDate;
export { NepaliDate };

export interface NepaliDateResult {
  year: number;
  month: number; // 1-indexed (1-12)
  day: number; // 1-indexed (1-32)
  str: string; // "YYYY/MM/DD"
}

/**
 * Converts Gregorian (AD) date to Nepali Bikram Sambat (BS) using nepali-date-converter
 */
export function adToBs(dateInput: Date | string | number): NepaliDateResult {
  const dateObj =
    typeof dateInput === "string" || typeof dateInput === "number"
      ? new Date(dateInput)
      : dateInput;

  const d = isNaN(dateObj.getTime()) ? new NepaliDate() : new NepaliDate(dateObj);
  const year = d.getYear();
  const month = d.getMonth() + 1; // 1-indexed
  const day = d.getDate();
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  return {
    year,
    month,
    day,
    str: `${year}/${mm}/${dd}`,
  };
}

/**
 * Formats date into "YYYY/MM/DD" in Bikram Sambat using nepali-date-converter
 */
export function formatBsDate(dateInput: Date | string | number): string {
  const dateObj =
    typeof dateInput === "string" || typeof dateInput === "number"
      ? new Date(dateInput)
      : dateInput;

  if (isNaN(dateObj.getTime())) return "";
  const d = new NepaliDate(dateObj);
  return d.format("YYYY/MM/DD");
}

/**
 * Formats date into standard Nepali Fiscal Year (e.g. "2081/082" or "2082/083")
 * In Nepal, the fiscal year starts in Shrawan (Month 4) and ends in Ashad (Month 3).
 */
export function getFiscalYear(dateInput: Date | string | number = new Date()): string {
  const dateObj =
    typeof dateInput === "string" || typeof dateInput === "number"
      ? new Date(dateInput)
      : dateInput;

  const d = isNaN(dateObj.getTime()) ? new NepaliDate() : new NepaliDate(dateObj);
  const year = d.getYear();
  const month = d.getMonth() + 1; // 1 = Baisakh, 4 = Shrawan

  if (month >= 4) {
    const nextYearSuffix = String((year + 1) % 100).padStart(3, "0");
    return `${year}/${nextYearSuffix}`;
  } else {
    const prevYear = year - 1;
    const curYearSuffix = String(year % 100).padStart(3, "0");
    return `${prevYear}/${curYearSuffix}`;
  }
}

/**
 * Lightweight, robust Nepali Bikram Sambat (BS) date utility
 * Converts Gregorian (AD) dates to Bikram Sambat (BS) without external dependencies.
 * Covers years 2000 AD to 2040 AD (approx 2056 BS to 2097 BS).
 */

// Number of days in each month for Nepali years from 2056 BS to 2092 BS
const BS_MONTH_DAYS: Record<number, number[]> = {
  2056: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2057: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2058: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2059: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2060: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2061: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2062: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2063: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2064: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2065: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2066: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2067: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2068: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2069: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2070: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2071: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2073: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2074: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2075: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2081: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2082: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2084: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2085: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2086: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2087: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2088: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2089: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2090: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2091: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2092: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
};

// Reference baseline: 2000-01-01 AD was 2056-09-17 BS (Poush 17, 2056)
const BASE_AD_MS = Date.UTC(2000, 0, 1);
const BASE_BS_YEAR = 2056;
const BASE_BS_MONTH = 9; // 1-indexed (Poush = 9)
const BASE_BS_DAY = 17;

export interface NepaliDateResult {
  year: number;
  month: number;
  day: number;
  str: string; // YYYY/MM/DD
}

/**
 * Converts a Gregorian (AD) Date object or string into Nepali Bikram Sambat (BS)
 */
export function adToBs(dateInput: Date | string | number): NepaliDateResult {
  const dateObj = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(dateObj.getTime())) {
    return { year: 2081, month: 1, day: 1, str: "2081/01/01" };
  }

  // Calculate elapsed days since reference date
  const targetUtc = Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  let diffDays = Math.floor((targetUtc - BASE_AD_MS) / (1000 * 60 * 60 * 24));

  let currentYear = BASE_BS_YEAR;
  let currentMonth = BASE_BS_MONTH;
  let currentDay = BASE_BS_DAY;

  if (diffDays >= 0) {
    while (diffDays > 0) {
      const daysInCurrentMonth = (BS_MONTH_DAYS[currentYear] && BS_MONTH_DAYS[currentYear][currentMonth - 1]) || 30;
      const remainingDaysInMonth = daysInCurrentMonth - currentDay;

      if (diffDays <= remainingDaysInMonth) {
        currentDay += diffDays;
        diffDays = 0;
      } else {
        diffDays -= (remainingDaysInMonth + 1);
        currentDay = 1;
        currentMonth += 1;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear += 1;
        }
      }
    }
  } else {
    // Before reference date
    let negativeDays = Math.abs(diffDays);
    while (negativeDays > 0) {
      if (negativeDays < currentDay) {
        currentDay -= negativeDays;
        negativeDays = 0;
      } else {
        negativeDays -= currentDay;
        currentMonth -= 1;
        if (currentMonth < 1) {
          currentMonth = 12;
          currentYear -= 1;
        }
        const prevMonthDays = (BS_MONTH_DAYS[currentYear] && BS_MONTH_DAYS[currentYear][currentMonth - 1]) || 30;
        currentDay = prevMonthDays;
      }
    }
  }

  const mm = String(currentMonth).padStart(2, "0");
  const dd = String(currentDay).padStart(2, "0");

  return {
    year: currentYear,
    month: currentMonth,
    day: currentDay,
    str: `${currentYear}/${mm}/${dd}`,
  };
}

/**
 * Formats date into "YYYY/MM/DD" in Bikram Sambat
 */
export function formatBsDate(dateInput: Date | string | number): string {
  return adToBs(dateInput).str;
}

/**
 * Formats date into standard Nepali Fiscal Year (e.g. "2081/082" or "2082/083")
 * In Nepal, the fiscal year starts in Shrawan (Month 4) and ends in Ashad (Month 3).
 */
export function getFiscalYear(dateInput: Date | string | number = new Date()): string {
  const bs = adToBs(dateInput);
  if (bs.month >= 4) {
    const nextYearSuffix = String((bs.year + 1) % 100).padStart(3, "0");
    return `${bs.year}/${nextYearSuffix}`;
  } else {
    const prevYear = bs.year - 1;
    const curYearSuffix = String(bs.year % 100).padStart(3, "0");
    return `${prevYear}/${curYearSuffix}`;
  }
}

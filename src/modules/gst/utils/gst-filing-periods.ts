// Derives the month/quarter period options the GSTR-1 period selector
// offers, spanning the active Financial Year — reuses this app's existing
// FinancialYear concept (already April-March aligned) rather than
// reinventing Indian-fiscal-year math from a bare calendar year.

export interface GstFilingPeriodOption {
  value: string;
  label: string;
  from: string;
  to: string;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, monthIndex0: number): Date {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0));
}

const MONTH_LABELS = [
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

/** 12 calendar months spanning [financialYearStart, financialYearEnd]. */
export function getMonthlyPeriodOptions(financialYearStart: Date, financialYearEnd: Date): GstFilingPeriodOption[] {
  const options: GstFilingPeriodOption[] = [];
  let year = financialYearStart.getUTCFullYear();
  let monthIndex0 = financialYearStart.getUTCMonth();

  while (true) {
    const from = new Date(Date.UTC(year, monthIndex0, 1));
    const to = lastDayOfMonth(year, monthIndex0);
    if (from.getTime() > financialYearEnd.getTime()) {
      break;
    }
    options.push({
      value: `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS[monthIndex0]} ${year}`,
      from: toIsoDate(from),
      to: toIsoDate(to < financialYearEnd ? to : financialYearEnd),
    });
    monthIndex0 += 1;
    if (monthIndex0 > 11) {
      monthIndex0 = 0;
      year += 1;
    }
  }

  return options;
}

/** The 4 Indian-fiscal quarters (Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar) spanning [financialYearStart, financialYearEnd]. */
export function getQuarterlyPeriodOptions(financialYearStart: Date, financialYearEnd: Date): GstFilingPeriodOption[] {
  const options: GstFilingPeriodOption[] = [];
  let year = financialYearStart.getUTCFullYear();
  let startMonthIndex0 = financialYearStart.getUTCMonth();

  let quarterNumber = 1;
  while (true) {
    const from = new Date(Date.UTC(year, startMonthIndex0, 1));
    if (from.getTime() > financialYearEnd.getTime()) {
      break;
    }
    let endMonthIndex0 = startMonthIndex0 + 2;
    let endYear = year;
    if (endMonthIndex0 > 11) {
      endMonthIndex0 -= 12;
      endYear += 1;
    }
    const to = lastDayOfMonth(endYear, endMonthIndex0);

    options.push({
      value: `${year}-Q${quarterNumber}`,
      label: `Q${quarterNumber}: ${MONTH_LABELS[startMonthIndex0].slice(0, 3)}-${MONTH_LABELS[endMonthIndex0].slice(0, 3)} ${endYear}`,
      from: toIsoDate(from),
      to: toIsoDate(to < financialYearEnd ? to : financialYearEnd),
    });

    quarterNumber += 1;
    startMonthIndex0 = endMonthIndex0 + 1;
    year = endYear;
    if (startMonthIndex0 > 11) {
      startMonthIndex0 -= 12;
      year += 1;
    }
  }

  return options;
}

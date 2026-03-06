import { DateTime } from "luxon";

const CURRENT_SEASON = "2025-26";

function getSeasonYears(season) {
  const [startYearText, endYearSuffix] = season.split("-");
  const startYear = Number(startYearText);

  if (!Number.isInteger(startYear) || !endYearSuffix) {
    return null;
  }

  const century = startYearText.slice(0, startYearText.length - endYearSuffix.length);
  const endYear = Number(`${century}${endYearSuffix}`);

  if (!Number.isInteger(endYear)) {
    return null;
  }

  return { startYear, endYear };
}

function getSeasonYearForMonth(month, season = CURRENT_SEASON) {
  const years = getSeasonYears(season);

  if (!years) {
    return DateTime.now().setZone("utc").year;
  }

  return month >= 7 ? years.startYear : years.endYear;
}

export function tryParseDate(term) {
  if (term.length < 4 || /^\d{4}$/.test(term)) return null;

  const fullDateFormats = [
    "yyyy-M-d",
    "M/d/yyyy",
    "M-d-yyyy",
    "MMM d yyyy",
    "MMM d, yyyy",
    "MMMM d yyyy",
    "MMMM d, yyyy",
  ];

  for (const format of fullDateFormats) {
    const parsed = DateTime.fromFormat(term, format, {
      locale: "en-US",
      zone: "utc",
    });

    if (parsed.isValid) {
      return parsed.toISODate();
    }
  }

  const partialDateFormats = [
    {
      probeFormat: "M/d/yyyy",
      buildTermWithYear: (year) => `${term}/${year}`,
    },
    {
      probeFormat: "M-d-yyyy",
      buildTermWithYear: (year) => `${term}-${year}`,
    },
    {
      probeFormat: "MMM d yyyy",
      buildTermWithYear: (year) => `${term} ${year}`,
    },
    {
      probeFormat: "MMM d, yyyy",
      buildTermWithYear: (year) => `${term} ${year}`,
    },
    {
      probeFormat: "MMMM d yyyy",
      buildTermWithYear: (year) => `${term} ${year}`,
    },
    {
      probeFormat: "MMMM d, yyyy",
      buildTermWithYear: (year) => `${term} ${year}`,
    },
  ];

  for (const { probeFormat, buildTermWithYear } of partialDateFormats) {
    const partial = DateTime.fromFormat(buildTermWithYear(2000), probeFormat, {
      locale: "en-US",
      zone: "utc",
    });

    if (!partial.isValid) {
      continue;
    }

    const seasonYear = getSeasonYearForMonth(partial.month);
    const parsed = DateTime.fromFormat(
      buildTermWithYear(seasonYear),
      probeFormat,
      {
        locale: "en-US",
        zone: "utc",
      }
    );

    if (parsed.isValid) {
      return parsed.toISODate();
    }
  }

  return null;
}

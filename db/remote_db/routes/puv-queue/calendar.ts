import type { D1Database } from '@cloudflare/workers-types';

import { matchesHoliday, type RouteTimeParts } from './logic';
import type { CalendarSignal, QueueHolidayEntry, QueueRouteConfig } from './types';

const HOLIDAY_SYNC_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const HOLIDAY_MIN_ENTRIES = 8;
const HOLIDAY_SEARCH_URL = 'https://elibrary.judiciary.gov.ph/assets/dtSearch/dtSearch_system_files/dtisapi6.dll';
const HOLIDAY_DOC_SOURCE = 'judiciary_elibrary';
const HOLIDAY_SEARCH_INDEX = '*{e39072bc7dabaed3657679b3bbbd8a44} presidential_proclamation';

type HolidayRow = {
  holiday_date: string;
  label: string;
  category: string;
  source: string;
  year: number;
  fetched_at: number;
  created_at: number;
  updated_at: number;
};

type HolidayCoverageRow = {
  entry_count: number | null;
  latest_fetched_at: number | null;
};

export type HolidaySyncResult = {
  year: number;
  source: string | null;
  imported: number;
  holidays: QueueHolidayEntry[];
};

const monthMap: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#8216;|&#8217;|&lsquo;|&rsquo;/gi, "'")
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
    .replace(/&ldquo;|&rdquo;/gi, '"');
}

function normalizeWhitespace(value: string): string {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function stripTags(value: string): string {
  return normalizeWhitespace(value.replace(/<[^>]+>/g, ' '));
}

function categoryFromHeading(line: string): string | null {
  const normalized = line.toLowerCase();
  if (normalized.includes('regular holidays')) return 'regular_holiday';
  if (normalized.includes('additional special') && normalized.includes('non-working')) {
    return 'additional_special_non_working';
  }
  if (normalized.includes('special (non-working)')) return 'special_non_working';
  if (normalized.includes('special non-working')) return 'special_non_working';
  if (normalized.includes('special (working)')) return 'special_working';
  if (normalized.includes('special working')) return 'special_working';
  return null;
}

function toIsoDate(year: number, dayValue: string, monthValue: string): string | null {
  const month = monthMap[monthValue.toLowerCase()];
  const day = Number(dayValue);
  if (!month || !Number.isInteger(day) || day < 1 || day > 31) {
    return null;
  }
  return `${year}-${month}-${String(day).padStart(2, '0')}`;
}

function createHolidayEntry(
  year: number,
  source: string,
  category: string,
  label: string,
  dayValue: string,
  monthValue: string,
): QueueHolidayEntry | null {
  const holidayDate = toIsoDate(year, dayValue, monthValue);
  if (!holidayDate) {
    return null;
  }

  const now = Date.now();
  return {
    holiday_date: holidayDate,
    label: label.trim(),
    category,
    source,
    year,
    fetched_at: now,
    created_at: now,
    updated_at: now,
  };
}

function parseTableRows(html: string, year: number): QueueHolidayEntry[] {
  const entries = new Map<string, QueueHolidayEntry>();
  const tableMatches = html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi);

  for (const tableMatch of tableMatches) {
    const tableHtml = tableMatch[1];
    const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    if (!rows.length) {
      continue;
    }

    const headingCells = [...rows[0][1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => stripTags(cell[1]));
    const category = categoryFromHeading(headingCells[0] ?? '');
    if (!category) {
      continue;
    }

    for (const row of rows.slice(1)) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => stripTags(cell[1]));
      if (cells.length < 3) {
        continue;
      }

      const label = cells[0];
      const dateMatch = cells[2].match(/(\d{1,2})\s+([A-Za-z]+)/);
      if (!label || !dateMatch) {
        continue;
      }

      const entry = createHolidayEntry(year, HOLIDAY_DOC_SOURCE, category, label, dateMatch[1], dateMatch[2]);
      if (entry) {
        entries.set(entry.holiday_date, entry);
      }
    }
  }

  return [...entries.values()].sort((left, right) => left.holiday_date.localeCompare(right.holiday_date));
}

async function searchHolidayDocument(year: number): Promise<string | null> {
  const body = new URLSearchParams({
    index: HOLIDAY_SEARCH_INDEX,
    request: `${year} regular holidays special non-working days`,
    searchType: 'allwords',
    cmd: 'search',
    SearchForm: '%%SearchForm%%',
    OrigSearchForm: 'https://elibrary.judiciary.gov.ph/assets/dtSearch/dtSearch_default_form/dtSearch_form.html',
    fuzziness: '3',
    pageSize: '10',
    autoTermWeight: '1',
    fileConditions: '',
    booleanConditions: '',
  });
  const response = await fetch(HOLIDAY_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const hrefMatch = html.match(/href="([^"]*cmd=getdoc[^"]+)"/i);
  if (!hrefMatch) {
    return null;
  }

  return decodeEntities(hrefMatch[1]).replace(/^http:\/\//i, 'https://');
}

async function loadHolidayEntries(year: number): Promise<{ source: string; holidays: QueueHolidayEntry[] } | null> {
  const documentUrl = await searchHolidayDocument(year);
  if (!documentUrl) {
    return null;
  }

  const response = await fetch(documentUrl, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const holidays = parseTableRows(html, year);
  if (holidays.length < HOLIDAY_MIN_ENTRIES) {
    return null;
  }

  return {
    source: HOLIDAY_DOC_SOURCE,
    holidays,
  };
}

function mapHolidayRow(row: HolidayRow): QueueHolidayEntry {
  return {
    holiday_date: row.holiday_date,
    label: row.label,
    category: row.category,
    source: row.source,
    year: row.year,
    fetched_at: row.fetched_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function readHolidayCoverage(db: D1Database, year: number): Promise<HolidayCoverageRow> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS entry_count,
              MAX(fetched_at) AS latest_fetched_at
       FROM puv_queue_holiday_calendar
       WHERE year = ?`,
    )
    .bind(year)
    .first<HolidayCoverageRow>();

  return {
    entry_count: Number(row?.entry_count ?? 0),
    latest_fetched_at: row?.latest_fetched_at ?? null,
  };
}

async function replaceHolidayYear(db: D1Database, year: number, holidays: QueueHolidayEntry[]): Promise<void> {
  await db.prepare('DELETE FROM puv_queue_holiday_calendar WHERE year = ?').bind(year).run();

  if (!holidays.length) {
    return;
  }

  const statements = holidays.map((holiday) =>
    db
      .prepare(
        `INSERT INTO puv_queue_holiday_calendar (
           holiday_date,
           label,
           category,
           source,
           year,
           fetched_at,
           created_at,
           updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        holiday.holiday_date,
        holiday.label,
        holiday.category,
        holiday.source,
        holiday.year,
        holiday.fetched_at,
        holiday.created_at,
        holiday.updated_at,
      ),
  );

  await db.batch(statements);
}

async function ensureHolidayYear(db: D1Database, year: number): Promise<void> {
  const coverage = await readHolidayCoverage(db, year);
  const isFresh =
    Number(coverage.entry_count ?? 0) > 0 &&
    typeof coverage.latest_fetched_at === 'number' &&
    Date.now() - coverage.latest_fetched_at < HOLIDAY_SYNC_STALE_MS;

  if (isFresh) {
    return;
  }

  try {
    await syncHolidayCalendar(db, year);
  } catch {
    return;
  }
}

type HolidayDateRow = {
  holiday_date: string;
};

export async function listKnownHolidayDates(db: D1Database, isoDates: string[]): Promise<Set<string>> {
  const uniqueIsoDates = [...new Set(isoDates.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))];

  if (!uniqueIsoDates.length) {
    return new Set();
  }

  const years = [...new Set(uniqueIsoDates.map((value) => Number(value.slice(0, 4))).filter((value) => Number.isInteger(value)))];
  await Promise.all(years.map((year) => ensureHolidayYear(db, year)));

  const placeholders = uniqueIsoDates.map(() => '?').join(', ');
  const { results } = await db
    .prepare(`SELECT holiday_date FROM puv_queue_holiday_calendar WHERE holiday_date IN (${placeholders})`)
    .bind(...uniqueIsoDates)
    .all<HolidayDateRow>();

  return new Set((results ?? []).map((row) => row.holiday_date));
}

export function isRouteHoliday(route: QueueRouteConfig, routeTime: RouteTimeParts, holidayDates: Set<string>): boolean {
  return holidayDates.has(routeTime.isoDate) || matchesHoliday(routeTime.isoDate, routeTime.monthDay, route.holidays);
}

export async function listHolidayCalendar(db: D1Database, year?: number): Promise<QueueHolidayEntry[]> {
  const statement = year
    ? db.prepare('SELECT * FROM puv_queue_holiday_calendar WHERE year = ? ORDER BY holiday_date ASC').bind(year)
    : db.prepare('SELECT * FROM puv_queue_holiday_calendar ORDER BY holiday_date DESC LIMIT 120');
  const { results } = await statement.all<HolidayRow>();
  return (results ?? []).map(mapHolidayRow);
}

export async function syncHolidayCalendar(db: D1Database, year: number): Promise<HolidaySyncResult> {
  const loaded = await loadHolidayEntries(year);
  if (!loaded) {
    throw new Error(`Unable to sync Philippine holidays for ${year}`);
  }

  await replaceHolidayYear(db, year, loaded.holidays);

  return {
    year,
    source: loaded.source,
    imported: loaded.holidays.length,
    holidays: loaded.holidays,
  };
}

export async function resolveCalendarSignal(
  db: D1Database,
  route: QueueRouteConfig,
  routeTime: RouteTimeParts,
): Promise<CalendarSignal> {
  const year = Number(routeTime.isoDate.slice(0, 4));
  if (Number.isInteger(year)) {
    await ensureHolidayYear(db, year);
  }

  const holiday = await db
    .prepare('SELECT * FROM puv_queue_holiday_calendar WHERE holiday_date = ? LIMIT 1')
    .bind(routeTime.isoDate)
    .first<HolidayRow>();

  if (holiday) {
    return {
      is_holiday: true,
      holiday_name: holiday.label,
      category: holiday.category,
      source: 'holiday_calendar',
      fetched_at: new Date(holiday.fetched_at).toISOString(),
    };
  }

  if (matchesHoliday(routeTime.isoDate, routeTime.monthDay, route.holidays)) {
    return {
      is_holiday: true,
      holiday_name: null,
      category: 'route_config',
      source: 'route_config',
      fetched_at: null,
    };
  }

  return {
    is_holiday: false,
    holiday_name: null,
    category: null,
    source: 'none',
    fetched_at: null,
  };
}

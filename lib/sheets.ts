import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import type { CampaignRow, Platform } from '@/types/campaign';

// ── helpers ─────────────────────────────────────────────────────────────────

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  // Strip everything except digits, separators and minus (removes €, spaces, etc.)
  let s = String(v).trim().replace(/[^0-9.,-]/g, '');
  if (s === '' || s === '-') return 0;

  const hasComma = s.includes(',');
  const hasDot   = s.includes('.');
  if (hasComma && hasDot) {
    // The right-most separator is the decimal one.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.'); // EU: 1.234,56 → 1234.56
    } else {
      s = s.replace(/,/g, '');                    // US: 1,234.56 → 1234.56
    }
  } else if (hasComma) {
    s = s.replace(',', '.');                       // 1234,56 → 1234.56
  }
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function normaliseDate(v: unknown): string {
  if (!v) return '';
  const s = String(v).trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  // Try native Date parse as last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

/**
 * Find a column index by trying several candidate header names.
 * First pass = exact (case-insensitive) match. Second pass = fuzzy: a header that contains
 * a candidate (or vice-versa). The fuzzy pass catches export-naming drift like
 * "Cost: Amount spent in local currency" vs the expected "...amount spend...".
 */
function findCol(headers: string[], ...candidates: string[]): number {
  const norm = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = norm.indexOf(c.toLowerCase());
    if (idx !== -1) return idx;
  }
  for (const c of candidates) {
    const cl = c.toLowerCase();
    const idx = norm.findIndex((h) => h.includes(cl) || cl.includes(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

// ── Google Sheets client ─────────────────────────────────────────────────────

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Support both literal \n (from .env) and real newlines (from Docker/Vercel secrets)
  const key = (process.env.GOOGLE_PRIVATE_KEY ?? '')
    .replace(/\\n/g, '\n');

  if (!email || !key) {
    throw new Error(
      'Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY env vars'
    );
  }

  // Use JWT directly — more robust with Node 18+ / OpenSSL 3 than GoogleAuth
  const auth = new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return google.sheets({ version: 'v4', auth });
}

// ── Raw fetching (with Next.js cache) ────────────────────────────────────────

async function fetchTab(sheetId: string, tabName: string, optional = false): Promise<string[][]> {
  const sheets = getSheetsClient();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: tabName,
    });
    return (res.data.values ?? []) as string[][];
  } catch (err: unknown) {
    const status = (err as { status?: number; code?: number }).status
      ?? (err as { status?: number; code?: number }).code;
    const message = (err as { message?: string }).message ?? String(err);
    const notFound = status === 404 || message.includes('not found');

    // Optional tabs (e.g. "youtube_raw" before that channel's export exists) are allowed to be
    // missing — the dashboard shows an empty state for that channel instead of failing entirely.
    if (notFound && optional) return [];

    if (notFound) {
      throw new Error(
        `Sheet tab "${tabName}" not found in spreadsheet "${sheetId}". ` +
        `Check that the tab exists with exactly that name (case-sensitive) ` +
        `and that the service account has been granted Viewer access to the spreadsheet.`
      );
    }
    if (status === 403) {
      throw new Error(
        `Permission denied accessing spreadsheet "${sheetId}". ` +
        `Share the spreadsheet with your service account email as Viewer.`
      );
    }
    throw err;
  }
}

// ── Normalisation ────────────────────────────────────────────────────────────

function normaliseLinkedIn(rows: string[][]): CampaignRow[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());

  // Log headers in dev so we can verify the mapping
  if (process.env.NODE_ENV !== 'production') {
    console.log('[sheets] linkedin_raw headers:', headers);
  }

  // LinkedIn export uses Campaign ID (no name column in this export)
  const iCampaign   = findCol(headers, 'campaign: campaign name', 'campaign name', 'campaignname', 'name', 'campaign: campaign id', 'campaign');
  const iDate       = findCol(headers, 'report: date', 'date', 'day', 'start date', 'startdate');
  const iImpr       = findCol(headers, 'performance: impressions', 'impressions', 'impressie', 'views');
  const iClicks     = findCol(headers, 'performance: clicks', 'clicks', 'klikken', 'total clicks');
  const iSpend      = findCol(headers, 'cost: amount spend', 'cost: amount spend in local currency', 'cost: amount spent in local currency', 'amount spent', 'amount spend', 'spent', 'spend', 'cost (local currency)');
  const iConv       = findCol(headers, 'performance: conversions', 'conversions', 'leads', 'total conversions');
  const iReach      = findCol(headers, 'performance: reach', 'reach', 'bereik');
  const iThruplays  = findCol(headers, 'video: plays at 100%', 'video: plays at 100', 'thruplays', 'thruplay');

  return rows.slice(1).flatMap((row): CampaignRow[] => {
    const campaign_name = iCampaign >= 0 ? String(row[iCampaign] ?? '').trim() : 'Unknown';
    const date          = normaliseDate(iDate >= 0 ? row[iDate] : '');
    if (!campaign_name && !date) return [];
    return [{
      platform:      'linkedin' as Platform,
      campaign_name: campaign_name || 'Unknown',
      impressions:   toNum(iImpr      >= 0 ? row[iImpr]      : 0),
      clicks:        toNum(iClicks    >= 0 ? row[iClicks]    : 0),
      spend:         toNum(iSpend     >= 0 ? row[iSpend]     : 0),
      conversions:   toNum(iConv      >= 0 ? row[iConv]      : 0),
      reach:         toNum(iReach     >= 0 ? row[iReach]     : 0),
      thruplays:     toNum(iThruplays >= 0 ? row[iThruplays] : 0),
      date,
    }];
  });
}

function normaliseMeta(rows: string[][]): CampaignRow[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());

  if (process.env.NODE_ENV !== 'production') {
    console.log('[sheets] meta_raw headers:', headers);
  }

  const iCampaign   = findCol(headers, 'campaign: campaign name', 'campaign name', 'campaign', 'campaignname', 'name', 'ad set name');
  const iDate       = findCol(headers, 'report: date', 'date', 'day', 'reporting starts', 'reporting start');
  const iImpr       = findCol(headers, 'performance: impressions', 'impressions', 'impressie', 'views');
  const iClicks     = findCol(headers, 'performance: clicks', 'clicks', 'link clicks', 'outbound clicks');
  const iSpend      = findCol(headers, 'cost: amount spend', 'amount spent (eur)', 'amount spent', 'amount spend', 'spent', 'spend');
  const iConv       = findCol(headers, 'conversions: leads - total', 'conversions', 'results', 'leads', 'purchases');
  const iReach      = findCol(headers, 'performance: reach', 'reach', 'bereik');
  const iThruplays  = findCol(headers, 'video thruplay', 'thruplays', 'thruplay', 'video: plays at 100%');

  return rows.slice(1).flatMap((row): CampaignRow[] => {
    const campaign_name = iCampaign >= 0 ? String(row[iCampaign] ?? '').trim() : 'Unknown';
    const date          = normaliseDate(iDate >= 0 ? row[iDate] : '');
    if (!campaign_name && !date) return [];
    return [{
      platform:      'meta' as Platform,
      campaign_name: campaign_name || 'Unknown',
      impressions:   toNum(iImpr      >= 0 ? row[iImpr]      : 0),
      clicks:        toNum(iClicks    >= 0 ? row[iClicks]    : 0),
      spend:         toNum(iSpend     >= 0 ? row[iSpend]     : 0),
      conversions:   toNum(iConv      >= 0 ? row[iConv]      : 0),
      reach:         toNum(iReach     >= 0 ? row[iReach]     : 0),
      thruplays:     toNum(iThruplays >= 0 ? row[iThruplays] : 0),
      date,
    }];
  });
}

// Nog geen echte export bekend voor YouTube — zelfde kolomgok-aanpak als Meta/LinkedIn,
// zodat wat er ook aangeleverd wordt (YouTube Ads-export of YouTube Analytics-export) een
// redelijke kans heeft om automatisch herkend te worden zodra de "youtube_raw"-tab bestaat.
function normaliseYouTube(rows: string[][]): CampaignRow[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());

  if (process.env.NODE_ENV !== 'production') {
    console.log('[sheets] youtube_raw headers:', headers);
  }

  const iCampaign   = findCol(headers, 'campaign: campaign name', 'campaign name', 'campaign', 'campaignname', 'name', 'video title');
  const iDate       = findCol(headers, 'report: date', 'date', 'day');
  const iImpr       = findCol(headers, 'performance: impressions', 'impressions', 'impressie', 'views');
  const iClicks     = findCol(headers, 'performance: clicks', 'clicks');
  const iSpend      = findCol(headers, 'cost: amount spend', 'amount spent', 'amount spend', 'spent', 'spend', 'cost');
  const iConv       = findCol(headers, 'conversions', 'leads');
  const iReach      = findCol(headers, 'performance: reach', 'reach', 'bereik', 'unique viewers');
  const iThruplays  = findCol(headers, 'thruplays', 'thruplay', 'views (video played to completion)', 'completed views');

  return rows.slice(1).flatMap((row): CampaignRow[] => {
    const campaign_name = iCampaign >= 0 ? String(row[iCampaign] ?? '').trim() : 'Unknown';
    const date          = normaliseDate(iDate >= 0 ? row[iDate] : '');
    if (!campaign_name && !date) return [];
    return [{
      platform:      'youtube' as Platform,
      campaign_name: campaign_name || 'Unknown',
      impressions:   toNum(iImpr      >= 0 ? row[iImpr]      : 0),
      clicks:        toNum(iClicks    >= 0 ? row[iClicks]    : 0),
      spend:         toNum(iSpend     >= 0 ? row[iSpend]     : 0),
      conversions:   toNum(iConv      >= 0 ? row[iConv]      : 0),
      reach:         toNum(iReach     >= 0 ? row[iReach]     : 0),
      thruplays:     toNum(iThruplays >= 0 ? row[iThruplays] : 0),
      date,
    }];
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface RawSheetData {
  linkedin: string[][];
  meta: string[][];
  youtube: string[][];
}

export async function getRawSheetData(): Promise<RawSheetData> {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) throw new Error('Missing GOOGLE_SHEETS_ID env var');

  const [linkedin, meta, youtube] = await Promise.all([
    fetchTab(sheetId, 'linkedin_raw'),
    fetchTab(sheetId, 'meta_raw'),
    fetchTab(sheetId, 'youtube_raw', /* optional */ true),
  ]);

  return { linkedin, meta, youtube };
}

export async function getCampaigns(): Promise<CampaignRow[]> {
  const { linkedin, meta, youtube } = await getRawSheetData();
  return [...normaliseLinkedIn(linkedin), ...normaliseMeta(meta), ...normaliseYouTube(youtube)];
}

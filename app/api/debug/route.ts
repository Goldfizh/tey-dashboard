import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { getRawSheetData, getCampaigns } from '@/lib/sheets';
import type { Platform } from '@/types/campaign';

// Diagnostic — returns raw headers, sample rows, tab names and parsed per-platform totals.
// Protected by the app's auth middleware (proxy.ts): only logged-in users can reach it, and it
// exposes the same campaign data already visible in the dashboard.
export async function GET() {
  const sheetId = process.env.GOOGLE_SHEETS_ID ?? '(not set)';

  // First: list all actual tab names in the spreadsheet
  let tabNames: string[] = [];
  try {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
    if (email && key) {
      const auth = new JWT({
        email,
        key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      const sheets = google.sheets({ version: 'v4', auth });
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      tabNames = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '');
    }
  } catch (_) {
    // tabNames stays empty — the main fetch will surface the real error
  }

  try {
    const { linkedin, meta } = await getRawSheetData();

    // Parsed view: how the dashboard actually normalises the rows, per platform.
    // This pinpoints whether e.g. LinkedIn spend reads as 0.
    const campaigns = await getCampaigns();
    const byPlatform: Record<Platform, { rows: number; spend: number; conversions: number; impressions: number; minDate: string; maxDate: string }> =
      { linkedin: { rows: 0, spend: 0, conversions: 0, impressions: 0, minDate: '', maxDate: '' },
        meta:     { rows: 0, spend: 0, conversions: 0, impressions: 0, minDate: '', maxDate: '' },
        google:   { rows: 0, spend: 0, conversions: 0, impressions: 0, minDate: '', maxDate: '' } };
    for (const r of campaigns) {
      const p = byPlatform[r.platform];
      p.rows += 1; p.spend += r.spend; p.conversions += r.conversions; p.impressions += r.impressions;
      if (r.date && (!p.minDate || r.date < p.minDate)) p.minDate = r.date;
      if (r.date && (!p.maxDate || r.date > p.maxDate)) p.maxDate = r.date;
    }

    return NextResponse.json({
      spreadsheet_id: sheetId,
      actual_tab_names: tabNames,
      parsed_totals: byPlatform,
      linkedin: {
        headers: linkedin[0] ?? [],
        sample: linkedin.slice(1, 21),
        total_rows: Math.max(0, linkedin.length - 1),
      },
      meta: {
        headers: meta[0] ?? [],
        sample: meta.slice(1, 21),
        total_rows: Math.max(0, meta.length - 1),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({
      spreadsheet_id: sheetId,
      actual_tab_names: tabNames,
      error: message,
    }, { status: 500 });
  }
}

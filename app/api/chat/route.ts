import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Configure via .env.local:
//   AI_GATEWAY_URL    — Vercel AI Gateway base URL
//                       e.g. https://ai-gateway.vercel.sh/v1/{team}/{gateway}
//                       or leave empty to hit OpenAI directly
//   AI_GATEWAY_API_KEY — API key for the gateway (or your OpenAI key)
//   AI_MODEL          — model slug, default: gpt-4o

const openai = createOpenAI({
  baseURL: process.env.AI_GATEWAY_URL ?? 'https://api.openai.com/v1',
  apiKey:  process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY ?? '',
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChannelContext {
  spend:       number;
  clicks:      number;
  impressions: number;
  conversions: number;
  cpa:         number | null;
  ctr:         number;
  cpc:         number;
  thruplays?:  number;
  cpv?:        number | null;
}

interface CampaignContext {
  name:        string;
  platform:    string;
  spend:       number;
  conversions: number;
  cpa:         number | null;
  clicks:      number;
  cpc:         number;
}

interface VacancyContext {
  title:     string;
  starts:    number;
  completed: number;
  rate:      number;
}

export interface DashboardContext {
  period:      string;
  dateFrom:    string;
  dateTo:      string;
  totals: {
    spend:       number;
    impressions: number;
    clicks:      number;
    conversions: number;
    cpa:         number | null;
  };
  channels: {
    linkedin?: ChannelContext;
    meta?:     ChannelContext;
    google?:   ChannelContext;
  };
  topCampaigns:    CampaignContext[];
  bestCpaCampaign: CampaignContext | null;
  vacancies?:      VacancyContext[];
}

interface SimpleMessage {
  role:    'user' | 'assistant';
  content: string;
}

// ── System prompt builder ──────────────────────────────────────────────────────

function buildSystemPrompt(ctx: DashboardContext): string {
  const eur = (n: number) => `€${n.toFixed(2).replace('.', ',')}`;
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  const num = (n: number) => n.toLocaleString('nl-NL');

  const channelBlock = (name: string, c: ChannelContext | undefined) => {
    if (!c) return '';
    const lines = [
      `  ${name}:`,
      `    Spend: ${eur(c.spend)}`,
      `    Impressies: ${num(c.impressions)}`,
      `    Kliks: ${num(c.clicks)} | CTR: ${pct(c.ctr)} | CPC: ${eur(c.cpc)}`,
      `    Conversies (platform): ${num(c.conversions)} | CPA: ${c.cpa !== null ? eur(c.cpa) : 'n.v.t.'}`,
    ];
    if (c.thruplays && c.thruplays > 0) {
      lines.push(`    Video views (3-sec): ${num(c.thruplays)} | CPV: ${c.cpv != null ? eur(c.cpv) : 'n.v.t.'}`);
    }
    return lines.join('\n');
  };

  const campaignBlock = ctx.topCampaigns.slice(0, 8).map((c, i) =>
    `  ${i + 1}. [${c.platform.toUpperCase()}] ${c.name}\n` +
    `     Spend: ${eur(c.spend)} | Conversies: ${c.conversions} | CPA: ${c.cpa !== null ? eur(c.cpa) : 'n.v.t.'} | CPC: ${eur(c.cpc)}`
  ).join('\n');

  const vacancyBlock = ctx.vacancies && ctx.vacancies.length > 0
    ? ctx.vacancies.map((v) =>
        `  - ${v.title}: ${v.starts} gestart → ${v.completed} voltooid (${v.rate.toFixed(1)}%)`
      ).join('\n')
    : '  Geen vacaturedata beschikbaar voor deze periode.';

  return `Je bent een ervaren recruitment marketing adviseur voor Teylingereind (een forensisch centrum in Nederland). \
Je analyseert campagnedata en geeft praktisch, concreet advies aan de recruiters en marketeers van Goldfizh, het marketingbureau dat de campagnes beheert.

Je hebt toegang tot de volgende live dashboarddata:

═══ GESELECTEERDE PERIODE: ${ctx.period} (${ctx.dateFrom} t/m ${ctx.dateTo}) ═══

TOTALEN (alle kanalen samen):
  Totaalbudget:   ${eur(ctx.totals.spend)}
  Impressies:     ${num(ctx.totals.impressions)}
  Kliks:          ${num(ctx.totals.clicks)}
  Conversies:     ${num(ctx.totals.conversions)}
  Gemiddelde CPA: ${ctx.totals.cpa !== null ? eur(ctx.totals.cpa) : 'n.v.t.'}

PER KANAAL:
${channelBlock('LinkedIn', ctx.channels.linkedin)}
${channelBlock('Meta (Facebook/Instagram)', ctx.channels.meta)}
${channelBlock('Google Ads', ctx.channels.google)}

TOP CAMPAGNES (gesorteerd op spend):
${campaignBlock || '  Geen campagnedata.'}

BESTE CPA-CAMPAGNE: ${ctx.bestCpaCampaign
    ? `${ctx.bestCpaCampaign.name} (${ctx.bestCpaCampaign.platform}) — CPA: ${ctx.bestCpaCampaign.cpa !== null ? eur(ctx.bestCpaCampaign.cpa) : 'n.v.t.'}`
    : 'n.v.t.'}

SOLLICITATIEFUNNEL PER VACATURE (GA4):
${vacancyBlock}

═══════════════════════════════════════════════════════════

Richtlijnen:
- Antwoord altijd in het Nederlands, bondig en to-the-point.
- Gebruik concrete cijfers uit de data; speculeer niet.
- Geef prioriteiten aan: wat is het belangrijkste om te doen?
- Als je iets niet weet of de data ontbreekt, zeg dat eerlijk.
- Bij vragen over specifieke vacatures: kijk naar de funneldata en conversieratio's.
- Wees kritisch: als een kanaal slecht presteert, zeg het direct.`;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json() as { messages?: SimpleMessage[]; context?: DashboardContext };
    const { messages = [], context } = body;

    if (!process.env.AI_GATEWAY_API_KEY && !process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: 'Geen AI API-sleutel geconfigureerd. Voeg AI_GATEWAY_API_KEY of OPENAI_API_KEY toe aan .env.local.' },
        { status: 500 },
      );
    }

    const model  = process.env.AI_MODEL ?? 'gpt-4o';
    const system = context ? buildSystemPrompt(context) : 'Je bent een recruitment marketing adviseur.';

    const result = streamText({
      model: openai(model),
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      maxOutputTokens: 1024,
    });

    return result.toTextStreamResponse();
  } catch (err) {
    console.error('[chat]', err);
    return Response.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

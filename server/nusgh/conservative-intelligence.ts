export type ResearchCandidate = {
  topic: string;
  sourceUrl: string;
  publisher: string;
  supportingSources: Array<{ sourceUrl: string; title: string; publisher: string; excerpt: string }>;
  trendSignal: number;
  freshness: number;
  audienceRelevance: number;
  competitionOpportunity: number;
  viralPotential: number;
  retentionPotential: number;
  productionFeasibility: number;
};

export type ScoredResearchCandidate = ResearchCandidate & { score: number; riskLevel: "green" | "requires_human_review"; rejectionReason?: string };

export const CONSERVATIVE_AUTOPILOT_DEFAULTS = {
  enabled: true,
  killSwitch: false,
  dailyIdeaLimit: 1,
  timezone: "Africa/Cairo",
  internalPublishingHours: [11, 16, 21],
} as const;

const highRiskTerms = /(انتخابات|حرب|وفاة|قتل|كارثة|علاج|دواء|استثمار|أسهم|سياسة|politic|election|war|death|treatment|investment)/i;

export function scoreResearchCandidate(candidate: ResearchCandidate): ScoredResearchCandidate {
  const score = Math.round(
    candidate.viralPotential * 0.25 +
      candidate.audienceRelevance * 0.2 +
      candidate.freshness * 0.15 +
      candidate.trendSignal * 0.15 +
      candidate.competitionOpportunity * 0.1 +
      candidate.retentionPotential * 0.1 +
      candidate.productionFeasibility * 0.05
  );
  const requiresReview = highRiskTerms.test(candidate.topic);
  return { ...candidate, score, riskLevel: requiresReview ? "requires_human_review" : "green", ...(requiresReview ? { rejectionReason: "موضوع عالي الحساسية أو غير مناسب للاختيار المحافظ التلقائي." } : {}) };
}

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  return match?.[1] ? decodeXml(match[1]) : null;
}

export function parseGoogleTrendsRss(xml: string): ResearchCandidate[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return items
    .map(block => {
      const topic = tag(block, "title");
      const sourceUrl = tag(block, "link");
      if (!topic || !sourceUrl) return null;
      const newsItems = block.match(/<ht:news_item>[\s\S]*?<\/ht:news_item>/gi) ?? [];
      const supportingSources = newsItems.map(news => ({ sourceUrl: tag(news, "ht:news_item_url"), title: tag(news, "ht:news_item_title"), publisher: tag(news, "ht:news_item_source"), excerpt: `مصدر إخباري مرتبط بإشارة الاتجاه «${topic}».` })).filter((source): source is { sourceUrl: string; title: string; publisher: string; excerpt: string } => Boolean(source.sourceUrl && source.title && source.publisher));
      return {
        topic,
        sourceUrl,
        publisher: "Google Trends Daily RSS",
        supportingSources: [{ sourceUrl, title: topic, publisher: "Google Trends Daily RSS", excerpt: "إشارة اتجاه يومية لا تصلح وحدها لإثبات الادعاءات." }, ...supportingSources],
        trendSignal: 85,
        freshness: 90,
        audienceRelevance: 72,
        competitionOpportunity: 55,
        viralPotential: 70,
        retentionPotential: 68,
        productionFeasibility: 80,
      } satisfies ResearchCandidate;
    })
    .filter((candidate): candidate is ResearchCandidate => Boolean(candidate));
}

export async function fetchDailyTrendCandidates(fetchImpl: typeof fetch = fetch, geo = "EG") {
  const response = await fetchImpl(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`, { signal: AbortSignal.timeout(15_000), headers: { accept: "application/rss+xml, application/xml;q=0.9" } });
  if (!response.ok) throw new Error(`تعذر جلب إشارة الاتجاه اليومية: ${response.status}`);
  return parseGoogleTrendsRss(await response.text()).map(scoreResearchCandidate).filter(candidate => candidate.riskLevel === "green").sort((a, b) => b.score - a.score);
}

export function nextInternalPublishingSlot(now = new Date(), hours: readonly number[] = CONSERVATIVE_AUTOPILOT_DEFAULTS.internalPublishingHours, timezone: string = CONSERVATIVE_AUTOPILOT_DEFAULTS.timezone) {
  const choices = [...hours].filter(hour => Number.isInteger(hour) && hour >= 0 && hour <= 23).sort((a, b) => a - b);
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  for (let offset = 1; offset <= 48; offset += 1) {
    const proposed = new Date(start.getTime() + offset * 60 * 60 * 1000);
    const parts = Object.fromEntries(formatter.formatToParts(proposed).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    if (parts.minute === "00" && choices.includes(Number(parts.hour))) return proposed;
  }
  throw new Error("لا توجد نافذة جدولة داخلية صالحة.");
}

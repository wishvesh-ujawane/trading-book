import { GoogleGenAI } from '@google/genai';
import type { Trade } from '../types';

/**
 * Bring-your-own-key AI Coach powered by Gemini.
 *
 * The user's Gemini API key is stored in this device's `localStorage` and
 * used client-side. We never send it anywhere except directly to the
 * Google Generative AI endpoint.
 */

const STORAGE_KEY = 'tj_gemini_key';
const MODEL = 'gemini-2.5-flash';

/** Custom subclass so callers can distinguish missing-key from other errors. */
export class MissingApiKeyError extends Error {
  constructor() {
    super('No Gemini API key set. Add one in Settings to use the AI Coach.');
    this.name = 'MissingApiKeyError';
  }
}

export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Persist (or clear) the Gemini API key on this device. Fires a
 * `tj_gemini_key_updated` DOM event so components watching the key can
 * re-render without prop drilling.
 */
export function setStoredApiKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    window.dispatchEvent(new Event('tj_gemini_key_updated'));
  } catch {
    /* ignore storage errors — private-mode etc. */
  }
}

export function hasStoredApiKey(): boolean {
  return getStoredApiKey().length > 0;
}

function buildClient(): GoogleGenAI {
  const key = getStoredApiKey();
  if (!key) throw new MissingApiKeyError();
  return new GoogleGenAI({ apiKey: key });
}

async function generate(prompt: string): Promise<string> {
  const ai = buildClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });
  const text = (response.text ?? '').trim();
  if (!text) {
    throw new Error('The AI returned an empty response. Try again in a moment.');
  }
  return text;
}

const INR = (n: number) =>
  n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

function tradeToPrompt(trade: Trade): string {
  const findings = trade.findings ?? {
    whatWentWell: '',
    whatWentWrong: '',
    whatCouldBeImproved: '',
  };
  return [
    `Symbol: ${trade.symbol}`,
    `Direction: ${trade.direction} (${trade.tradeType})`,
    `Order type: ${trade.orderType}`,
    `Entry: ${INR(trade.entryPrice)} · Exit: ${INR(trade.exitPrice)} · Qty: ${trade.quantity}`,
    `Gross P&L: \u20B9${INR(trade.pnlGross)}  ·  Net P&L: \u20B9${INR(trade.pnlNet)}  ·  Status: ${trade.status}`,
    `Fees & slippage: \u20B9${INR(trade.brokerageFee + trade.slippageFee + trade.taxFee)}`,
    `Date/time: ${trade.date}${trade.time ? ' ' + trade.time : ''}`,
    '',
    'Trader self-reflection:',
    `- What went well: ${findings.whatWentWell || '(blank)'}`,
    `- What went wrong: ${findings.whatWentWrong || '(blank)'}`,
    `- What could be improved: ${findings.whatCouldBeImproved || '(blank)'}`,
  ].join('\n');
}

/**
 * Ask the AI Coach to review a single trade and return a short (~120 word)
 * plain-text summary highlighting one strength, one risk, and one concrete
 * action for next time.
 */
export async function summarizeTrade(trade: Trade): Promise<string> {
  const prompt = `You are a warm, no-nonsense trading psychology coach for a beginner
trader in the Indian markets. Review the trade below and reply in
under 120 words with:
1. One thing the trader did well (be specific).
2. One risk or leak in this trade (fees, sizing, exit timing, emotion).
3. One concrete, actionable habit to apply on the next similar setup.

Keep it plain text. No markdown headers, no bullet stars. Use natural
paragraphs. Do not mention that you are an AI.

TRADE:
${tradeToPrompt(trade)}`;
  return generate(prompt);
}

/**
 * Ask the AI Coach to review the last N trades and return a short weekly
 * debrief covering discipline, edge, and one adjustment for next week.
 */
export async function reviewWeek(trades: Trade[]): Promise<string> {
  if (trades.length === 0) {
    throw new Error('No trades in this window to review.');
  }
  const wins = trades.filter((t) => t.status === 'WIN').length;
  const losses = trades.filter((t) => t.status === 'LOSS').length;
  const net = trades.reduce((acc, t) => acc + t.pnlNet, 0);
  const fees = trades.reduce(
    (acc, t) => acc + t.brokerageFee + t.slippageFee + t.taxFee,
    0,
  );
  const summarySection = trades
    .slice(0, 20)
    .map((t, i) => {
      const findings = t.findings ?? { whatWentWell: '', whatWentWrong: '', whatCouldBeImproved: '' };
      return [
        `#${i + 1} ${t.symbol} ${t.direction} (${t.tradeType}) on ${t.date}`,
        `   net \u20B9${INR(t.pnlNet)} · ${t.status}`,
        findings.whatWentWrong ? `   wrong: ${findings.whatWentWrong}` : '',
        findings.whatCouldBeImproved ? `   improve: ${findings.whatCouldBeImproved}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');
  const prompt = `You are a warm, no-nonsense trading psychology coach for a beginner
trader in the Indian markets. Review the recent trade set below and
reply in under 180 words with:
1. Overall discipline read (what pattern do you see across trades?).
2. Where the edge is leaking (fees, sizing, direction bias, revenge trades…).
3. One concrete adjustment to try next week.

Keep it plain text. No markdown headers, no bullet stars. Natural
paragraphs. Do not mention that you are an AI.

SUMMARY:
Trades: ${trades.length} · Wins: ${wins} · Losses: ${losses}
Net P&L: \u20B9${INR(net)} · Total fees & slippage: \u20B9${INR(fees)}

TRADE DETAILS:
${summarySection}`;
  return generate(prompt);
}

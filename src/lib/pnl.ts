import type { BrokerConfig, Fill, HoldingStyle, Trade } from '../types';
import {
  computeFees,
  effectiveQty,
  resolveInstrument,
  totalQty,
  vwap,
  type FeeBreakdown,
} from './feeEngine';

/**
 * Trade P&L / R-multiple derivation.
 *
 * All functions here are **pure** and can be re-run on the client at read
 * time — so edits to broker fees or plan levels flow through to historical
 * trades without a batch migration.
 */

export type DerivedStatus = 'WIN' | 'LOSS' | 'BREAK_EVEN';

/** Derive win/loss/BE strictly from Net P&L, with a 1 paise dead-band. */
export function deriveStatus(pnlNet: number): DerivedStatus {
  if (pnlNet > 0.01) return 'WIN';
  if (pnlNet < -0.01) return 'LOSS';
  return 'BREAK_EVEN';
}

/** Direction sign — +1 for LONG, -1 for SHORT. */
export function directionSign(dir: Trade['direction']): 1 | -1 {
  return dir === 'LONG' ? 1 : -1;
}

/**
 * Average entry / exit fill prices (VWAP) — uses `entries`/`exits` when
 * present, otherwise falls back to legacy `entryPrice`/`exitPrice`.
 */
export function avgEntry(trade: Trade): number {
  if (trade.entries && trade.entries.length > 0) return vwap(trade.entries);
  return trade.entryPrice;
}

export function avgExit(trade: Trade): number {
  if (trade.exits && trade.exits.length > 0) return vwap(trade.exits);
  return trade.exitPrice;
}

/** Total unit qty for the round-trip — reads fills or legacy qty. */
export function tradedQty(trade: Trade): number {
  if (trade.exits && trade.exits.length > 0) return totalQty(trade.exits);
  if (trade.entries && trade.entries.length > 0) return totalQty(trade.entries);
  return trade.quantity;
}

/**
 * Gross P&L in ₹. Accounts for direction and lot size, uses VWAP over
 * fills when partial-fill data is present.
 */
export function computeGrossPnl(trade: Trade): number {
  const lot = resolveInstrument(trade).lotSize ?? 1;
  const sign = directionSign(trade.direction);
  const qty = tradedQty(trade);
  const gross = (avgExit(trade) - avgEntry(trade)) * qty * lot * sign;
  return round2(gross);
}

/**
 * Compute the whole ledger for a trade — gross, fees, net, status, R-multiple.
 * Prefer this at read time; the stored `pnlNet`/`status` on the trade doc
 * should be treated as a cache.
 */
export interface TradeLedger {
  grossPnl: number;
  fees: FeeBreakdown;
  netPnl: number;
  status: DerivedStatus;
  rMultiple: number | null;
  avgEntry: number;
  avgExit: number;
  qty: number; // effective (already × lotSize)
}

export function computeLedger(
  trade: Trade,
  broker: BrokerConfig | null,
): TradeLedger {
  const grossPnl = computeGrossPnl(trade);
  const fees = computeFees(trade, broker);
  const netPnl = round2(grossPnl - fees.total);
  return {
    grossPnl,
    fees,
    netPnl,
    status: deriveStatus(netPnl),
    rMultiple: computeRealisedR(trade),
    avgEntry: avgEntry(trade),
    avgExit: avgExit(trade),
    qty: effectiveQty(trade),
  };
}

/**
 * Realised R multiple = Net-per-unit / Risk-per-unit.
 * Risk per unit = |plan.entry − plan.stopLoss| in the same units.
 * Returns null when a valid plan is missing.
 */
export function computeRealisedR(trade: Trade): number | null {
  const plan = trade.plan;
  if (!plan || plan.entry === undefined || plan.stopLoss === undefined) return null;
  const risk = Math.abs(plan.entry - plan.stopLoss);
  if (risk <= 0) return null;

  const sign = directionSign(trade.direction);
  const perUnit = (avgExit(trade) - avgEntry(trade)) * sign;
  return round2(perUnit / risk);
}

/**
 * Planned reward-to-risk ratio from a plan (target vs stop). Useful for the
 * live preview inside TradeForm. Returns null when plan is incomplete.
 */
export function plannedRR(trade: Trade | Pick<Trade, 'plan' | 'direction'>): number | null {
  const plan = trade.plan;
  if (!plan?.entry || !plan?.stopLoss || !plan?.target) return null;
  const risk = Math.abs(plan.entry - plan.stopLoss);
  if (risk <= 0) return null;
  const reward = Math.abs(plan.target - plan.entry);
  return round2(reward / risk);
}

/**
 * Auto-suggest a holding style from entry/exit timestamps.
 * Beginners still get an override via the form.
 */
export function suggestHoldingStyle(entryAt?: number, exitAt?: number): HoldingStyle | undefined {
  if (entryAt === undefined || exitAt === undefined) return undefined;
  const holdMs = Math.max(0, exitAt - entryAt);
  const holdMinutes = holdMs / 60000;
  if (holdMinutes <= 5) return 'SCALP';
  if (holdMinutes <= 6 * 60) return 'INTRADAY';
  if (holdMinutes <= 7 * 24 * 60) return 'SWING';
  return 'POSITIONAL';
}

/** True when a trade has any partial-fill data. */
export function hasPartialFills(trade: Trade): boolean {
  const entries = trade.entries?.length ?? 0;
  const exits = trade.exits?.length ?? 0;
  return entries > 1 || exits > 1;
}

/** Total qty on entries (for validation — must equal total qty on exits when closed). */
export function totalEntryQty(entries?: readonly Fill[]): number {
  return entries?.reduce((a, f) => a + f.qty, 0) ?? 0;
}
export function totalExitQty(exits?: readonly Fill[]): number {
  return exits?.reduce((a, f) => a + f.qty, 0) ?? 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

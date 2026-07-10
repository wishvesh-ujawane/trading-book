import type {
  BrokerConfig,
  BrokerTax,
  Instrument,
  Market,
  Trade,
} from '../types';

/**
 * Segment-aware fee engine.
 *
 * Replaces the old `flatBrokerage × 2 + turnover × slippage%` model which:
 * (a) double-counted slippage across both legs, and
 * (b) charged the same rupee taxes regardless of trade size.
 *
 * Every calculation here is a pure function of `(Trade, BrokerConfig)` so it
 * is trivially testable and can be re-run at read time.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the instrument to use for fee logic, synthesising one for legacy trades. */
export function resolveInstrument(trade: Trade): Instrument {
  if (trade.instrument) return trade.instrument;
  // Legacy trades are treated as cash equity, 1:1 lot.
  return {
    market: 'EQUITY',
    kind: 'CASH',
    underlying: trade.symbol,
    tradingSymbol: trade.symbol,
    lotSize: 1,
    exchange: 'NSE',
  };
}

/** Effective quantity in units, accounting for F&O lot size. */
export function effectiveQty(trade: Trade): number {
  const inst = resolveInstrument(trade);
  return trade.quantity * (inst.lotSize ?? 1);
}

/** Weighted-average price of a list of fills. */
export function vwap(fills: readonly { price: number; qty: number }[]): number {
  const totalQty = fills.reduce((acc, f) => acc + f.qty, 0);
  if (totalQty <= 0) return 0;
  const notional = fills.reduce((acc, f) => acc + f.price * f.qty, 0);
  return notional / totalQty;
}

/** Total qty across a list of fills. */
export function totalQty(fills: readonly { qty: number }[]): number {
  return fills.reduce((acc, f) => acc + f.qty, 0);
}

// ---------------------------------------------------------------------------
// Brokerage — segment-aware
// ---------------------------------------------------------------------------

/**
 * Per-leg brokerage in ₹ for a given turnover, instrument and broker preset.
 * Returns a per-*leg* value — call twice (entry + exit) for a round-trip.
 */
export function brokerageForLeg(
  broker: BrokerConfig,
  inst: Instrument,
  legTurnover: number,
): number {
  const preset = broker.presetKey;

  // Preset-aware pricing (matches published rate cards for Indian discount brokers).
  if (preset === 'dhan' || preset === 'zerodha' || preset === 'upstox' || preset === 'angelone' || preset === 'groww') {
    switch (inst.market) {
      case 'EQUITY':
        // Cash equity delivery — 0 for these discount brokers.
        if (inst.kind === 'CASH') {
          // Rough proxy: if broker's flat is 0, honor it as delivery pricing;
          // otherwise fall through to intraday-style min(flat, 0.03%).
          if (broker.brokeragePerTrade === 0) return 0;
          return Math.min(broker.brokeragePerTrade, legTurnover * 0.0003);
        }
        return Math.min(broker.brokeragePerTrade, legTurnover * 0.0003);
      case 'FNO':
      case 'COMMODITY':
      case 'CURRENCY':
        // Flat per-order for F&O / commodity / currency.
        return broker.brokeragePerTrade;
      case 'CRYPTO':
        // Crypto exchanges usually charge % — approximate with min(flat, 0.1%).
        return Math.min(broker.brokeragePerTrade, legTurnover * 0.001);
    }
  }

  // Fallback: naive flat per leg (matches old behaviour).
  return broker.brokeragePerTrade;
}

// ---------------------------------------------------------------------------
// Slippage — per-side, not sum of both
// ---------------------------------------------------------------------------

/**
 * Estimated slippage in ₹ for one side (entry OR exit).
 * `sidePrice × sideQty × (slippagePercent / 100)`.
 */
export function slippageForSide(
  broker: BrokerConfig,
  sidePrice: number,
  sideQty: number,
): number {
  if (broker.estimatedSlippagePercent <= 0) return 0;
  return sidePrice * sideQty * (broker.estimatedSlippagePercent / 100);
}

// ---------------------------------------------------------------------------
// Custom taxes — flat vs percent of turnover, market-scoped
// ---------------------------------------------------------------------------

/**
 * Total custom tax rupees for a round-trip, given per-side turnovers.
 * Rows without a `mode` are treated as flat (back-compat).
 * Rows with `appliesTo` are only counted when the trade's market matches.
 */
export function customTaxesForRoundTrip(
  rows: readonly BrokerTax[],
  market: Market,
  entryTurnover: number,
  exitTurnover: number,
): number {
  let total = 0;
  for (const row of rows) {
    if (row.appliesTo && row.appliesTo.length > 0 && !row.appliesTo.includes(market)) continue;
    const mode = row.mode ?? 'FLAT';
    if (mode === 'FLAT') {
      total += row.value;
    } else {
      // PERCENT_OF_TURNOVER — applied to the round-trip notional.
      total += (entryTurnover + exitTurnover) * (row.value / 100);
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Round-trip fee bundle for a trade
// ---------------------------------------------------------------------------

export interface FeeBreakdown {
  brokerage: number;
  slippage: number;
  taxes: number;
  total: number;
}

/**
 * Compute fees for a trade end-to-end. Reads fills when present, else
 * falls back to legacy `entryPrice` / `exitPrice` / `quantity`.
 */
export function computeFees(
  trade: Trade,
  broker: BrokerConfig | null,
): FeeBreakdown {
  if (!broker) return { brokerage: 0, slippage: 0, taxes: 0, total: 0 };

  const inst = resolveInstrument(trade);
  const lot = inst.lotSize ?? 1;

  const entries = trade.entries && trade.entries.length > 0
    ? trade.entries
    : [{ price: trade.entryPrice, qty: trade.quantity, at: trade.timestamp }];
  const exits = trade.exits && trade.exits.length > 0
    ? trade.exits
    : [{ price: trade.exitPrice, qty: trade.quantity, at: trade.timestamp }];

  // Turnovers — priced in the traded units, multiplied by lot size for F&O.
  const entryTurnover = entries.reduce((a, f) => a + f.price * f.qty * lot, 0);
  const exitTurnover = exits.reduce((a, f) => a + f.price * f.qty * lot, 0);

  // Brokerage — per-leg. F&O is per-order flat; equity intraday is min(flat, 0.03%).
  const brokerage = brokerageForLeg(broker, inst, entryTurnover)
    + brokerageForLeg(broker, inst, exitTurnover);

  // Slippage — per side (fixes the old double-count bug).
  const slippage = entries.reduce((a, f) => a + slippageForSide(broker, f.price, f.qty * lot), 0)
    + exits.reduce((a, f) => a + slippageForSide(broker, f.price, f.qty * lot), 0);

  const taxes = customTaxesForRoundTrip(
    broker.customTaxes ?? [],
    inst.market,
    entryTurnover,
    exitTurnover,
  );

  const total = brokerage + slippage + taxes;
  return {
    brokerage: round2(brokerage),
    slippage: round2(slippage),
    taxes: round2(taxes),
    total: round2(total),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Instrument / market taxonomy
// ---------------------------------------------------------------------------

/** Broad market segment for the trade. */
export type Market =
  | 'EQUITY'
  | 'FNO'
  | 'COMMODITY'
  | 'CURRENCY'
  | 'CRYPTO';

/** Kind of instrument within a market. */
export type InstrumentKind = 'CASH' | 'FUTURES' | 'OPTIONS';

/** Option type — Call or Put. */
export type OptionType = 'CE' | 'PE';

/** Exchange venue (India-centric plus a catch-all crypto bucket). */
export type Exchange =
  | 'NSE'
  | 'BSE'
  | 'NFO'
  | 'BFO'
  | 'MCX'
  | 'CDS'
  | 'CRYPTO';

/**
 * Structured instrument descriptor. When absent on a legacy `Trade`, the app
 * should treat it as `{ market: 'EQUITY', kind: 'CASH', lotSize: 1 }` with
 * `underlying` = the legacy `symbol` field.
 */
export interface Instrument {
  market: Market;
  kind: InstrumentKind;
  /** Underlying symbol, e.g. NIFTY, RELIANCE, BTCUSDT. */
  underlying: string;
  /** Full broker trading symbol, e.g. NIFTY25JAN25000CE. */
  tradingSymbol: string;
  /** Expiry date (YYYY-MM-DD) for futures/options. */
  expiry?: string;
  /** Strike price for options. */
  strike?: number;
  /** CE / PE for options. */
  optionType?: OptionType;
  /** Lot size (contract multiplier). Default 1 for cash equity. */
  lotSize: number;
  exchange?: Exchange;
}

// ---------------------------------------------------------------------------
// Fills & stop-loss changes (for partials / trailing SL support)
// ---------------------------------------------------------------------------

/** A single execution — one price/qty fill at a specific time. */
export interface Fill {
  price: number;
  /** Quantity in units (not lots). Multiply by `Instrument.lotSize` for F&O. */
  qty: number;
  /** Epoch ms. */
  at: number;
  note?: string;
}

/** One row in the trailing-stop-loss history. */
export interface SLChange {
  at: number;
  from: number;
  to: number;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Trade-shape enums
// ---------------------------------------------------------------------------

/** Chart timeframe the trade was analysed / entered on. */
export type ChartTimeframe =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '4h'
  | '1D'
  | '1W';

export const CHART_TIMEFRAMES: readonly ChartTimeframe[] = [
  '1m', '3m', '5m', '15m', '30m', '1h', '4h', '1D', '1W',
] as const;

/** Intended holding style. Auto-suggested from entry/exit times but user-overridable. */
export type HoldingStyle = 'SCALP' | 'INTRADAY' | 'SWING' | 'POSITIONAL';

export const HOLDING_STYLES: readonly HoldingStyle[] = [
  'SCALP', 'INTRADAY', 'SWING', 'POSITIONAL',
] as const;

/** Structured mistake tags — power the mistake-frequency analytics. */
export type MistakeTag =
  | 'NO_SL'
  | 'MOVED_SL_AGAINST'
  | 'REVENGE'
  | 'FOMO'
  | 'OVERSIZED'
  | 'CUT_WINNER_EARLY'
  | 'HELD_LOSER'
  | 'AGAINST_TREND'
  | 'NO_PLAN'
  | 'BROKE_RULES';

export const MISTAKE_TAG_LABELS: Record<MistakeTag, string> = {
  NO_SL: 'No stop loss',
  MOVED_SL_AGAINST: 'Moved SL against me',
  REVENGE: 'Revenge trade',
  FOMO: 'FOMO entry',
  OVERSIZED: 'Oversized position',
  CUT_WINNER_EARLY: 'Cut winner too early',
  HELD_LOSER: 'Held loser too long',
  AGAINST_TREND: 'Traded against trend',
  NO_PLAN: 'No trade plan',
  BROKE_RULES: 'Broke my rules',
};

// ---------------------------------------------------------------------------
// Broker config
// ---------------------------------------------------------------------------

/** How a custom tax row is computed. */
export type TaxMode = 'FLAT' | 'PERCENT_OF_TURNOVER';

/**
 * A custom tax / fee row on a broker. Backwards-compatible: an item without
 * `mode` is treated as `'FLAT'`; without `appliesTo` it applies to all markets.
 */
export interface BrokerTax {
  key: string;
  value: number;
  mode?: TaxMode;
  appliesTo?: Market[];
}

export interface BrokerConfig {
  id: string;
  name: string;
  brokeragePerTrade: number; // flat fee per trade (e.g., ₹20.00)
  estimatedSlippagePercent: number; // estimated slippage % (e.g., 0.02 for 0.02 %)
  customTaxes: BrokerTax[]; // extra taxes/fees; back-compat with old {key,value} rows
  /**
   * Preset id this broker mirrors — used by the fee engine to switch to
   * segment-aware pricing (e.g. Dhan intraday vs delivery vs options).
   * Absent = fall back to the naive `brokeragePerTrade × 2` model.
   */
  presetKey?: 'zerodha' | 'groww' | 'angelone' | 'upstox' | 'dhan';
}

// ---------------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------------

/**
 * A user-defined trading strategy. Trades can reference a `strategyId` to
 * enable per-strategy analytics.
 */
export interface Strategy {
  id: string;
  userId: string;
  name: string;
  description?: string;
  markets: Market[];
  defaultChartTimeframe?: ChartTimeframe;
  defaultHoldingStyle?: HoldingStyle;
  /** Pre-trade checklist items shown when logging a trade under this strategy. */
  checklist: string[];
  rules: {
    entry: string[];
    exit: string[];
    risk: string[];
  };
  tags?: string[];
  /** Colour hint for badges (any tailwind-safe hue name). */
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'teal';
  createdAt: number;
  updatedAt: number;
}

export const EMPTY_STRATEGY: Omit<Strategy, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  markets: [],
  checklist: [],
  rules: { entry: [], exit: [], risk: [] },
  tags: [],
};

// ---------------------------------------------------------------------------
// Trade
// ---------------------------------------------------------------------------

export interface Trade {
  id: string;
  userId: string;

  // --- legacy identification (kept for back-compat) ---
  symbol: string;
  direction: 'LONG' | 'SHORT';
  tradeType: 'LIVE' | 'DEMO';
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS';

  // --- legacy execution (kept as VWAP mirror when `entries`/`exits` present) ---
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  date: string; // YYYY-MM-DD (entry date, legacy)
  time?: string; // HH:MM (entry time, legacy)
  timestamp: number;

  // --- fees (cached; recomputed on read via lib/pnl.ts) ---
  brokerId: string;
  brokerageFee: number;
  slippageFee: number;
  taxFee: number;
  pnlGross: number;
  pnlNet: number;
  status: 'WIN' | 'LOSS' | 'BREAK_EVEN';

  findings: {
    whatWentWell: string;
    whatWentWrong: string;
    whatCouldBeImproved: string;
  };
  screenshotUrl?: string;

  /** AI Coach summary saved by the user (optional; per-device generation). */
  aiSummary?: {
    text: string;
    generatedAt: number;
    model: string;
  };

  // ---------------------------------------------------------------------
  // v2 additions — all optional so existing docs keep working unchanged.
  // ---------------------------------------------------------------------

  /** Strategy this trade was taken under. */
  strategyId?: string;
  /** Chart timeframe the trade was analysed on. */
  chartTimeframe?: ChartTimeframe;
  /** Intended holding style (may be auto-suggested from entry/exit times). */
  holdingStyle?: HoldingStyle;

  /** Structured instrument (F&O/commodity/crypto details). */
  instrument?: Instrument;

  /** Multiple entry fills. When present, VWAP is mirrored to `entryPrice`. */
  entries?: Fill[];
  /** Multiple exit fills. When present, VWAP is mirrored to `exitPrice`. */
  exits?: Fill[];

  /** Precise entry timestamp (epoch ms), superseding `date`+`time`. */
  entryAt?: number;
  /** Precise exit timestamp (epoch ms). */
  exitAt?: number;

  /** Planned levels — enable R-multiple math. */
  plan?: {
    entry?: number;
    stopLoss?: number;
    target?: number;
  };

  /** Trailing stop-loss change log. */
  stopLossHistory?: SLChange[];

  /** Structured mistake tags on top of freeform findings. */
  mistakes?: MistakeTag[];

  /** Realised R-multiple (derived, cached). */
  rMultiple?: number;
}

export interface UserStats {
  totalTrades: number;
  totalLiveTrades: number;
  totalDemoTrades: number;
  winRate: number; // %
  expectancy: number; // average Net Profit/Loss per trade
  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  totalFeesAndSlippage: number;
  winCount: number;
  lossCount: number;
  breakEvenCount: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
}

/**
 * User-defined monthly trading goals. All fields optional so a user can
 * enable individual targets without setting all three.
 */
export interface UserGoals {
  /** Target Net P&L in INR for the current calendar month. */
  monthlyNetProfitTarget?: number;
  /** Target win-rate percentage (0-100) for the current calendar month. */
  monthlyWinRateTarget?: number;
  /** Target number of trades logged in the current calendar month. */
  monthlyTradeCountTarget?: number;
}

export const EMPTY_GOALS: UserGoals = {};

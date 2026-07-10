export interface BrokerConfig {
  id: string;
  name: string;
  brokeragePerTrade: number; // flat fee per trade (e.g., $2.00)
  estimatedSlippagePercent: number; // estimated slippage % (e.g., 0.1 for 0.1%)
  customTaxes: { key: string; value: number }[]; // custom key-value list for extra taxes/fees
}

export interface Trade {
  id: string;
  userId: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  tradeType: 'LIVE' | 'DEMO';
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  timestamp: number;
  brokerId: string; // ID of the broker config used
  brokerageFee: number;
  slippageFee: number;
  taxFee: number;
  pnlGross: number;
  pnlNet: number;
  findings: {
    whatWentWell: string;
    whatWentWrong: string;
    whatCouldBeImproved: string;
  };
  screenshotUrl?: string; // base64 string or image asset URL
  status: 'WIN' | 'LOSS' | 'BREAK_EVEN';
  /** AI Coach summary saved by the user (optional; per-device generation). */
  aiSummary?: {
    text: string;
    generatedAt: number;
    model: string;
  };
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

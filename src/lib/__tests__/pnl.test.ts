import { describe, expect, it } from 'vitest';
import type { BrokerConfig, Trade } from '../../types';
import {
  avgEntry,
  avgExit,
  computeGrossPnl,
  computeLedger,
  computeRealisedR,
  deriveStatus,
  plannedRR,
  suggestHoldingStyle,
} from '../pnl';

function baseBroker(overrides: Partial<BrokerConfig> = {}): BrokerConfig {
  return {
    id: 'test',
    name: 'Test Broker',
    brokeragePerTrade: 0,
    estimatedSlippagePercent: 0,
    customTaxes: [],
    ...overrides,
  };
}

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    userId: 'u1',
    symbol: 'RELIANCE',
    direction: 'LONG',
    tradeType: 'LIVE',
    orderType: 'MARKET',
    entryPrice: 1500,
    exitPrice: 1550,
    quantity: 10,
    date: '2026-07-10',
    timestamp: 0,
    brokerId: 'test',
    brokerageFee: 0,
    slippageFee: 0,
    taxFee: 0,
    pnlGross: 0,
    pnlNet: 0,
    status: 'BREAK_EVEN',
    findings: { whatWentWell: '', whatWentWrong: '', whatCouldBeImproved: '' },
    ...overrides,
  };
}

describe('deriveStatus', () => {
  it('classifies with a 1-paise dead-band', () => {
    expect(deriveStatus(0)).toBe('BREAK_EVEN');
    expect(deriveStatus(0.005)).toBe('BREAK_EVEN');
    expect(deriveStatus(0.02)).toBe('WIN');
    expect(deriveStatus(-0.02)).toBe('LOSS');
  });
});

describe('computeGrossPnl — legacy equity', () => {
  it('LONG profit', () => {
    expect(computeGrossPnl(trade())).toBe(500);
  });
  it('SHORT profit when price falls', () => {
    expect(computeGrossPnl(trade({ direction: 'SHORT', entryPrice: 1550, exitPrice: 1500 }))).toBe(500);
  });
});

describe('computeGrossPnl — F&O options lot size', () => {
  it('NIFTY CE lot 75: entry 120 → exit 180 = 4500', () => {
    const t = trade({
      symbol: 'NIFTY',
      entryPrice: 120,
      exitPrice: 180,
      quantity: 1,
      instrument: {
        market: 'FNO',
        kind: 'OPTIONS',
        underlying: 'NIFTY',
        tradingSymbol: 'NIFTY25JAN25000CE',
        optionType: 'CE',
        strike: 25000,
        lotSize: 75,
        exchange: 'NFO',
      },
    });
    expect(computeGrossPnl(t)).toBe(4500);
  });
});

describe('computeGrossPnl — partial fills VWAP', () => {
  it('two-exit trade uses weighted-average exit price', () => {
    const t = trade({
      entryPrice: 100,
      exitPrice: 0, // superseded by fills
      quantity: 100,
      entries: [{ price: 100, qty: 100, at: 0 }],
      exits: [
        { price: 110, qty: 50, at: 1 },
        { price: 130, qty: 50, at: 2 },
      ],
    });
    // VWAP exit = (110×50 + 130×50)/100 = 120
    // Gross = (120 - 100) × 100 = 2000
    expect(avgExit(t)).toBe(120);
    expect(computeGrossPnl(t)).toBe(2000);
  });

  it('partial entry averaging with F&O lot size', () => {
    const t = trade({
      quantity: 2,
      entries: [
        { price: 100, qty: 1, at: 0 },
        { price: 120, qty: 1, at: 1 },
      ],
      exits: [{ price: 150, qty: 2, at: 2 }],
      instrument: {
        market: 'FNO',
        kind: 'OPTIONS',
        underlying: 'BANKNIFTY',
        tradingSymbol: 'BANKNIFTY25JAN55000CE',
        optionType: 'CE',
        strike: 55000,
        lotSize: 15,
        exchange: 'NFO',
      },
    });
    expect(avgEntry(t)).toBe(110);
    // Gross = (150 - 110) × 2 × 15 = 1200
    expect(computeGrossPnl(t)).toBe(1200);
  });
});

describe('computeRealisedR', () => {
  it('positive R for winning LONG trade', () => {
    const t = trade({
      entryPrice: 100,
      exitPrice: 130,
      plan: { entry: 100, stopLoss: 90, target: 130 },
    });
    // Perunit gain = 30, risk = 10 → R = 3
    expect(computeRealisedR(t)).toBe(3);
  });
  it('positive R for winning SHORT trade', () => {
    const t = trade({
      direction: 'SHORT',
      entryPrice: 100,
      exitPrice: 80,
      plan: { entry: 100, stopLoss: 110, target: 80 },
    });
    // Per-unit gain = (80-100) × -1 = 20; risk = 10; R = 2
    expect(computeRealisedR(t)).toBe(2);
  });
  it('returns null without a plan', () => {
    expect(computeRealisedR(trade())).toBeNull();
  });
  it('returns null when risk is zero', () => {
    expect(computeRealisedR(trade({ plan: { entry: 100, stopLoss: 100 } }))).toBeNull();
  });
});

describe('plannedRR', () => {
  it('computes RR from plan', () => {
    expect(plannedRR({ direction: 'LONG', plan: { entry: 100, stopLoss: 90, target: 130 } })).toBe(3);
  });
  it('null when plan incomplete', () => {
    expect(plannedRR({ direction: 'LONG', plan: { entry: 100 } })).toBeNull();
  });
});

describe('suggestHoldingStyle', () => {
  it('classifies scalp under 5 minutes', () => {
    expect(suggestHoldingStyle(0, 4 * 60_000)).toBe('SCALP');
  });
  it('classifies intraday up to 6 hours', () => {
    expect(suggestHoldingStyle(0, 3 * 3600_000)).toBe('INTRADAY');
  });
  it('classifies swing up to a week', () => {
    expect(suggestHoldingStyle(0, 2 * 24 * 3600_000)).toBe('SWING');
  });
  it('classifies positional beyond a week', () => {
    expect(suggestHoldingStyle(0, 30 * 24 * 3600_000)).toBe('POSITIONAL');
  });
  it('undefined when timestamps missing', () => {
    expect(suggestHoldingStyle(undefined, 1)).toBeUndefined();
  });
});

describe('computeLedger', () => {
  it('composes gross, fees, net, status', () => {
    const broker = baseBroker({ brokeragePerTrade: 20, estimatedSlippagePercent: 0 });
    const t = trade({ entryPrice: 100, exitPrice: 110, quantity: 10 });
    const l = computeLedger(t, broker);
    // Gross = 100; fees flat = 40; net = 60
    expect(l.grossPnl).toBe(100);
    expect(l.fees.brokerage).toBe(40);
    expect(l.netPnl).toBe(60);
    expect(l.status).toBe('WIN');
    expect(l.rMultiple).toBeNull();
  });
});

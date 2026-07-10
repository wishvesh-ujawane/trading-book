import { describe, expect, it } from 'vitest';
import type { BrokerConfig, Trade } from '../../types';
import {
  brokerageForLeg,
  computeFees,
  customTaxesForRoundTrip,
  resolveInstrument,
  slippageForSide,
  vwap,
} from '../feeEngine';

function baseBroker(overrides: Partial<BrokerConfig> = {}): BrokerConfig {
  return {
    id: 'test',
    name: 'Test Broker',
    brokeragePerTrade: 20,
    estimatedSlippagePercent: 0.02,
    customTaxes: [],
    ...overrides,
  };
}

function equityTrade(overrides: Partial<Trade> = {}): Trade {
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
    timestamp: 1_762_000_000_000,
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

describe('vwap', () => {
  it('returns weighted average across fills', () => {
    expect(vwap([{ price: 100, qty: 1 }, { price: 200, qty: 3 }])).toBe(175);
  });
  it('returns 0 on empty fills', () => {
    expect(vwap([])).toBe(0);
  });
});

describe('resolveInstrument — legacy fallback', () => {
  it('synthesises equity cash instrument for legacy trades', () => {
    const t = equityTrade();
    const inst = resolveInstrument(t);
    expect(inst.market).toBe('EQUITY');
    expect(inst.kind).toBe('CASH');
    expect(inst.lotSize).toBe(1);
    expect(inst.underlying).toBe('RELIANCE');
  });
  it('passes through explicit instrument', () => {
    const t = equityTrade({
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
    expect(resolveInstrument(t).market).toBe('FNO');
  });
});

describe('slippageForSide — regression on double-count bug', () => {
  it('applies slippage percent to one side only, not both summed', () => {
    // Old bug: (ep*qty + xp*qty) × pct → double the correct figure.
    // Correct: pct applied per side independently.
    const broker = baseBroker({ estimatedSlippagePercent: 0.02 });
    // ₹1500 × 1000 units = ₹15 lakh notional on entry side.
    const side = slippageForSide(broker, 1500, 1000);
    // 15,00,000 × 0.02 % = ₹300 per side, not ₹600 for the round-trip.
    expect(side).toBeCloseTo(300, 2);
  });
});

describe('brokerageForLeg — segment-aware', () => {
  it('Dhan cash equity delivery = 0 when flat is 0', () => {
    const b = baseBroker({ presetKey: 'dhan', brokeragePerTrade: 0 });
    const inst = resolveInstrument(equityTrade());
    expect(brokerageForLeg(b, inst, 500_000)).toBe(0);
  });
  it('Dhan intraday equity = min(20, 0.03%)', () => {
    const b = baseBroker({ presetKey: 'dhan', brokeragePerTrade: 20 });
    const inst = resolveInstrument(equityTrade());
    // Small turnover: 0.03% of 1000 = 0.3, less than 20 → charge 0.3.
    expect(brokerageForLeg(b, inst, 1000)).toBeCloseTo(0.3, 2);
    // Large turnover: 0.03% of 1_000_000 = 300, more than 20 → cap at 20.
    expect(brokerageForLeg(b, inst, 1_000_000)).toBe(20);
  });
  it('Dhan F&O = flat per order', () => {
    const b = baseBroker({ presetKey: 'dhan', brokeragePerTrade: 20 });
    const inst = { ...resolveInstrument(equityTrade()), market: 'FNO' as const, kind: 'OPTIONS' as const };
    expect(brokerageForLeg(b, inst, 500_000)).toBe(20);
  });
  it('fallback (no preset) = flat', () => {
    const b = baseBroker({ brokeragePerTrade: 25 });
    const inst = resolveInstrument(equityTrade());
    expect(brokerageForLeg(b, inst, 999_999)).toBe(25);
  });
});

describe('customTaxesForRoundTrip', () => {
  it('back-compat: rows without mode are flat', () => {
    const total = customTaxesForRoundTrip(
      [{ key: 'GST', value: 4.5 }, { key: 'STT', value: 9.5 }],
      'EQUITY',
      10_000,
      10_500,
    );
    expect(total).toBe(14);
  });
  it('percent-of-turnover scales with notional', () => {
    const total = customTaxesForRoundTrip(
      [{ key: 'STT', value: 0.025, mode: 'PERCENT_OF_TURNOVER' }],
      'EQUITY',
      10_00_000, // 10 lakh
      10_00_000,
    );
    // 20 lakh × 0.025% = ₹500
    expect(total).toBeCloseTo(500, 2);
  });
  it('appliesTo scopes taxes to specific markets', () => {
    const rows = [
      { key: 'STT', value: 0.05, mode: 'PERCENT_OF_TURNOVER' as const, appliesTo: ['EQUITY'] as const },
    ];
    // Trade in F&O — STT should not apply.
    expect(customTaxesForRoundTrip(
      rows.map((r) => ({ ...r, appliesTo: [...r.appliesTo] })),
      'FNO',
      1_000_000,
      1_000_000,
    )).toBe(0);
  });
});

describe('computeFees — end-to-end', () => {
  it('legacy equity trade: brokerage 2 legs + slippage per side', () => {
    const broker = baseBroker({ brokeragePerTrade: 20, estimatedSlippagePercent: 0.02 });
    const fees = computeFees(equityTrade({ entryPrice: 1500, exitPrice: 1550, quantity: 10 }), broker);
    // Brokerage: 20 × 2 = 40 (no preset → flat fallback)
    expect(fees.brokerage).toBe(40);
    // Slippage: (1500 × 10 × 0.0002) + (1550 × 10 × 0.0002) = 3 + 3.1 = 6.1
    expect(fees.slippage).toBeCloseTo(6.1, 2);
  });

  it('F&O options trade: lot size scales turnover for percent-based fees', () => {
    const broker = baseBroker({
      presetKey: 'dhan',
      brokeragePerTrade: 20,
      estimatedSlippagePercent: 0,
      customTaxes: [{ key: 'STT (sell)', value: 0.05, mode: 'PERCENT_OF_TURNOVER' }],
    });
    const trade = equityTrade({
      symbol: 'NIFTY',
      entryPrice: 120,
      exitPrice: 180,
      quantity: 1, // 1 lot
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
    const fees = computeFees(trade, broker);
    // Brokerage: Dhan FNO = 20 per leg × 2 = 40
    expect(fees.brokerage).toBe(40);
    // Turnover: entry 120×1×75 = 9000; exit 180×1×75 = 13500; round-trip 22500
    // STT % turnover: 22500 × 0.05% = 11.25
    expect(fees.taxes).toBeCloseTo(11.25, 2);
  });
});

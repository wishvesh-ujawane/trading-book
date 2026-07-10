import { useMemo, useState } from 'react';
import {
  Trade,
  UserGoals,
  UserStats,
  Strategy,
  BrokerConfig,
  ChartTimeframe,
  HoldingStyle,
  Market,
  CHART_TIMEFRAMES,
  HOLDING_STYLES,
} from '../types';
import DashboardCharts from './DashboardCharts';
import { AiCoachPanel } from './AiCoachPanel';
import { reviewWeek } from '../lib/aiCoach';
import { computeLedger } from '../lib/pnl';
import { Button, ProgressRing, StatCard, TabPill, TabPillGroup } from './ui';
import {
  BarChart3,
  AlertCircle,
  Target,
  Sparkles,
  Filter,
  X,
} from 'lucide-react';

interface DashboardProps {
  trades: Trade[];
  strategies?: Strategy[];
  brokers?: BrokerConfig[];
  timeframe: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ALL';
  onTimeframeChange: (timeframe: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ALL') => void;
  tradeTypeFilter: 'ALL' | 'LIVE' | 'DEMO';
  onTradeTypeFilterChange: (type: 'ALL' | 'LIVE' | 'DEMO') => void;
  goals: UserGoals;
  onEditGoals: () => void;
  onOpenSettings: () => void;
  onNewTrade: () => void;
}

const MARKETS: Market[] = ['EQUITY', 'FNO', 'COMMODITY', 'CURRENCY', 'CRYPTO'];
const MARKET_LABEL: Record<Market, string> = {
  EQUITY: 'Equity',
  FNO: 'F&O',
  COMMODITY: 'Commodity',
  CURRENCY: 'Currency',
  CRYPTO: 'Crypto',
};

// ---------------------------------------------------------------------------
// Calendar-boundary timeframe filter (local time — user is in Asia/Kolkata).
// ---------------------------------------------------------------------------
function startOfWindow(tf: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ALL'): number | null {
  if (tf === 'ALL') return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  if (tf === 'DAILY') return new Date(y, m, d, 0, 0, 0, 0).getTime();
  if (tf === 'WEEKLY') {
    // Week starts Monday (India convention).
    const day = now.getDay(); // 0 = Sun
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    return new Date(y, m, d - daysSinceMonday, 0, 0, 0, 0).getTime();
  }
  if (tf === 'MONTHLY') return new Date(y, m, 1, 0, 0, 0, 0).getTime();
  if (tf === 'YEARLY') return new Date(y, 0, 1, 0, 0, 0, 0).getTime();
  return null;
}

// ---------------------------------------------------------------------------

export default function Dashboard({
  trades,
  strategies = [],
  brokers = [],
  timeframe,
  onTimeframeChange,
  tradeTypeFilter,
  onTradeTypeFilterChange,
  goals,
  onEditGoals,
  onOpenSettings,
  onNewTrade,
}: DashboardProps) {
  // Extra filter state (local to Dashboard).
  const [strategyFilter, setStrategyFilter] = useState<string>('ALL');
  const [tfChartFilter, setTfChartFilter] = useState<'ALL' | ChartTimeframe>('ALL');
  const [styleFilter, setStyleFilter] = useState<'ALL' | HoldingStyle>('ALL');
  const [marketFilter, setMarketFilter] = useState<'ALL' | Market>('ALL');

  const brokerMap = useMemo(() => {
    const m: Record<string, BrokerConfig> = {};
    brokers.forEach((b) => { m[b.id] = b; });
    return m;
  }, [brokers]);

  // Recompute ledger on read: legacy trades and any trade whose fee-model or
  // instrument has changed will get up-to-date pnlNet/status/fees/rMultiple.
  const enrichedTrades = useMemo(() => {
    return trades.map((t) => {
      const broker = brokerMap[t.brokerId] ?? null;
      const l = computeLedger(t, broker);
      return {
        ...t,
        pnlGross: l.grossPnl,
        pnlNet: l.netPnl,
        brokerageFee: l.fees.brokerage,
        slippageFee: l.fees.slippage,
        taxFee: l.fees.taxes,
        status: l.status,
        rMultiple: l.rMultiple ?? undefined,
      } as Trade;
    });
  }, [trades, brokerMap]);

  const filteredTrades = useMemo(() => {
    let result = [...enrichedTrades];

    if (tradeTypeFilter !== 'ALL') result = result.filter((t) => t.tradeType === tradeTypeFilter);
    if (strategyFilter !== 'ALL') result = result.filter((t) => (t.strategyId ?? '') === strategyFilter);
    if (tfChartFilter !== 'ALL') result = result.filter((t) => t.chartTimeframe === tfChartFilter);
    if (styleFilter !== 'ALL') result = result.filter((t) => t.holdingStyle === styleFilter);
    if (marketFilter !== 'ALL') {
      result = result.filter((t) => (t.instrument?.market ?? 'EQUITY') === marketFilter);
    }

    // Calendar-boundary timeframe filter (start-of-day/week/month/year).
    const cutoff = startOfWindow(timeframe);
    if (cutoff !== null) {
      result = result.filter((t) => {
        const at = t.entryAt ?? t.timestamp ?? new Date(t.date).getTime();
        return at >= cutoff;
      });
    }

    return result;
  }, [enrichedTrades, tradeTypeFilter, timeframe, strategyFilter, tfChartFilter, styleFilter, marketFilter]);

  const stats: UserStats & { avgR: number | null; profitFactorInfinite: boolean } = useMemo(() => {
    const total = filteredTrades.length;
    let liveCount = 0, demoCount = 0;
    let winCount = 0, lossCount = 0, breakEvenCount = 0;
    let grossProfit = 0, grossLoss = 0, netProfit = 0, totalFees = 0;
    let sumWins = 0, sumLosses = 0;
    let pnlGrossTotal = 0;
    let rSum = 0, rCount = 0;

    filteredTrades.forEach((trade) => {
      if (trade.tradeType === 'LIVE') liveCount++; else demoCount++;

      if (trade.status === 'WIN') {
        winCount++; sumWins += trade.pnlNet; grossProfit += trade.pnlNet;
      } else if (trade.status === 'LOSS') {
        lossCount++; sumLosses += Math.abs(trade.pnlNet); grossLoss += Math.abs(trade.pnlNet);
      } else {
        breakEvenCount++;
      }

      netProfit += trade.pnlNet;
      pnlGrossTotal += trade.pnlGross ?? trade.pnlNet;
      totalFees += trade.brokerageFee + trade.slippageFee + trade.taxFee;

      if (typeof trade.rMultiple === 'number' && !isNaN(trade.rMultiple)) {
        rSum += trade.rMultiple; rCount++;
      }
    });

    const winRate = total > 0 ? (winCount / total) * 100 : 0;
    const expectancy = total > 0 ? netProfit / total : 0;
    const averageWin = winCount > 0 ? sumWins / winCount : 0;
    const averageLoss = lossCount > 0 ? sumLosses / lossCount : 0;

    let profitFactor: number;
    let profitFactorInfinite = false;
    if (grossLoss > 0) profitFactor = grossProfit / grossLoss;
    else if (grossProfit > 0) { profitFactor = Infinity; profitFactorInfinite = true; }
    else profitFactor = 0;

    return {
      totalTrades: total,
      totalLiveTrades: liveCount,
      totalDemoTrades: demoCount,
      winRate: parseFloat(winRate.toFixed(1)),
      expectancy: parseFloat(expectancy.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      grossLoss: parseFloat(grossLoss.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      pnlGrossTotal: parseFloat(pnlGrossTotal.toFixed(2)),
      totalFeesAndSlippage: parseFloat(totalFees.toFixed(2)),
      winCount, lossCount, breakEvenCount,
      averageWin: parseFloat(averageWin.toFixed(2)),
      averageLoss: parseFloat(averageLoss.toFixed(2)),
      profitFactor: profitFactorInfinite ? 99.99 : parseFloat(profitFactor.toFixed(2)),
      profitFactorInfinite,
      avgR: rCount > 0 ? parseFloat((rSum / rCount).toFixed(2)) : null,
    };
  }, [filteredTrades]);

  // Per-strategy performance stats (uses enriched trades so newly-configured
  // broker fees flow through automatically).
  const strategyStats = useMemo(() => {
    if (strategies.length === 0) return [];
    return strategies
      .map((s) => {
        const rows = filteredTrades.filter((t) => t.strategyId === s.id);
        if (rows.length === 0) return null;
        let wins = 0, losses = 0, be = 0, net = 0, rSum = 0, rCount = 0;
        rows.forEach((t) => {
          net += t.pnlNet;
          if (t.status === 'WIN') wins++; else if (t.status === 'LOSS') losses++; else be++;
          if (typeof t.rMultiple === 'number' && !isNaN(t.rMultiple)) { rSum += t.rMultiple; rCount++; }
        });
        const winRate = rows.length > 0 ? (wins / rows.length) * 100 : 0;
        return {
          id: s.id,
          name: s.name,
          color: s.color,
          count: rows.length,
          wins, losses, be,
          winRate: parseFloat(winRate.toFixed(1)),
          netProfit: parseFloat(net.toFixed(2)),
          avgR: rCount > 0 ? parseFloat((rSum / rCount).toFixed(2)) : null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.netProfit - a.netProfit);
  }, [strategies, filteredTrades]);

  // Current-month goal progress uses raw trades (calendar-aligned).
  const monthProgress = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthTrades = enrichedTrades.filter((t) => (t.entryAt ?? t.timestamp ?? new Date(t.date).getTime()) >= monthStart);
    let netProfit = 0; let wins = 0;
    monthTrades.forEach((t) => {
      netProfit += t.pnlNet;
      if (t.status === 'WIN') wins += 1;
    });
    const total = monthTrades.length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    return { netProfit, winRate, tradeCount: total };
  }, [enrichedTrades]);

  const hasGoals =
    goals.monthlyNetProfitTarget !== undefined ||
    goals.monthlyWinRateTarget !== undefined ||
    goals.monthlyTradeCountTarget !== undefined;

  const monthName = new Date().toLocaleString('en-IN', { month: 'long' });

  const hasExtraFilters = strategyFilter !== 'ALL' || tfChartFilter !== 'ALL'
    || styleFilter !== 'ALL' || marketFilter !== 'ALL';

  const clearExtraFilters = () => {
    setStrategyFilter('ALL'); setTfChartFilter('ALL');
    setStyleFilter('ALL'); setMarketFilter('ALL');
  };

  return (
    <div className="space-y-6">

      {/* Controls & Title bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/50 border border-slate-800 p-5 rounded-2xl backdrop-blur-md shadow-lg">
        <div>
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Performance Dashboard
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Realtime automated performance metrics and ledger indicators.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          <TabPillGroup aria-label="Filter trades by type">
            {(['ALL', 'LIVE', 'DEMO'] as const).map((type) => (
              <TabPill key={type} active={tradeTypeFilter === type} onClick={() => onTradeTypeFilterChange(type)}>
                {type === 'ALL' ? 'All' : type === 'LIVE' ? 'Live Only' : 'Demo Only'}
              </TabPill>
            ))}
          </TabPillGroup>

          <TabPillGroup aria-label="Filter trades by timeframe">
            {(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ALL'] as const).map((tf) => (
              <TabPill key={tf} active={timeframe === tf} onClick={() => onTimeframeChange(tf)} className="px-2.5">
                {tf.charAt(0) + tf.slice(1).toLowerCase()}
              </TabPill>
            ))}
          </TabPillGroup>
        </div>
      </div>

      {/* Extended filter row */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3.5 flex flex-wrap gap-x-4 gap-y-2 items-center">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-slate-400">
          <Filter className="w-3.5 h-3.5" /> Filter
        </div>

        <FilterSelect
          label="Strategy"
          value={strategyFilter}
          onChange={setStrategyFilter}
          options={[
            { value: 'ALL', label: 'All strategies' },
            { value: '', label: '— None —' },
            ...strategies.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
        <FilterSelect
          label="Chart TF"
          value={tfChartFilter}
          onChange={(v) => setTfChartFilter(v as 'ALL' | ChartTimeframe)}
          options={[{ value: 'ALL', label: 'Any' }, ...CHART_TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))]}
        />
        <FilterSelect
          label="Holding"
          value={styleFilter}
          onChange={(v) => setStyleFilter(v as 'ALL' | HoldingStyle)}
          options={[{ value: 'ALL', label: 'Any' }, ...HOLDING_STYLES.map((h) => ({ value: h, label: h }))]}
        />
        <FilterSelect
          label="Market"
          value={marketFilter}
          onChange={(v) => setMarketFilter(v as 'ALL' | Market)}
          options={[{ value: 'ALL', label: 'Any' }, ...MARKETS.map((m) => ({ value: m, label: MARKET_LABEL[m] }))]}
        />

        {hasExtraFilters && (
          <button
            type="button"
            onClick={clearExtraFilters}
            className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}

        <span className="ml-auto text-[10px] text-slate-500 font-mono">
          {filteredTrades.length} trade{filteredTrades.length === 1 ? '' : 's'} shown
        </span>
      </div>

      {/* Monthly Goals */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-400" />
              {monthName} Goals
            </h3>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Progress this calendar month toward your personal targets.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onEditGoals}>
            {hasGoals ? 'Edit goals' : 'Set goals'}
          </Button>
        </div>

        {hasGoals ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 justify-items-center">
            {goals.monthlyNetProfitTarget !== undefined && (() => {
              const target = goals.monthlyNetProfitTarget;
              const progress = target > 0 ? monthProgress.netProfit / target : 0;
              const pct = Math.round(progress * 100);
              const positive = monthProgress.netProfit >= 0;
              return (
                <ProgressRing value={progress} colorClass={positive ? 'text-emerald-400' : 'text-rose-400'}
                  label="Net P&L" hint={`Target: \u20B9${target.toLocaleString('en-IN')}`}
                  aria-label={`${pct}% of monthly profit goal`}>
                  <span className={`text-lg font-black font-mono ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>{pct}%</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {positive ? '+' : ''}{'\u20B9'}{Math.round(monthProgress.netProfit).toLocaleString('en-IN')}
                  </span>
                </ProgressRing>
              );
            })()}

            {goals.monthlyWinRateTarget !== undefined && (() => {
              const target = goals.monthlyWinRateTarget;
              const progress = target > 0 ? monthProgress.winRate / target : 0;
              const pct = Math.round(progress * 100);
              return (
                <ProgressRing value={progress} colorClass="text-blue-400" label="Win Rate"
                  hint={`Target: ${target}%`} aria-label={`${pct}% of monthly win-rate goal`}>
                  <span className="text-lg font-black font-mono text-blue-400">{pct}%</span>
                  <span className="text-[10px] text-slate-500 font-mono">{monthProgress.winRate.toFixed(1)}%</span>
                </ProgressRing>
              );
            })()}

            {goals.monthlyTradeCountTarget !== undefined && (() => {
              const target = goals.monthlyTradeCountTarget;
              const progress = target > 0 ? monthProgress.tradeCount / target : 0;
              const pct = Math.round(progress * 100);
              return (
                <ProgressRing value={progress} colorClass="text-indigo-400" label="Trades"
                  hint={`Target: ${target}`} aria-label={`${pct}% of monthly trade-count goal`}>
                  <span className="text-lg font-black font-mono text-indigo-400">{pct}%</span>
                  <span className="text-[10px] text-slate-500 font-mono">{monthProgress.tradeCount} / {target}</span>
                </ProgressRing>
              );
            })()}
          </div>
        ) : (
          <p className="text-xs text-slate-500 leading-relaxed">
            Set optional monthly targets (Net P&amp;L, Win Rate, Trade Count) in Settings to see progress rings here.
          </p>
        )}
      </div>

      {/* Bento Grid Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Net Profit / Loss"
          accent={stats.netProfit >= 0 ? 'emerald' : 'rose'}
          valueClassName={stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}
          value={<>{stats.netProfit >= 0 ? '+' : ''}{'\u20B9'}{stats.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</>}
          footer={
            <div className="flex justify-between">
              <span>Gross: {'\u20B9'}{stats.pnlGrossTotal.toLocaleString('en-IN')}</span>
              <span>Fees: {'\u20B9'}{stats.totalFeesAndSlippage.toLocaleString('en-IN')}</span>
            </div>
          }
        />
        <StatCard
          label="Win Rate"
          accent="blue"
          valueClassName="text-blue-400"
          value={`${stats.winRate}%`}
          footer={
            <div className="flex justify-between font-mono">
              <span className="text-emerald-400 font-bold">{stats.winCount}W</span>
              <span className="text-slate-500">|</span>
              <span className="text-rose-400 font-bold">{stats.lossCount}L</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">{stats.breakEvenCount}BE</span>
            </div>
          }
        />
        <StatCard
          label="Expectancy"
          accent="indigo"
          valueClassName={stats.expectancy >= 0 ? 'text-indigo-400' : 'text-rose-400'}
          value={<>{stats.expectancy >= 0 ? '+' : ''}{'\u20B9'}{stats.expectancy.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}
          footer="Avg net return per trade executed."
        />
        <StatCard
          label="Profit Factor"
          accent="purple"
          valueClassName={
            stats.profitFactorInfinite || stats.profitFactor >= 2.0
              ? 'text-emerald-400'
              : stats.profitFactor >= 1.0 ? 'text-indigo-400' : 'text-rose-400'
          }
          value={stats.profitFactorInfinite ? '\u221E' : stats.profitFactor.toFixed(2)}
          footer={
            <div className="flex justify-between">
              <span>Avg Win: {'\u20B9'}{stats.averageWin.toLocaleString('en-IN')}</span>
              <span>Avg Loss: {'\u20B9'}{stats.averageLoss.toLocaleString('en-IN')}</span>
            </div>
          }
        />
        <StatCard
          label="Avg R Multiple"
          accent="emerald"
          valueClassName={stats.avgR === null ? 'text-slate-400' : stats.avgR >= 0 ? 'text-emerald-400' : 'text-rose-400'}
          value={stats.avgR === null ? '—' : `${stats.avgR > 0 ? '+' : ''}${stats.avgR.toFixed(2)}R`}
          footer={stats.avgR === null
            ? 'Log planned entry + SL on trades to unlock.'
            : stats.avgR >= 0 ? 'You are risking well relative to reward.' : 'Wins are smaller than your risk on average.'}
        />
      </div>

      {stats.totalTrades > 0 && (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 px-4 flex items-start gap-3 text-xs text-slate-400 leading-relaxed">
          <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <p>
            {stats.expectancy >= 0
              ? <span>Your trading expectancy is <b className="text-emerald-400">positive</b> (₹{stats.expectancy.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Every trade you take is expected to return profit in the long run — keep following your rules.</span>
              : <span>Your expectancy is <b className="text-rose-400">negative</b> (₹{stats.expectancy.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Your losses or transaction fees outpace your wins. Analyze your <em>what went wrong</em> findings to locate performance leaks.</span>
            }
            {" "}Profit Factor of <b>{stats.profitFactorInfinite ? '\u221E' : stats.profitFactor}</b> means you generated ₹{stats.profitFactorInfinite ? '\u221E' : stats.profitFactor.toFixed(2)} in profit for every ₹1 lost.
          </p>
        </div>
      )}

      {/* Per-strategy performance table */}
      {strategyStats.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Strategy performance
            </h3>
            <span className="text-[10px] text-slate-500">Filtered by the current selection</span>
          </div>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs text-slate-300 min-w-[560px]">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="text-left font-semibold px-2 py-2">Strategy</th>
                  <th className="text-right font-semibold px-2 py-2">Trades</th>
                  <th className="text-right font-semibold px-2 py-2">W / L / BE</th>
                  <th className="text-right font-semibold px-2 py-2">Win %</th>
                  <th className="text-right font-semibold px-2 py-2">Net P&L</th>
                  <th className="text-right font-semibold px-2 py-2">Avg R</th>
                </tr>
              </thead>
              <tbody>
                {strategyStats.map((row) => (
                  <tr key={row.id} className="border-b border-slate-900/80 last:border-0">
                    <td className="px-2 py-2 font-semibold text-white flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: row.color }} />
                      {row.name}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{row.count}</td>
                    <td className="px-2 py-2 text-right font-mono">
                      <span className="text-emerald-400">{row.wins}</span>
                      <span className="text-slate-600"> / </span>
                      <span className="text-rose-400">{row.losses}</span>
                      <span className="text-slate-600"> / </span>
                      <span className="text-slate-400">{row.be}</span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{row.winRate}%</td>
                    <td className={`px-2 py-2 text-right font-mono font-semibold ${row.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {row.netProfit >= 0 ? '+' : ''}₹{row.netProfit.toLocaleString('en-IN')}
                    </td>
                    <td className={`px-2 py-2 text-right font-mono ${row.avgR === null ? 'text-slate-500' : row.avgR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {row.avgR === null ? '—' : `${row.avgR > 0 ? '+' : ''}${row.avgR}R`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Render Charts inside Dashboard */}
      <div className="mt-8">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-3 pl-1">Performance Analytics Visualizations</span>
        <DashboardCharts trades={filteredTrades} onNewTrade={onNewTrade} />
      </div>

      {/* Weekly AI Review */}
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-3 pl-1">Weekly AI Review</span>
        <AiCoachPanel
          title="This week's coach"
          description="Gemini reviews your last 7 days of trades and highlights discipline and edge patterns."
          onOpenSettings={onOpenSettings}
          onGenerate={async () => {
            const now = Date.now();
            const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
            const recent = enrichedTrades.filter((t) => (t.entryAt ?? t.timestamp ?? new Date(t.date).getTime()) >= weekAgo);
            return reviewWeek(recent);
          }}
        />
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Small render helpers
// ---------------------------------------------------------------------------

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
      <span className="uppercase tracking-wider font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

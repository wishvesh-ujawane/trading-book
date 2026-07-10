import { useMemo } from 'react';
import { Trade, UserGoals, UserStats } from '../types';
import DashboardCharts from './DashboardCharts';
import { AiCoachPanel } from './AiCoachPanel';
import { reviewWeek } from '../lib/aiCoach';
import { Button, ProgressRing, StatCard, TabPill, TabPillGroup } from './ui';
import {
  BarChart3,
  AlertCircle,
  Target
} from 'lucide-react';

interface DashboardProps {
  trades: Trade[];
  timeframe: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ALL';
  onTimeframeChange: (timeframe: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ALL') => void;
  tradeTypeFilter: 'ALL' | 'LIVE' | 'DEMO';
  onTradeTypeFilterChange: (type: 'ALL' | 'LIVE' | 'DEMO') => void;
  goals: UserGoals;
  onEditGoals: () => void;
  onOpenSettings: () => void;
  onNewTrade: () => void;
}

export default function Dashboard({ 
  trades, 
  timeframe, 
  onTimeframeChange,
  tradeTypeFilter,
  onTradeTypeFilterChange,
  goals,
  onEditGoals,
  onOpenSettings,
  onNewTrade,
}: DashboardProps) {

  // Filter trades based on timeframe & trade type
  const filteredTrades = useMemo(() => {
    let result = [...trades];

    // Filter by live/demo trade type
    if (tradeTypeFilter !== 'ALL') {
      result = result.filter(t => t.tradeType === tradeTypeFilter);
    }

    // Filter by timeframe
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    result = result.filter(trade => {
      const tradeDate = new Date(trade.date);
      const diffTime = Math.abs(now.getTime() - tradeDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (timeframe === 'DAILY') {
        return trade.date === todayStr || diffDays <= 1;
      }
      if (timeframe === 'WEEKLY') {
        return diffDays <= 7;
      }
      if (timeframe === 'MONTHLY') {
        return diffDays <= 30;
      }
      if (timeframe === 'YEARLY') {
        return diffDays <= 365;
      }
      return true; // ALL
    });

    return result;
  }, [trades, timeframe, tradeTypeFilter]);

  // Compute Performance Statistics
  const stats: UserStats = useMemo(() => {
    const total = filteredTrades.length;
    let liveCount = 0;
    let demoCount = 0;
    let winCount = 0;
    let lossCount = 0;
    let breakEvenCount = 0;
    
    let grossProfit = 0;
    let grossLoss = 0;
    let netProfit = 0;
    let totalFees = 0;
    
    let sumWins = 0;
    let sumLosses = 0;

    filteredTrades.forEach((trade) => {
      // Counters
      if (trade.tradeType === 'LIVE') liveCount++;
      else demoCount++;

      if (trade.status === 'WIN') {
        winCount++;
        sumWins += trade.pnlNet;
        grossProfit += trade.pnlNet;
      } else if (trade.status === 'LOSS') {
        lossCount++;
        sumLosses += Math.abs(trade.pnlNet);
        grossLoss += Math.abs(trade.pnlNet);
      } else {
        breakEvenCount++;
      }

      netProfit += trade.pnlNet;
      totalFees += (trade.brokerageFee + trade.slippageFee + trade.taxFee);
    });

    const winRate = total > 0 ? (winCount / total) * 100 : 0;
    const expectancy = total > 0 ? netProfit / total : 0;
    
    const averageWin = winCount > 0 ? sumWins / winCount : 0;
    const averageLoss = lossCount > 0 ? sumLosses / lossCount : 0;
    
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 1.0;

    return {
      totalTrades: total,
      totalLiveTrades: liveCount,
      totalDemoTrades: demoCount,
      winRate: parseFloat(winRate.toFixed(1)),
      expectancy: parseFloat(expectancy.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      grossLoss: parseFloat(grossLoss.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      totalFeesAndSlippage: parseFloat(totalFees.toFixed(2)),
      winCount,
      lossCount,
      breakEvenCount,
      averageWin: parseFloat(averageWin.toFixed(2)),
      averageLoss: parseFloat(averageLoss.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2))
    };
  }, [filteredTrades]);

  // Compute current-calendar-month stats independently of the timeframe/type
  // filters, so the goal progress rings always track the actual month.
  const monthProgress = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthTrades = trades.filter((t) => (t.date ?? '').startsWith(monthKey));
    let netProfit = 0;
    let wins = 0;
    monthTrades.forEach((t) => {
      netProfit += t.pnlNet;
      if (t.status === 'WIN') wins += 1;
    });
    const total = monthTrades.length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    return { netProfit, winRate, tradeCount: total };
  }, [trades]);

  const hasGoals =
    goals.monthlyNetProfitTarget !== undefined ||
    goals.monthlyWinRateTarget !== undefined ||
    goals.monthlyTradeCountTarget !== undefined;

  const monthName = new Date().toLocaleString('en-IN', { month: 'long' });

  return (
    <div className="space-y-6">
      
      {/* Controls & Title bar Styled as Bento Header */}
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

        {/* Filter controls */}
        <div className="flex flex-wrap gap-2.5 items-center">
          {/* Live vs Demo filter */}
          <TabPillGroup aria-label="Filter trades by type">
            {(['ALL', 'LIVE', 'DEMO'] as const).map((type) => (
              <TabPill
                key={type}
                active={tradeTypeFilter === type}
                onClick={() => onTradeTypeFilterChange(type)}
              >
                {type === 'ALL' ? 'All' : type === 'LIVE' ? 'Live Only' : 'Demo Only'}
              </TabPill>
            ))}
          </TabPillGroup>

          {/* Timeframe Selector */}
          <TabPillGroup aria-label="Filter trades by timeframe">
            {(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ALL'] as const).map((tf) => (
              <TabPill
                key={tf}
                active={timeframe === tf}
                onClick={() => onTimeframeChange(tf)}
                className="px-2.5"
              >
                {tf.charAt(0) + tf.slice(1).toLowerCase()}
              </TabPill>
            ))}
          </TabPillGroup>
        </div>
      </div>

      {/* Monthly Goals — always visible; when unset shows a nudge to configure. */}
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
                <ProgressRing
                  value={progress}
                  colorClass={positive ? 'text-emerald-400' : 'text-rose-400'}
                  label="Net P&L"
                  hint={`Target: \u20B9${target.toLocaleString('en-IN')}`}
                  aria-label={`${pct}% of monthly profit goal`}
                >
                  <span className={`text-lg font-black font-mono ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {pct}%
                  </span>
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
                <ProgressRing
                  value={progress}
                  colorClass="text-blue-400"
                  label="Win Rate"
                  hint={`Target: ${target}%`}
                  aria-label={`${pct}% of monthly win-rate goal`}
                >
                  <span className="text-lg font-black font-mono text-blue-400">{pct}%</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {monthProgress.winRate.toFixed(1)}%
                  </span>
                </ProgressRing>
              );
            })()}

            {goals.monthlyTradeCountTarget !== undefined && (() => {
              const target = goals.monthlyTradeCountTarget;
              const progress = target > 0 ? monthProgress.tradeCount / target : 0;
              const pct = Math.round(progress * 100);
              return (
                <ProgressRing
                  value={progress}
                  colorClass="text-indigo-400"
                  label="Trades"
                  hint={`Target: ${target}`}
                  aria-label={`${pct}% of monthly trade-count goal`}
                >
                  <span className="text-lg font-black font-mono text-indigo-400">{pct}%</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {monthProgress.tradeCount} / {target}
                  </span>
                </ProgressRing>
              );
            })()}
          </div>
        ) : (
          <p className="text-xs text-slate-500 leading-relaxed">
            Set optional monthly targets (Net P&amp;L, Win Rate, Trade Count) in
            Settings to see progress rings here. They give you a lightweight,
            month-over-month accountability nudge.
          </p>
        )}
      </div>

      {/* Bento Grid Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        <StatCard
          label="Net Profit / Loss"
          accent={stats.netProfit >= 0 ? 'emerald' : 'rose'}
          valueClassName={stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}
          value={
            <>
              {stats.netProfit >= 0 ? '+' : ''}
              {'\u20B9'}
              {stats.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </>
          }
          footer={
            <div className="flex justify-between">
              <span>Gross: {'\u20B9'}{stats.grossProfit.toLocaleString('en-IN')}</span>
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
          value={
            <>
              {stats.expectancy >= 0 ? '+' : ''}
              {'\u20B9'}
              {stats.expectancy.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </>
          }
          footer="Avg net return per trade executed."
        />

        <StatCard
          label="Profit Factor"
          accent="purple"
          valueClassName={
            stats.profitFactor >= 2.0
              ? 'text-emerald-400'
              : stats.profitFactor >= 1.0
              ? 'text-indigo-400'
              : 'text-rose-400'
          }
          value={stats.profitFactor.toFixed(2)}
          footer={
            <div className="flex justify-between">
              <span>Avg Win: {'\u20B9'}{stats.averageWin.toLocaleString('en-IN')}</span>
              <span>Avg Loss: {'\u20B9'}{stats.averageLoss.toLocaleString('en-IN')}</span>
            </div>
          }
        />

      </div>

      {/* Stats explanation for beginners */}
      {stats.totalTrades > 0 && (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 px-4 flex items-start gap-3 text-xs text-slate-400 leading-relaxed">
          <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <p>
            {stats.expectancy >= 0 ? (
              <span>Your trading expectancy is **positive** (₹{stats.expectancy.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Every trade you take is expected to return profit in the long run. Keep following your rules.</span>
            ) : (
              <span>Your expectancy is **negative** (₹{stats.expectancy.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Your losses or transaction fees outpace your wins. Analyze your **what went wrong** findings to locate performance leaks.</span>
            )}
            {" "}Profit Factor of **{stats.profitFactor}** indicates that you generated ₹{stats.profitFactor.toFixed(2)} in profit for every ₹1 lost.
          </p>
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
            const recent = trades.filter((t) => t.timestamp >= weekAgo);
            return reviewWeek(recent);
          }}
        />
      </div>

    </div>
  );
}

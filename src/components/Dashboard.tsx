import { useMemo } from 'react';
import { Trade, UserStats } from '../types';
import DashboardCharts from './DashboardCharts';
import { StatCard, TabPill, TabPillGroup } from './ui';
import {
  BarChart3,
  AlertCircle
} from 'lucide-react';

interface DashboardProps {
  trades: Trade[];
  timeframe: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ALL';
  onTimeframeChange: (timeframe: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ALL') => void;
  tradeTypeFilter: 'ALL' | 'LIVE' | 'DEMO';
  onTradeTypeFilterChange: (type: 'ALL' | 'LIVE' | 'DEMO') => void;
}

export default function Dashboard({ 
  trades, 
  timeframe, 
  onTimeframeChange,
  tradeTypeFilter,
  onTradeTypeFilterChange
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
        <DashboardCharts trades={filteredTrades} />
      </div>

    </div>
  );
}

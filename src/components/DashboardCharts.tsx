import { useMemo } from 'react';
import { Trade } from '../types';
import { Button, EmptyState } from './ui';
import { LineChart, Plus } from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';

interface DashboardChartsProps {
  trades: Trade[];
  onNewTrade?: () => void;
}

export default function DashboardCharts({ trades, onNewTrade }: DashboardChartsProps) {
  // Process data for Cumulative Equity Curve
  const equityCurveData = useMemo(() => {
    // Sort trades from oldest to newest to compute cumulative P&L
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    
    let cumulativePnl = 0;
    return sortedTrades.map((trade) => {
      cumulativePnl += trade.pnlNet;
      const formattedDate = new Date(trade.timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
      return {
        date: formattedDate,
        netProfit: parseFloat(cumulativePnl.toFixed(2)),
        tradePnl: parseFloat(trade.pnlNet.toFixed(2)),
        symbol: trade.symbol
      };
    });
  }, [trades]);

  // Process data for Win/Loss/Break-Even Pie Chart
  const outcomeDistribution = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let breakEvens = 0;

    trades.forEach(t => {
      if (t.status === 'WIN') wins++;
      else if (t.status === 'LOSS') losses++;
      else breakEvens++;
    });

    return [
      { name: 'Wins', value: wins, color: '#10b981' }, // emerald-500
      { name: 'Losses', value: losses, color: '#f43f5e' }, // rose-500
      { name: 'Break Evens', value: breakEvens, color: '#64748b' } // slate-500
    ].filter(item => item.value > 0);
  }, [trades]);

  // Process data for P&L by Order Type (Market, Limit, Stop-loss)
  const orderTypeData = useMemo(() => {
    const dataMap: Record<string, { count: number; netPnl: number }> = {
      MARKET: { count: 0, netPnl: 0 },
      LIMIT: { count: 0, netPnl: 0 },
      STOP_LOSS: { count: 0, netPnl: 0 }
    };

    trades.forEach(t => {
      if (dataMap[t.orderType]) {
        dataMap[t.orderType].count++;
        dataMap[t.orderType].netPnl += t.pnlNet;
      }
    });

    return Object.entries(dataMap).map(([key, val]) => ({
      name: key === 'STOP_LOSS' ? 'Stop Loss' : key.charAt(0) + key.slice(1).toLowerCase(),
      Pnl: parseFloat(val.netPnl.toFixed(2)),
      Trades: val.count
    }));
  }, [trades]);

  // Process P&L distribution by Trade Type (Live vs Demo)
  const tradeTypeData = useMemo(() => {
    let livePnl = 0;
    let demoPnl = 0;

    trades.forEach(t => {
      if (t.tradeType === 'LIVE') livePnl += t.pnlNet;
      else demoPnl += t.pnlNet;
    });

    return [
      { name: 'Live', Pnl: parseFloat(livePnl.toFixed(2)), color: '#6366f1' }, // indigo-500
      { name: 'Demo', Pnl: parseFloat(demoPnl.toFixed(2)), color: '#3b82f6' }  // blue-500
    ];
  }, [trades]);

  // Custom tooltips for nice styling
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const isPositive = payload[0].value >= 0;
      return (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl font-sans text-xs space-y-1">
          <p className="text-slate-400 font-medium">{label}</p>
          {payload[0].payload.symbol && (
            <p className="text-white font-bold">Symbol: <span className="text-indigo-400">{payload[0].payload.symbol}</span></p>
          )}
          <p className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            Cumulative: ₹{payload[0].value.toLocaleString('en-IN')}
          </p>
          {payload[0].payload.tradePnl !== undefined && (
            <p className={`text-[10px] ${payload[0].payload.tradePnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              Trade P&L: ₹{payload[0].payload.tradePnl.toLocaleString('en-IN')}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const BarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const val = payload[0].value;
      const isPositive = val >= 0;
      return (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl font-sans text-xs space-y-1">
          <p className="text-slate-400 font-medium">{label}</p>
          <p className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            Net P&L: ₹{val.toLocaleString('en-IN')}
          </p>
          <p className="text-slate-400 text-[10px]">
            Trades: {payload[0].payload.Trades || payload[0].payload.count || 0}
          </p>
        </div>
      );
    }
    return null;
  };

  if (trades.length === 0) {
    return (
      <div className="bg-slate-900/40 border border-slate-850 rounded-2xl">
        <EmptyState
          icon={<LineChart className="w-6 h-6" />}
          title="Nothing to chart yet"
          description="Charts appear once you've logged at least one trade — equity curve, win/loss mix, order-type breakdown, and Live vs Demo split."
          action={
            onNewTrade ? (
              <Button onClick={onNewTrade} leadingIcon={<Plus className="w-4 h-4" />}>
                Log a trade
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-12 gap-6">
      
      {/* Cumulative Equity Curve - AreaChart */}
      <div className="md:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h3 className="font-display text-sm font-bold text-white mb-1.5">Net Profit Equity Curve</h3>
        <p className="text-slate-400 text-[11px] mb-4">Cumulative Net Profit/Loss (₹) tracked over time.</p>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={equityCurveData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.4} />
              <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                fontSize={10}
                tickLine={false}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={10}
                tickLine={false}
                tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="netProfit" 
                stroke={equityCurveData[equityCurveData.length - 1]?.netProfit >= 0 ? '#10b981' : '#f43f5e'} 
                strokeWidth={2}
                fillOpacity={1}
                fill={equityCurveData[equityCurveData.length - 1]?.netProfit >= 0 ? "url(#colorProfit)" : "url(#colorLoss)"} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Outcome Distribution - PieChart */}
      <div className="md:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div>
          <h3 className="font-display text-sm font-bold text-white mb-1.5">Trade Outcomes</h3>
          <p className="text-slate-400 text-[11px] mb-4">Distribution of Wins, Losses, and Break-evens.</p>
        </div>
        <div className="h-[180px] w-full flex items-center justify-center relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={outcomeDistribution}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
              >
                {outcomeDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: any, name: string) => [`${value} Trades`, name]} 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '11px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Centered Stats */}
          <div className="absolute text-center">
            <span className="block text-2xl font-black text-white">{trades.length}</span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Logged</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 mt-4 pt-4 border-t border-slate-850 text-center">
          {['Wins', 'Losses', 'Break Evens'].map((label) => {
            const count = trades.filter(t => 
              label === 'Wins' ? t.status === 'WIN' : 
              label === 'Losses' ? t.status === 'LOSS' : t.status === 'BREAK_EVEN'
            ).length;
            const pct = trades.length > 0 ? Math.round((count / trades.length) * 100) : 0;
            const colorClass = label === 'Wins' ? 'text-emerald-400' : label === 'Losses' ? 'text-rose-400' : 'text-slate-400';
            return (
              <div key={label}>
                <span className={`block text-xs font-bold ${colorClass}`}>{count}</span>
                <span className="block text-[9px] text-slate-500 uppercase tracking-wide">{label} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Net Profit by Order Type - BarChart */}
      <div className="md:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h3 className="font-display text-sm font-bold text-white mb-1.5">P&L by Order Type</h3>
        <p className="text-slate-400 text-[11px] mb-4">Total Net Profit (₹) generated by Market vs Limit vs Stop Loss orders.</p>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={orderTypeData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.4} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} />
              <Tooltip content={<BarTooltip />} />
              <Bar dataKey="Pnl" radius={[4, 4, 0, 0]}>
                {orderTypeData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.Pnl >= 0 ? '#10b981' : '#f43f5e'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live vs Demo Performance Compare */}
      <div className="md:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div>
          <h3 className="font-display text-sm font-bold text-white mb-1.5">Live vs Demo Balance</h3>
          <p className="text-slate-400 text-[11px] mb-4">Compare net returns accumulated in active live versus demo trading.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 my-2">
          {tradeTypeData.map((item) => {
            const isPositive = item.Pnl >= 0;
            const count = trades.filter(t => t.tradeType === (item.name === 'Live' ? 'LIVE' : 'DEMO')).length;
            const winCount = trades.filter(t => t.tradeType === (item.name === 'Live' ? 'LIVE' : 'DEMO') && t.status === 'WIN').length;
            const rate = count > 0 ? Math.round((winCount / count) * 100) : 0;
            
            return (
              <div key={item.name} className="p-4 rounded-xl bg-slate-950/50 border border-slate-850/80">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{item.name} Trading</span>
                <div className={`text-xl font-extrabold mt-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isPositive ? '+' : ''}₹{item.Pnl.toLocaleString('en-IN')}
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-3 border-t border-slate-900 pt-2">
                  <span>{count} Trades</span>
                  <span>{rate}% WR</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-500 text-center leading-relaxed">
          Demo trades represent a sandbox space for psychological testing, while Live trades reflect real capital risk.
        </p>
      </div>

    </div>
  );
}

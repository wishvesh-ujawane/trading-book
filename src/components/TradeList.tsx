import React, { useState, useMemo } from 'react';
import {
  Trade,
  BrokerConfig,
  Strategy,
  MISTAKE_TAG_LABELS,
} from '../types';
import { dbService } from '../lib/dbService';
import { summarizeTrade } from '../lib/aiCoach';
import { AiCoachPanel } from './AiCoachPanel';
import { Button, EmptyState } from './ui';
import { computeLedger } from '../lib/pnl';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  Eye,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldAlert,
  BookOpen,
  Scale,
  Sparkles,
  Image as ImageIcon,
  Plus,
  Layers,
  Target,
  Clock,
  History,
} from 'lucide-react';

interface TradeListProps {
  userId: string | null;
  trades: Trade[];
  brokers: BrokerConfig[];
  strategies?: Strategy[];
  onEditTrade: (trade: Trade) => void;
  onDeleteSuccess?: () => void;
  onOpenSettings: () => void;
  onNewTrade: () => void;
}

function formatDT(ms?: number): { d: string; t: string } {
  if (!ms || isNaN(ms)) return { d: '—', t: '' };
  const dt = new Date(ms);
  const d = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const t = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  return { d, t };
}

function entryExitMs(t: Trade): { entryAt: number; exitAt: number } {
  const entryAt = t.entryAt ?? t.timestamp ?? new Date(t.date + 'T' + (t.time ?? '00:00')).getTime();
  const exitAt = t.exitAt ?? entryAt;
  return { entryAt, exitAt };
}

export default function TradeList({
  userId, trades, brokers, strategies = [],
  onEditTrade, onDeleteSuccess, onOpenSettings, onNewTrade,
}: TradeListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'LIVE' | 'DEMO'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WIN' | 'LOSS' | 'BREAK_EVEN'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'PNL_DESC' | 'PNL_ASC'>('DATE_DESC');
  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null);

  const brokerMap = useMemo(() => {
    const m: Record<string, BrokerConfig> = {};
    brokers.forEach((b) => { m[b.id] = b; });
    return m;
  }, [brokers]);

  const strategyMap = useMemo(() => {
    const m: Record<string, Strategy> = {};
    strategies.forEach((s) => { m[s.id] = s; });
    return m;
  }, [strategies]);

  const getBrokerName = (brokerId: string) => brokerMap[brokerId]?.name ?? 'Unknown Broker';

  // Enriched trades — recompute fees/pnl via ledger so broker-fee edits flow in.
  const enrichedTrades = useMemo(() => trades.map((t) => {
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
  }), [trades, brokerMap]);

  const toggleExpand = (tradeId: string) => setExpandedId(expandedId === tradeId ? null : tradeId);

  const handleDeleteTrade = (trade: Trade, e: React.MouseEvent) => {
    e.stopPropagation();
    setTradeToDelete(trade);
  };
  const confirmDeleteTrade = async () => {
    if (!tradeToDelete) return;
    try {
      await dbService.deleteTrade(tradeToDelete.id, userId);
      setTradeToDelete(null);
      onDeleteSuccess?.();
    } catch (err) {
      console.error('Error deleting trade:', err);
    }
  };

  const filteredAndSortedTrades = useMemo(() => {
    let result = [...enrichedTrades];

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter((t) => t.symbol.toLowerCase().includes(term)
        || (t.instrument?.underlying ?? '').toLowerCase().includes(term));
    }
    if (typeFilter !== 'ALL') result = result.filter((t) => t.tradeType === typeFilter);
    if (statusFilter !== 'ALL') result = result.filter((t) => t.status === statusFilter);

    result.sort((a, b) => {
      const at = a.entryAt ?? a.timestamp;
      const bt = b.entryAt ?? b.timestamp;
      if (sortBy === 'DATE_DESC') return bt - at;
      if (sortBy === 'DATE_ASC') return at - bt;
      if (sortBy === 'PNL_DESC') return b.pnlNet - a.pnlNet;
      if (sortBy === 'PNL_ASC') return a.pnlNet - b.pnlNet;
      return 0;
    });

    return result;
  }, [enrichedTrades, searchTerm, typeFilter, statusFilter, sortBy]);

  const anyTradeHasR = useMemo(() => filteredAndSortedTrades.some((t) => t.rMultiple !== undefined),
    [filteredAndSortedTrades]);

  return (
    <div className="space-y-4">

      {/* Filters bar */}
      <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl backdrop-blur-md shadow-lg grid sm:grid-cols-12 gap-3 items-center">
        <div className="sm:col-span-4 relative">
          <label htmlFor="trade-search" className="sr-only">Search trades by symbol</label>
          <Search aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="trade-search"
            type="search"
            placeholder="Search symbol (e.g., RELIANCE or NIFTY)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
        </div>

        <div className="sm:col-span-8 flex flex-wrap gap-2.5 sm:justify-end">
          <div className="flex bg-slate-950/80 border border-slate-800 rounded-xl p-1 text-xs">
            {(['ALL', 'LIVE', 'DEMO'] as const).map((type) => (
              <button key={type} onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 font-semibold rounded-lg transition-all cursor-pointer ${
                  typeFilter === type ? 'bg-indigo-600 text-white shadow shadow-indigo-950' : 'text-slate-400 hover:text-white'
                }`}>
                {type === 'ALL' ? 'All Types' : type === 'LIVE' ? 'Live' : 'Demo'}
              </button>
            ))}
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer">
            <option value="ALL">All Outcomes</option>
            <option value="WIN">Wins Only</option>
            <option value="LOSS">Losses Only</option>
            <option value="BREAK_EVEN">Break Evens</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer">
            <option value="DATE_DESC">Date (Newest)</option>
            <option value="DATE_ASC">Date (Oldest)</option>
            <option value="PNL_DESC">P&L (Highest)</option>
            <option value="PNL_ASC">P&L (Lowest)</option>
          </select>
        </div>
      </div>

      <div className="flex justify-between items-center px-1">
        <span aria-live="polite" className="text-xs text-slate-400 font-mono">
          Showing <strong className="text-white">{filteredAndSortedTrades.length}</strong> of <strong className="text-white">{trades.length}</strong> total trade logs
        </span>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {filteredAndSortedTrades.length === 0 ? (
          trades.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-6 h-6" />}
              title="Your ledger is empty"
              description="Log your first trade to start tracking P&L, fees, and psychology. It takes about a minute."
              action={<Button onClick={onNewTrade} leadingIcon={<Plus className="w-4 h-4" />}>Log your first trade</Button>}
            />
          ) : (
            <EmptyState tone="slate" icon={<Search className="w-6 h-6" />}
              title="No trades match your filters"
              description="Try widening your search, timeframe, or Win/Loss filter." />
          )
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table View */}
            <table className="w-full text-left border-collapse hidden md:table">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Entry / Exit</th>
                  <th className="py-3 px-4">Asset</th>
                  <th className="py-3 px-4">Tags</th>
                  <th className="py-3 px-4">Direction</th>
                  <th className="py-3 px-4">Prices</th>
                  <th className="py-3 px-4 text-right">Net P&L</th>
                  {anyTradeHasR && <th className="py-3 px-4 text-right">R</th>}
                  <th className="py-3 px-4 text-center">Outcome</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAndSortedTrades.map((trade) => {
                  const isWin = trade.status === 'WIN';
                  const isLoss = trade.status === 'LOSS';
                  const isExpanded = expandedId === trade.id;
                  const strat = trade.strategyId ? strategyMap[trade.strategyId] : undefined;
                  const inst = trade.instrument;
                  const { entryAt, exitAt } = entryExitMs(trade);
                  const eDT = formatDT(entryAt);
                  const xDT = formatDT(exitAt);
                  const colSpan = anyTradeHasR ? 9 : 8;

                  return (
                    <React.Fragment key={trade.id}>
                      <tr onClick={() => toggleExpand(trade.id)}
                        className={`hover:bg-slate-950/30 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-950/40' : ''}`}>

                        {/* Entry / Exit stacked */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-0.5 text-[10px] font-mono">
                            <div className="flex items-center gap-1 text-slate-300">
                              <Calendar className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="font-semibold">{eDT.d}</span>
                              <span className="text-slate-500">{eDT.t}</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-400">
                              <Clock className="w-3 h-3 text-rose-400 shrink-0" />
                              <span>{xDT.d}</span>
                              <span className="text-slate-600">{xDT.t}</span>
                            </div>
                          </div>
                        </td>

                        {/* Asset */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-display font-bold text-sm text-white">{trade.symbol}</span>
                            {trade.screenshotUrl && (
                              <ImageIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-label="Screenshot attached">
                                <title>Screenshot attached</title>
                              </ImageIcon>
                            )}
                          </div>
                          {inst && inst.kind !== 'CASH' && (
                            <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                              {inst.kind === 'OPTIONS'
                                ? `${inst.strike ?? '?'} ${inst.optionType ?? ''} · lot ${inst.lotSize}`
                                : `FUT · lot ${inst.lotSize}`}
                            </div>
                          )}
                          <div className="text-[9px] text-slate-600 font-mono">qty {trade.quantity}</div>
                        </td>

                        {/* Tags */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {strat && <Badge color={strat.color}>{strat.name}</Badge>}
                            {trade.chartTimeframe && <Badge tone="indigo">TF {trade.chartTimeframe}</Badge>}
                            {trade.holdingStyle && <Badge tone="emerald">{trade.holdingStyle}</Badge>}
                            {inst && <Badge tone="slate">{inst.market}</Badge>}
                            {trade.tradeType === 'DEMO' && <Badge tone="amber">DEMO</Badge>}
                          </div>
                        </td>

                        {/* Direction */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            {trade.direction === 'LONG'
                              ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                              : <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400 stroke-[2.5]" />}
                            <span className={`text-xs font-semibold ${trade.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {trade.direction}
                            </span>
                          </div>
                        </td>

                        {/* Prices */}
                        <td className="py-3.5 px-4 text-xs text-slate-300 font-mono">
                          <div><span className="text-slate-500 text-[10px]">In</span> ₹{trade.entryPrice.toLocaleString('en-IN')}</div>
                          <div><span className="text-slate-500 text-[10px]">Out</span> ₹{trade.exitPrice.toLocaleString('en-IN')}</div>
                        </td>

                        {/* Net P&L */}
                        <td className="py-3.5 px-4 text-right font-bold font-mono">
                          <span className={trade.pnlNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {trade.pnlNet >= 0 ? '+' : ''}₹{trade.pnlNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="block text-[9px] text-slate-500 font-medium">
                            Gross: ₹{trade.pnlGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* R multiple */}
                        {anyTradeHasR && (
                          <td className="py-3.5 px-4 text-right font-mono text-xs">
                            {trade.rMultiple !== undefined ? (
                              <span className={trade.rMultiple >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                                {trade.rMultiple > 0 ? '+' : ''}{trade.rMultiple}R
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        )}

                        {/* Outcome */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full font-mono ${
                            isWin ? 'bg-emerald-500/10 text-emerald-400' :
                            isLoss ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
                          }`}>{trade.status}</span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => onEditTrade(trade)}
                              aria-label={`Edit trade ${trade.symbol} on ${trade.date}`}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                              title="Edit Trade Logs">
                              <Edit aria-hidden="true" className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={(e) => handleDeleteTrade(trade, e)}
                              aria-label={`Delete trade ${trade.symbol} on ${trade.date}`}
                              className="p-1.5 hover:bg-slate-800/80 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                              title="Delete Trade">
                              <Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => toggleExpand(trade.id)}
                              aria-label={isExpanded ? 'Collapse trade details' : 'Expand trade details'}
                              aria-expanded={isExpanded}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                              {isExpanded ? <ChevronUp aria-hidden="true" className="w-3.5 h-3.5" /> : <ChevronDown aria-hidden="true" className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded View */}
                      <AnimatePresence>
                        {isExpanded && (
                          <tr key={`expanded-${trade.id}`} className="bg-slate-950/25">
                            <td colSpan={colSpan} className="p-4 sm:p-5 border-b border-slate-800/60">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="grid md:grid-cols-12 gap-5"
                              >
                                {/* Ledger + Plan */}
                                <div className="md:col-span-4 space-y-3 bg-slate-950/50 border border-slate-800 p-4 rounded-xl">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-900 pb-1">Detailed Ledger</span>
                                  <div className="space-y-1.5 text-xs">
                                    <Row label="Order Type" value={<span className="font-mono">{trade.orderType}</span>} />
                                    <Row label="Broker" value={<span>{getBrokerName(trade.brokerId)}</span>} />
                                    <Row label="Gross" value={
                                      <span className={`font-semibold font-mono ${trade.pnlGross >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {trade.pnlGross >= 0 ? '+' : ''}₹{trade.pnlGross.toFixed(2)}
                                      </span>} />
                                    <Row label="Brokerage" value={<span className="font-mono">₹{trade.brokerageFee.toFixed(2)}</span>} />
                                    <Row label="Slippage" value={<span className="font-mono">₹{trade.slippageFee.toFixed(2)}</span>} />
                                    {trade.taxFee > 0 && <Row label="Taxes" value={<span className="font-mono">₹{trade.taxFee.toFixed(2)}</span>} />}
                                    <div className="flex justify-between border-t border-slate-900 pt-2 text-sm font-bold mt-1">
                                      <span className="text-white">Net</span>
                                      <span className={`font-mono ${trade.pnlNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {trade.pnlNet >= 0 ? '+' : ''}₹{trade.pnlNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                    {trade.rMultiple !== undefined && (
                                      <div className="flex justify-between text-xs pt-1">
                                        <span className="text-slate-500">Realised R</span>
                                        <span className={`font-mono font-bold ${trade.rMultiple >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                          {trade.rMultiple > 0 ? '+' : ''}{trade.rMultiple}R
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {trade.plan && (
                                    <div className="pt-2">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-900 pb-1 mb-1.5 flex items-center gap-1">
                                        <Target className="w-3 h-3" /> Plan vs Actual
                                      </span>
                                      <div className="space-y-1 text-[11px] font-mono">
                                        {trade.plan.entry !== undefined && <Row label="Plan Entry" value={<span>₹{trade.plan.entry.toLocaleString('en-IN')} vs ₹{trade.entryPrice.toLocaleString('en-IN')}</span>} />}
                                        {trade.plan.stopLoss !== undefined && <Row label="Plan SL" value={<span>₹{trade.plan.stopLoss.toLocaleString('en-IN')}</span>} />}
                                        {trade.plan.target !== undefined && <Row label="Plan Target" value={<span>₹{trade.plan.target.toLocaleString('en-IN')} vs ₹{trade.exitPrice.toLocaleString('en-IN')}</span>} />}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Center: Fills + SL History + Psychology */}
                                <div className="md:col-span-4 space-y-3">
                                  {(trade.entries && trade.entries.length > 0) || (trade.exits && trade.exits.length > 0) ? (
                                    <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-900 pb-1 mb-1.5 flex items-center gap-1">
                                        <Layers className="w-3 h-3" /> Partial fills
                                      </span>
                                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                                        <FillList title="Entries" fills={trade.entries ?? []} tone="emerald" />
                                        <FillList title="Exits" fills={trade.exits ?? []} tone="rose" />
                                      </div>
                                    </div>
                                  ) : null}

                                  {trade.stopLossHistory && trade.stopLossHistory.length > 0 && (
                                    <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-900 pb-1 mb-1.5 flex items-center gap-1">
                                        <History className="w-3 h-3" /> Trailing SL history
                                      </span>
                                      <ul className="space-y-1 text-[11px] font-mono">
                                        {trade.stopLossHistory.map((h, i) => (
                                          <li key={i} className="flex items-baseline gap-2">
                                            <span className="text-slate-500 shrink-0">{new Date(h.at).toLocaleString('en-IN', { hour12: false })}</span>
                                            <span className="text-rose-300">₹{h.from}</span>
                                            <span className="text-slate-600">→</span>
                                            <span className="text-emerald-300">₹{h.to}</span>
                                            {h.reason && <span className="text-slate-500 truncate">({h.reason})</span>}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {trade.mistakes && trade.mistakes.length > 0 && (
                                    <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-900 pb-1 mb-1.5">Mistakes tagged</span>
                                      <div className="flex flex-wrap gap-1">
                                        {trade.mistakes.map((m) => (
                                          <Badge key={m} tone="rose">{MISTAKE_TAG_LABELS[m]}</Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-900 pb-1 mb-1.5">Psychological review</span>
                                    <PsychBlock label="What went well" icon={<Sparkles className="w-3 h-3" />} tone="emerald" text={trade.findings.whatWentWell} />
                                    <PsychBlock label="What went wrong" icon={<Scale className="w-3 h-3" />} tone="rose" text={trade.findings.whatWentWrong} />
                                    <PsychBlock label="Could be improved" icon={<BookOpen className="w-3 h-3" />} tone="teal" text={trade.findings.whatCouldBeImproved} />
                                  </div>
                                </div>

                                {/* Right: Screenshot */}
                                <div className="md:col-span-4 bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-900 pb-1 mb-2">Trade capture chart</span>
                                  {trade.screenshotUrl ? (
                                    <div className="border border-slate-800 bg-slate-950 rounded-lg overflow-hidden h-[150px] relative group cursor-zoom-in">
                                      <img referrerPolicy="no-referrer" src={trade.screenshotUrl} alt="Chart Screenshot"
                                        className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105" />
                                      <a href={trade.screenshotUrl} target="_blank" rel="noopener noreferrer"
                                        className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-xs font-semibold text-white transition-opacity">
                                        <Eye className="w-4 h-4" />Open full size
                                      </a>
                                    </div>
                                  ) : (
                                    <div className="border border-dashed border-slate-800 rounded-lg h-[150px] flex flex-col items-center justify-center text-slate-600 gap-1.5">
                                      <ImageIcon className="w-6 h-6 stroke-[1.5]" />
                                      <span className="text-[10px] uppercase font-bold tracking-widest">No screenshot</span>
                                    </div>
                                  )}
                                </div>

                                {/* AI Coach */}
                                <div className="md:col-span-12">
                                  <AiCoachPanel
                                    savedText={trade.aiSummary?.text}
                                    onOpenSettings={onOpenSettings}
                                    onGenerate={() => summarizeTrade(trade)}
                                    onSave={async (text) => {
                                      await dbService.saveTrade({
                                        ...trade,
                                        aiSummary: { text, generatedAt: Date.now(), model: 'gemini-2.5-flash' },
                                      }, userId);
                                    }}
                                    onClear={trade.aiSummary ? async () => {
                                      const { aiSummary: _drop, ...rest } = trade;
                                      void _drop;
                                      await dbService.saveTrade(rest as Trade, userId);
                                    } : undefined}
                                    description="Gemini reviews this trade using your entry, exit, fees, and self-reflection."
                                  />
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile View Card List */}
            <div className="md:hidden divide-y divide-slate-800">
              {filteredAndSortedTrades.map((trade) => {
                const isExpanded = expandedId === trade.id;
                const isWin = trade.status === 'WIN';
                const isLoss = trade.status === 'LOSS';
                const strat = trade.strategyId ? strategyMap[trade.strategyId] : undefined;
                const inst = trade.instrument;
                const { entryAt, exitAt } = entryExitMs(trade);
                const eDT = formatDT(entryAt);
                const xDT = formatDT(exitAt);

                return (
                  <div key={trade.id} onClick={() => toggleExpand(trade.id)}
                    className="p-4 space-y-3 hover:bg-slate-950/20 active:bg-slate-950/40 cursor-pointer">

                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-display font-bold text-sm text-white">{trade.symbol}</span>
                          <span className={`text-[9px] font-bold px-1.5 rounded uppercase ${
                            trade.tradeType === 'LIVE' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>{trade.tradeType}</span>
                          {inst && inst.kind === 'OPTIONS' && (
                            <span className="text-[9px] font-mono text-slate-400">{inst.strike ?? '?'} {inst.optionType}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 flex flex-col mt-1 font-mono">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-emerald-400" />{eDT.d} {eDT.t}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-rose-400" />{xDT.d} {xDT.t}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`font-bold font-mono ${trade.pnlNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {trade.pnlNet >= 0 ? '+' : ''}₹{trade.pnlNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="mt-1 flex items-center gap-1 justify-end">
                          {trade.rMultiple !== undefined && (
                            <span className={`text-[9px] font-mono font-bold ${trade.rMultiple >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {trade.rMultiple > 0 ? '+' : ''}{trade.rMultiple}R
                            </span>
                          )}
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full font-mono ${
                            isWin ? 'bg-emerald-500/10 text-emerald-400' :
                            isLoss ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
                          }`}>{trade.status}</span>
                        </div>
                      </div>
                    </div>

                    {/* Tag row */}
                    {(strat || trade.chartTimeframe || trade.holdingStyle || inst) && (
                      <div className="flex flex-wrap gap-1">
                        {strat && <Badge color={strat.color}>{strat.name}</Badge>}
                        {trade.chartTimeframe && <Badge tone="indigo">TF {trade.chartTimeframe}</Badge>}
                        {trade.holdingStyle && <Badge tone="emerald">{trade.holdingStyle}</Badge>}
                        {inst && <Badge tone="slate">{inst.market}</Badge>}
                      </div>
                    )}

                    <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-800/60 pt-2.5">
                      <div className="flex items-center gap-1">
                        {trade.direction === 'LONG'
                          ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                          : <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />}
                        <span className={trade.direction === 'LONG' ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                          {trade.direction}
                        </span>
                        <span className="text-slate-600">|</span>
                        <span>₹{trade.entryPrice.toLocaleString('en-IN')} → ₹{trade.exitPrice.toLocaleString('en-IN')}</span>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => onEditTrade(trade)}
                          aria-label={`Edit trade ${trade.symbol} on ${trade.date}`}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                          <Edit aria-hidden="true" className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={(e) => handleDeleteTrade(trade, e)}
                          aria-label={`Delete trade ${trade.symbol} on ${trade.date}`}
                          className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                          <Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-4 text-xs mt-3 select-text">
                        <div>
                          <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 block border-b border-slate-900 pb-1 mb-2">Ledger</span>
                          <div className="space-y-1">
                            <Row label="Broker / Order" value={<span className="font-mono">{getBrokerName(trade.brokerId)} ({trade.orderType})</span>} />
                            <Row label="Fees" value={<span className="font-mono">₹{(trade.brokerageFee + trade.slippageFee + trade.taxFee).toFixed(2)}</span>} />
                            {trade.rMultiple !== undefined && (
                              <Row label="Realised R" value={
                                <span className={`font-mono font-bold ${trade.rMultiple >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {trade.rMultiple > 0 ? '+' : ''}{trade.rMultiple}R
                                </span>} />
                            )}
                          </div>
                        </div>

                        {trade.entries && trade.entries.length > 0 && (
                          <div>
                            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 block border-b border-slate-900 pb-1 mb-2 flex items-center gap-1">
                              <Layers className="w-3 h-3" /> Partial fills
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              <FillList title="Entries" fills={trade.entries ?? []} tone="emerald" />
                              <FillList title="Exits" fills={trade.exits ?? []} tone="rose" />
                            </div>
                          </div>
                        )}

                        {trade.stopLossHistory && trade.stopLossHistory.length > 0 && (
                          <div>
                            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 block border-b border-slate-900 pb-1 mb-2">SL history</span>
                            <ul className="space-y-1 text-[10px] font-mono">
                              {trade.stopLossHistory.map((h, i) => (
                                <li key={i} className="flex items-baseline gap-2">
                                  <span className="text-slate-500 shrink-0">{new Date(h.at).toLocaleString('en-IN', { hour12: false })}</span>
                                  <span className="text-rose-300">₹{h.from}</span>
                                  <span className="text-slate-600">→</span>
                                  <span className="text-emerald-300">₹{h.to}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {trade.mistakes && trade.mistakes.length > 0 && (
                          <div>
                            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 block border-b border-slate-900 pb-1 mb-2">Mistakes tagged</span>
                            <div className="flex flex-wrap gap-1">
                              {trade.mistakes.map((m) => (
                                <Badge key={m} tone="rose">{MISTAKE_TAG_LABELS[m]}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 block border-b border-slate-900 pb-1 mb-2">Psychology</span>
                          <div className="space-y-2">
                            <div>
                              <span className="text-emerald-400 font-bold block text-[10px] mb-0.5">What went well:</span>
                              <p className="text-slate-300 bg-slate-950 p-2 rounded border border-slate-900">{trade.findings.whatWentWell || 'None'}</p>
                            </div>
                            <div>
                              <span className="text-rose-400 font-bold block text-[10px] mb-0.5">What went wrong:</span>
                              <p className="text-slate-300 bg-slate-950 p-2 rounded border border-slate-900">{trade.findings.whatWentWrong || 'None'}</p>
                            </div>
                          </div>
                        </div>

                        {trade.screenshotUrl && (
                          <div>
                            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 block border-b border-slate-900 pb-1 mb-2">Screenshot</span>
                            <div className="border border-slate-800 rounded-lg overflow-hidden h-[140px] relative">
                              <img referrerPolicy="no-referrer" src={trade.screenshotUrl} alt="Chart Capture" className="object-cover w-full h-full" />
                            </div>
                          </div>
                        )}

                        <div onClick={(e) => e.stopPropagation()}>
                          <AiCoachPanel
                            compact
                            savedText={trade.aiSummary?.text}
                            onOpenSettings={onOpenSettings}
                            onGenerate={() => summarizeTrade(trade)}
                            onSave={async (text) => {
                              await dbService.saveTrade({
                                ...trade,
                                aiSummary: { text, generatedAt: Date.now(), model: 'gemini-2.5-flash' },
                              }, userId);
                            }}
                            onClear={trade.aiSummary ? async () => {
                              const { aiSummary: _drop, ...rest } = trade;
                              void _drop;
                              await dbService.saveTrade(rest as Trade, userId);
                            } : undefined}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {tradeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3.5 text-rose-400 mb-4">
                <div className="bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/25">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white font-display">Delete Trade Log?</h3>
              </div>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Are you sure you want to delete your logged <strong className="text-slate-200">{tradeToDelete.symbol}</strong> trade? This action is permanent and cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setTradeToDelete(null)}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold py-2 px-5 rounded-xl text-xs transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="button" onClick={confirmDeleteTrade}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors cursor-pointer shadow-lg shadow-rose-950/50">
                  Delete Log
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small render helpers
// ---------------------------------------------------------------------------

type BadgeTone = 'slate' | 'indigo' | 'emerald' | 'rose' | 'amber' | 'blue';

function Badge({
  children,
  tone,
  color,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  /** Custom hex/CSS color (used for strategy chips). */
  color?: string;
}) {
  if (color) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border"
        style={{
          background: `${color}20`,
          borderColor: `${color}60`,
          color,
        }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        {children}
      </span>
    );
  }
  const t = tone ?? 'slate';
  const tones: Record<BadgeTone, string> = {
    slate: 'bg-slate-800/50 border-slate-700 text-slate-300',
    indigo: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    rose: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${tones[t]}`}>
      {children}
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}:</span>
      <span className="text-slate-300 font-semibold">{value}</span>
    </div>
  );
}

function FillList({
  title,
  fills,
  tone,
}: {
  title: string;
  fills: { price: number; qty: number; at: number }[];
  tone: 'emerald' | 'rose';
}) {
  return (
    <div>
      <div className={`text-[9px] uppercase tracking-wider font-bold mb-1 ${tone === 'emerald' ? 'text-emerald-400' : 'text-rose-400'}`}>
        {title}
      </div>
      {fills.length === 0 ? (
        <div className="text-[10px] text-slate-600">No fills</div>
      ) : (
        <ul className="space-y-0.5">
          {fills.map((f, i) => (
            <li key={i} className="flex items-baseline gap-1.5 text-[10px] font-mono text-slate-300">
              <span className="text-slate-500 w-8 text-right">{f.qty}</span>
              <span className="text-slate-600">@</span>
              <span>₹{f.price.toLocaleString('en-IN')}</span>
              {f.at ? <span className="text-slate-600 truncate">{new Date(f.at).toLocaleString('en-IN', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PsychBlock({
  label,
  icon,
  tone,
  text,
}: {
  label: string;
  icon: React.ReactNode;
  tone: 'emerald' | 'rose' | 'teal';
  text?: string;
}) {
  const toneCls =
    tone === 'emerald' ? 'text-emerald-400'
      : tone === 'rose' ? 'text-rose-400'
      : 'text-teal-400';
  return (
    <div className="mb-2">
      <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide mb-1 ${toneCls}`}>
        {icon}{label}
      </div>
      <p className="text-slate-300 bg-slate-950 p-2 rounded-lg border border-slate-900 leading-relaxed font-sans text-xs">
        {text?.trim() || 'No comments written.'}
      </p>
    </div>
  );
}

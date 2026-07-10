import React, { useState, useMemo } from 'react';
import { Trade, BrokerConfig } from '../types';
import { dbService } from '../lib/dbService';
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
  DollarSign,
  Tag
} from 'lucide-react';

interface TradeListProps {
  userId: string | null;
  trades: Trade[];
  brokers: BrokerConfig[];
  onEditTrade: (trade: Trade) => void;
  onDeleteSuccess?: () => void;
}

export default function TradeList({ userId, trades, brokers, onEditTrade, onDeleteSuccess }: TradeListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'LIVE' | 'DEMO'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WIN' | 'LOSS' | 'BREAK_EVEN'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sorting
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'PNL_DESC' | 'PNL_ASC'>('DATE_DESC');

  // Deletion confirmation state
  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null);

  // Find broker name helper
  const getBrokerName = (brokerId: string) => {
    const broker = brokers.find(b => b.id === brokerId);
    return broker ? broker.name : 'Unknown Broker';
  };

  // Toggle expanded view
  const toggleExpand = (tradeId: string) => {
    setExpandedId(expandedId === tradeId ? null : tradeId);
  };

  // Delete trade
  const handleDeleteTrade = (trade: Trade, e: React.MouseEvent) => {
    e.stopPropagation();
    setTradeToDelete(trade);
  };

  const confirmDeleteTrade = async () => {
    if (!tradeToDelete) return;
    try {
      await dbService.deleteTrade(tradeToDelete.id, userId);
      setTradeToDelete(null);
      if (onDeleteSuccess) onDeleteSuccess();
    } catch (err) {
      console.error("Error deleting trade:", err);
    }
  };

  // Filter & Sort trades
  const filteredAndSortedTrades = useMemo(() => {
    let result = [...trades];

    // Search filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(t => t.symbol.toLowerCase().includes(term));
    }

    // Type filter
    if (typeFilter !== 'ALL') {
      result = result.filter(t => t.tradeType === typeFilter);
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter(t => t.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'DATE_DESC') return b.timestamp - a.timestamp;
      if (sortBy === 'DATE_ASC') return a.timestamp - b.timestamp;
      if (sortBy === 'PNL_DESC') return b.pnlNet - a.pnlNet;
      if (sortBy === 'PNL_ASC') return a.pnlNet - b.pnlNet;
      return 0;
    });

    return result;
  }, [trades, searchTerm, typeFilter, statusFilter, sortBy]);

  return (
    <div className="space-y-4">
      
      {/* Filters bar Styled as Bento Box */}
      <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl backdrop-blur-md shadow-lg grid sm:grid-cols-12 gap-3 items-center">
        {/* Search */}
        <div className="sm:col-span-4 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search symbol (e.g., RELIANCE or NIFTY)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="sm:col-span-8 flex flex-wrap gap-2.5 sm:justify-end">
          {/* Live vs Demo filter */}
          <div className="flex bg-slate-950/80 border border-slate-800 rounded-xl p-1 text-xs">
            {(['ALL', 'LIVE', 'DEMO'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 font-semibold rounded-lg transition-all cursor-pointer ${
                  typeFilter === type 
                    ? 'bg-indigo-600 text-white shadow shadow-indigo-950' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {type === 'ALL' ? 'All Types' : type === 'LIVE' ? 'Live' : 'Demo'}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Outcomes</option>
            <option value="WIN">Wins Only</option>
            <option value="LOSS">Losses Only</option>
            <option value="BREAK_EVEN">Break Evens</option>
          </select>

          {/* Sort selection */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="DATE_DESC">Date (Newest)</option>
            <option value="DATE_ASC">Date (Oldest)</option>
            <option value="PNL_DESC">P&L (Highest)</option>
            <option value="PNL_ASC">P&L (Lowest)</option>
          </select>
        </div>
      </div>

      {/* Trades Counter */}
      <div className="flex justify-between items-center px-1">
        <span className="text-xs text-slate-400 font-mono">
          Showing <strong className="text-white">{filteredAndSortedTrades.length}</strong> of <strong className="text-white">{trades.length}</strong> total trade logs
        </span>
      </div>

      {/* Mobile grid & Desktop table container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {filteredAndSortedTrades.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            No matching trade logs found. Create an entry to populate.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table View */}
            <table className="w-full text-left border-collapse hidden md:table">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-4">Asset</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Direction</th>
                  <th className="py-3 px-4">Execution Prices</th>
                  <th className="py-3 px-4 text-right">Net P&L</th>
                  <th className="py-3 px-4 text-center">Outcome</th>
                  <th className="py-3 px-4 text-center">Review</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAndSortedTrades.map((trade) => {
                  const isWin = trade.status === 'WIN';
                  const isLoss = trade.status === 'LOSS';
                  const isExpanded = expandedId === trade.id;
                  
                  return (
                    <React.Fragment key={trade.id}>
                      {/* Main Row */}
                      <tr 
                        onClick={() => toggleExpand(trade.id)}
                        className={`hover:bg-slate-950/30 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-slate-950/40' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <div>
                              <span className="block text-xs font-semibold text-white">{trade.date}</span>
                              {trade.time && <span className="text-[10px] text-slate-500 font-mono">{trade.time}</span>}
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-3.5 px-4 font-display font-bold text-sm text-white">
                          <div className="flex items-center gap-1.5">
                            {trade.symbol}
                            {trade.screenshotUrl && (
                              <ImageIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" title="Screenshot attached" />
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            trade.tradeType === 'LIVE' 
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {trade.tradeType}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            {trade.direction === 'LONG' ? (
                              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                            ) : (
                              <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400 stroke-[2.5]" />
                            )}
                            <span className={`text-xs font-semibold ${trade.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {trade.direction === 'LONG' ? 'LONG' : 'SHORT'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-300 font-mono">
                          <div>
                            <span className="text-slate-400 text-[10px]">In:</span> ₹{trade.entryPrice.toLocaleString('en-IN')}
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Out:</span> ₹{trade.exitPrice.toLocaleString('en-IN')}
                            <span className="text-slate-500 ml-1.5">({trade.quantity} qty)</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold font-mono">
                          <span className={trade.pnlNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {trade.pnlNet >= 0 ? '+' : ''}₹{trade.pnlNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="block text-[9px] text-slate-500 font-medium">
                            Gross: ₹{trade.pnlGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full font-mono ${
                            isWin ? 'bg-emerald-500/10 text-emerald-400' :
                            isLoss ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {trade.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center justify-center p-1 rounded-lg ${
                            trade.findings.whatWentWell || trade.findings.whatWentWrong || trade.findings.whatCouldBeImproved
                              ? 'bg-emerald-500/10 text-emerald-400' 
                              : 'bg-slate-800 text-slate-500'
                          }`} title="Structured psychology findings written">
                            <BookOpen className="w-3.5 h-3.5" />
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => onEditTrade(trade)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="Edit Trade Logs"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteTrade(trade, e)}
                              className="p-1.5 hover:bg-slate-800/80 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                              title="Delete Trade"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleExpand(trade.id)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded View */}
                      <AnimatePresence>
                        {isExpanded && (
                          <tr key={`expanded-${trade.id}`} className="bg-slate-950/25">
                            <td colSpan={9} className="p-4 sm:p-5 border-b border-slate-800/60">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="grid md:grid-cols-12 gap-5"
                              >
                                {/* Left side: Stats & Fees */}
                                <div className="md:col-span-4 space-y-3 bg-slate-950/50 border border-slate-850 p-4 rounded-xl">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-900 pb-1">Detailed Ledger</span>
                                  
                                  <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Order Type:</span>
                                      <span className="text-white font-semibold font-mono">{trade.orderType}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Execution Broker:</span>
                                      <span className="text-slate-300 font-semibold">{getBrokerName(trade.brokerId)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Gross Trade Return:</span>
                                      <span className={`font-semibold font-mono ${trade.pnlGross >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {trade.pnlGross >= 0 ? '+' : ''}₹{trade.pnlGross.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Brokerage Fees (Turn):</span>
                                      <span className="text-slate-300 font-mono">₹{trade.brokerageFee.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Estimated Slippage:</span>
                                      <span className="text-slate-300 font-mono">₹{trade.slippageFee.toFixed(2)}</span>
                                    </div>
                                    {trade.taxFee > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">Other Taxes:</span>
                                        <span className="text-slate-300 font-mono">₹{trade.taxFee.toFixed(2)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between border-t border-slate-900 pt-2 text-sm font-bold mt-1">
                                      <span className="text-white">Net Trade Profit:</span>
                                      <span className={trade.pnlNet >= 0 ? 'text-emerald-400 font-mono' : 'text-rose-400 font-mono'}>
                                        {trade.pnlNet >= 0 ? '+' : ''}₹{trade.pnlNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Center: Structured psychology findings */}
                                <div className="md:col-span-4 space-y-3.5 bg-slate-950/50 border border-slate-850 p-4 rounded-xl">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-900 pb-1">Psychological growth journaling</span>
                                  
                                  <div className="space-y-3 text-xs">
                                    <div>
                                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wide mb-1">
                                        <Sparkles className="w-3 h-3" />
                                        What went well
                                      </div>
                                      <p className="text-slate-300 bg-slate-950 p-2 rounded-lg border border-slate-900 leading-relaxed font-sans">
                                        {trade.findings.whatWentWell || "No comments written for strategy execution."}
                                      </p>
                                    </div>

                                    <div>
                                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-400 uppercase tracking-wide mb-1">
                                        <Scale className="w-3 h-3" />
                                        What went wrong
                                      </div>
                                      <p className="text-slate-300 bg-slate-950 p-2 rounded-lg border border-slate-900 leading-relaxed font-sans">
                                        {trade.findings.whatWentWrong || "No comments written for mistakes."}
                                      </p>
                                    </div>

                                    <div>
                                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-teal-400 uppercase tracking-wide mb-1">
                                        <BookOpen className="w-3 h-3" />
                                        What could be improved
                                      </div>
                                      <p className="text-slate-300 bg-slate-950 p-2 rounded-lg border border-slate-900 leading-relaxed font-sans">
                                        {trade.findings.whatCouldBeImproved || "No actionable insights configured."}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Right side: Screenshot capture */}
                                <div className="md:col-span-4 bg-slate-950/50 border border-slate-850 p-4 rounded-xl flex flex-col justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-900 pb-1 mb-2">Trade capture chart</span>
                                  
                                  {trade.screenshotUrl ? (
                                    <div className="border border-slate-800 bg-slate-950 rounded-lg overflow-hidden h-[150px] relative group cursor-zoom-in">
                                      <img referrerPolicy="no-referrer" src={trade.screenshotUrl} alt="Chart Screenshot" className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105" />
                                      <a 
                                        href={trade.screenshotUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-xs font-semibold text-white transition-opacity"
                                      >
                                        <Eye className="w-4 h-4" />
                                        Open full size
                                      </a>
                                    </div>
                                  ) : (
                                    <div className="border border-dashed border-slate-800 rounded-lg h-[150px] flex flex-col items-center justify-center text-slate-600 gap-1.5">
                                      <ImageIcon className="w-6 h-6 stroke-[1.5]" />
                                      <span className="text-[10px] uppercase font-bold tracking-widest">No chart screenshot attached</span>
                                    </div>
                                  )}
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
            <div className="md:hidden divide-y divide-slate-850">
              {filteredAndSortedTrades.map((trade) => {
                const isExpanded = expandedId === trade.id;
                const isWin = trade.status === 'WIN';
                const isLoss = trade.status === 'LOSS';

                return (
                  <div 
                    key={trade.id} 
                    onClick={() => toggleExpand(trade.id)}
                    className="p-4 space-y-3 hover:bg-slate-950/20 active:bg-slate-950/40 cursor-pointer"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-display font-bold text-sm text-white">{trade.symbol}</span>
                          <span className={`text-[9px] font-bold px-1.5 rounded uppercase ${
                            trade.tradeType === 'LIVE' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {trade.tradeType}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 font-mono">
                          <Calendar className="w-3 h-3 text-slate-600" />
                          {trade.date} {trade.time && `| ${trade.time}`}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className={`font-bold font-mono ${trade.pnlNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {trade.pnlNet >= 0 ? '+' : ''}₹{trade.pnlNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="mt-1">
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full font-mono ${
                            isWin ? 'bg-emerald-500/10 text-emerald-400' :
                            isLoss ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {trade.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-850/60 pt-2.5">
                      <div className="flex items-center gap-1">
                        {trade.direction === 'LONG' ? (
                          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span className={trade.direction === 'LONG' ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                          {trade.direction}
                        </span>
                        <span className="text-slate-600">|</span>
                        <span>₹{trade.entryPrice.toLocaleString('en-IN')} → ₹{trade.exitPrice.toLocaleString('en-IN')}</span>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onEditTrade(trade)}
                          className="p-1 hover:bg-slate-850 rounded text-slate-400 hover:text-white"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteTrade(trade, e)}
                          className="p-1 hover:bg-slate-850 rounded text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Mobile Panel */}
                    {isExpanded && (
                      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-4 text-xs mt-3 select-text">
                        <div>
                          <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 block border-b border-slate-900 pb-1 mb-2">Ledger Details</span>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Broker / Order:</span>
                              <span className="text-slate-300 font-mono">{getBrokerName(trade.brokerId)} ({trade.orderType})</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Taxes & Fees:</span>
                              <span className="text-slate-300 font-mono">₹{(trade.brokerageFee + trade.slippageFee + trade.taxFee).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 block border-b border-slate-900 pb-1 mb-2">Psychology Logs</span>
                          <div className="space-y-2">
                            <div>
                              <span className="text-emerald-400 font-bold block text-[10px] mb-0.5">What went well:</span>
                              <p className="text-slate-300 bg-slate-950 p-2 rounded border border-slate-900">{trade.findings.whatWentWell || "None"}</p>
                            </div>
                            <div>
                              <span className="text-rose-400 font-bold block text-[10px] mb-0.5">What went wrong:</span>
                              <p className="text-slate-300 bg-slate-950 p-2 rounded border border-slate-900">{trade.findings.whatWentWrong || "None"}</p>
                            </div>
                          </div>
                        </div>

                        {trade.screenshotUrl && (
                          <div>
                            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 block border-b border-slate-900 pb-1 mb-2">Screenshot</span>
                            <div className="border border-slate-850 rounded-lg overflow-hidden h-[140px] relative">
                              <img referrerPolicy="no-referrer" src={trade.screenshotUrl} alt="Chart Capture" className="object-cover w-full h-full" />
                            </div>
                          </div>
                        )}
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
                <button
                  type="button"
                  onClick={() => setTradeToDelete(null)}
                  className="bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold py-2 px-5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteTrade}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors cursor-pointer shadow-lg shadow-rose-950/50"
                >
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

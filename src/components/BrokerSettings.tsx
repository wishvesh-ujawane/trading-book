import React, { useState } from 'react';
import { BrokerConfig, BrokerTax, Market, TaxMode } from '../types';
import { dbService } from '../lib/dbService';
import { useToast, useConfirm } from './ui';
import { motion, AnimatePresence } from 'motion/react';
import {
  Briefcase,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Info,
  IndianRupee,
  Percent,
  Receipt,
} from 'lucide-react';

const MARKETS: Market[] = ['EQUITY', 'FNO', 'COMMODITY', 'CURRENCY', 'CRYPTO'];
const MARKET_SHORT: Record<Market, string> = {
  EQUITY: 'EQ', FNO: 'F&O', COMMODITY: 'CDT', CURRENCY: 'CUR', CRYPTO: 'CRY',
};

interface BrokerSettingsProps {
  userId: string | null;
  brokers: BrokerConfig[];
  onClose?: () => void;
}

export default function BrokerSettings({ userId, brokers, onClose }: BrokerSettingsProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [brokeragePerTrade, setBrokeragePerTrade] = useState('1.00');
  const [estimatedSlippagePercent, setEstimatedSlippagePercent] = useState('0.02');
  const [customTaxes, setCustomTaxes] = useState<BrokerTax[]>([]);
  const [taxKey, setTaxKey] = useState('');
  const [taxValue, setTaxValue] = useState('');
  const [taxMode, setTaxMode] = useState<TaxMode>('FLAT');
  const [taxAppliesTo, setTaxAppliesTo] = useState<Market[]>([]);

  // Open Add Form
  const handleOpenAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setName('');
    setBrokeragePerTrade('0.00');
    setEstimatedSlippagePercent('0.00');
    setCustomTaxes([]);
    setTaxKey('');
    setTaxValue('');
    setTaxMode('FLAT');
    setTaxAppliesTo([]);
  };

  // Open Edit Form
  const handleOpenEdit = (broker: BrokerConfig) => {
    setEditingId(broker.id);
    setIsAdding(false);
    setName(broker.name);
    setBrokeragePerTrade(broker.brokeragePerTrade.toString());
    setEstimatedSlippagePercent(broker.estimatedSlippagePercent.toString());
    setCustomTaxes(broker.customTaxes || []);
    setTaxKey('');
    setTaxValue('');
    setTaxMode('FLAT');
    setTaxAppliesTo([]);
  };

  // Add Custom Tax / Fee row
  const handleAddTax = () => {
    if (!taxKey.trim() || !taxValue) return;
    const val = parseFloat(taxValue);
    if (isNaN(val)) return;

    const row: BrokerTax = {
      key: taxKey.trim(),
      value: val,
      mode: taxMode,
      appliesTo: taxAppliesTo.length > 0 ? taxAppliesTo : undefined,
    };
    setCustomTaxes([...customTaxes, row]);
    setTaxKey('');
    setTaxValue('');
    setTaxMode('FLAT');
    setTaxAppliesTo([]);
  };

  const toggleTaxMarket = (m: Market) => {
    setTaxAppliesTo((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };

  // Update mode / appliesTo on an existing row.
  const updateTaxRow = (index: number, patch: Partial<BrokerTax>) => {
    setCustomTaxes((prev) => prev.map((row, i) => i === index ? { ...row, ...patch } : row));
  };

  const toggleRowMarket = (index: number, m: Market) => {
    setCustomTaxes((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const cur = row.appliesTo ?? [];
      const next = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m];
      return { ...row, appliesTo: next.length > 0 ? next : undefined };
    }));
  };

  // Remove Custom Tax
  const handleRemoveTax = (index: number) => {
    setCustomTaxes(customTaxes.filter((_, i) => i !== index));
  };

  // Submit / Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const bFee = parseFloat(brokeragePerTrade);
    const sFee = parseFloat(estimatedSlippagePercent);

    // Preserve presetKey when editing a preset — the fee engine keys off it.
    const existing = editingId ? brokers.find((b) => b.id === editingId) : undefined;

    const newId = editingId
      || (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `${userId || 'guest'}-${(crypto as Crypto).randomUUID()}`
        : `${userId || 'guest'}-${Date.now()}`);

    const updatedBroker: BrokerConfig = {
      id: newId,
      name: name.trim(),
      brokeragePerTrade: isNaN(bFee) ? 0 : bFee,
      estimatedSlippagePercent: isNaN(sFee) ? 0 : sFee,
      customTaxes,
      presetKey: existing?.presetKey,
    };

    await dbService.saveBroker(updatedBroker, userId);
    setIsAdding(false);
    setEditingId(null);
  };

  // Delete Broker
  const handleDelete = async (brokerId: string) => {
    if (brokerId.startsWith('default-')) {
      toast.warning(
        'Default preset locked',
        'System default presets cannot be deleted. Create your own custom broker setup instead.'
      );
      return;
    }
    const ok = await confirm({
      title: 'Delete broker setup?',
      message:
        'This removes the broker from your configuration. It will not affect trades you already logged with it.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) {
      await dbService.deleteBroker(brokerId, userId);
      toast.success('Broker deleted');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-400" />
            Broker & Fees Setup
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Configure transaction fees, slippage, and local taxes for precise Net P&L metrics.
          </p>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: List of Brokers */}
        <div className="md:col-span-6 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Available Brokers</span>
            {!isAdding && !editingId && (
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Custom
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {brokers.map((broker) => {
              const rows = broker.customTaxes || [];
              const flatTotal = rows.filter((r) => (r.mode ?? 'FLAT') === 'FLAT').reduce((a, r) => a + r.value, 0);
              const percentRowCount = rows.filter((r) => r.mode === 'PERCENT_OF_TURNOVER').length;
              const isDefault = broker.id.startsWith('default-');

              return (
                <div 
                  key={broker.id}
                  className={`p-4 rounded-xl border transition-all ${
                    editingId === broker.id 
                      ? 'bg-slate-800/80 border-indigo-500/50 shadow-md shadow-indigo-500/5' 
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700/80'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{broker.name}</span>
                        {isDefault && (
                          <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md">Preset</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2.5 text-xs text-slate-400">
                        <div className="flex items-center gap-1">
                          <IndianRupee className="w-3 h-3 text-slate-500" />
                          <span>Flat: <strong className="text-slate-300">₹{broker.brokeragePerTrade.toFixed(2)}</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Percent className="w-3 h-3 text-slate-500" />
                          <span>Slippage: <strong className="text-slate-300">{broker.estimatedSlippagePercent}%</strong></span>
                        </div>
                        {rows.length > 0 && (
                          <div className="flex items-center gap-1 col-span-2 mt-1">
                            <Receipt className="w-3 h-3 text-slate-500" />
                            <span>
                              Fees:{' '}
                              {flatTotal > 0 && <strong className="text-slate-300">₹{flatTotal.toFixed(2)}</strong>}
                              {flatTotal > 0 && percentRowCount > 0 && <span className="text-slate-600"> + </span>}
                              {percentRowCount > 0 && <strong className="text-slate-300">{percentRowCount}% row{percentRowCount === 1 ? '' : 's'}</strong>}
                              <span className="text-slate-500"> ({rows.length} items)</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(broker)}
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Edit Broker Settings"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {!isDefault && (
                        <button
                          onClick={() => handleDelete(broker.id)}
                          className="p-1.5 hover:bg-slate-800/80 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                          title="Delete Broker"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Add / Edit Form */}
        <div className="md:col-span-6 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 sm:p-5">
          <AnimatePresence mode="wait">
            {isAdding || editingId ? (
              <motion.form 
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleSave} 
                className="space-y-4"
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {isAdding ? "Create Custom Broker" : "Modify Broker Configuration"}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingId(null); }}
                    className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Broker Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., E-Trade Pro"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                      Brokerage Fee (₹)
                      <span className="group relative text-slate-500 cursor-pointer">
                        <Info className="w-3 h-3" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-40 bg-slate-800 text-[10px] text-slate-300 p-2 rounded shadow-lg border border-slate-700 z-50">
                          Flat commission fee applied to every trade.
                        </span>
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={brokeragePerTrade}
                      onChange={(e) => setBrokeragePerTrade(e.target.value)}
                      placeholder="1.00"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                      Est. Slippage (%)
                      <span className="group relative text-slate-500 cursor-pointer">
                        <Info className="w-3 h-3" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-40 bg-slate-800 text-[10px] text-slate-300 p-2 rounded shadow-lg border border-slate-700 z-50">
                          Estimated loss due to bid-ask spread and latency.
                        </span>
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={estimatedSlippagePercent}
                      onChange={(e) => setEstimatedSlippagePercent(e.target.value)}
                      placeholder="0.05"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Custom taxes (mode + applies-to) */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Additional taxes & regulatory fees
                  </label>

                  {customTaxes.length > 0 && (
                    <div className="bg-slate-900 rounded-lg p-2 border border-slate-800 space-y-2">
                      {customTaxes.map((tax, index) => {
                        const mode: TaxMode = tax.mode ?? 'FLAT';
                        const applies = tax.appliesTo ?? [];
                        return (
                          <div key={index} className="bg-slate-950 border border-slate-800 rounded-lg p-2 space-y-1.5">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs font-mono text-slate-300 truncate">{tax.key}</span>
                              <span className="text-xs font-mono font-bold text-emerald-400">
                                {mode === 'PERCENT_OF_TURNOVER' ? `${tax.value}%` : `₹${tax.value.toFixed(2)}`}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTax(index)}
                                className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer p-1 -mr-1"
                                aria-label="Remove tax row"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 mr-1">Mode</span>
                              <button
                                type="button"
                                onClick={() => updateTaxRow(index, { mode: 'FLAT' })}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                  mode === 'FLAT'
                                    ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                                }`}
                              >Flat ₹</button>
                              <button
                                type="button"
                                onClick={() => updateTaxRow(index, { mode: 'PERCENT_OF_TURNOVER' })}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                  mode === 'PERCENT_OF_TURNOVER'
                                    ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                                }`}
                              >% of turnover</button>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 mr-1">Applies to</span>
                              {MARKETS.map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => toggleRowMarket(index, m)}
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                    applies.includes(m)
                                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                                  }`}
                                >{MARKET_SHORT[m]}</button>
                              ))}
                              {applies.length === 0 && (
                                <span className="text-[9px] text-slate-600 italic">All markets</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add new row builder */}
                  <div className="space-y-1.5 bg-slate-900/60 border border-slate-800/60 rounded-lg p-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. STT / GST / Stamp"
                        value={taxKey}
                        onChange={(e) => setTaxKey(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white focus:outline-none"
                      />
                      <input
                        type="number"
                        step="0.001"
                        placeholder={taxMode === 'PERCENT_OF_TURNOVER' ? '%' : '₹'}
                        value={taxValue}
                        onChange={(e) => setTaxValue(e.target.value)}
                        className="w-20 bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2 text-xs text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddTax}
                        className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 p-1.5 rounded-lg border border-indigo-500/20 transition-colors cursor-pointer flex items-center justify-center"
                        aria-label="Add tax row"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 mr-1">Mode</span>
                      <button
                        type="button"
                        onClick={() => setTaxMode('FLAT')}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          taxMode === 'FLAT'
                            ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >Flat ₹</button>
                      <button
                        type="button"
                        onClick={() => setTaxMode('PERCENT_OF_TURNOVER')}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          taxMode === 'PERCENT_OF_TURNOVER'
                            ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >% of turnover</button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 mr-1">Applies to</span>
                      {MARKETS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => toggleTaxMarket(m)}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            taxAppliesTo.includes(m)
                              ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                              : 'bg-slate-950 border-slate-800 text-slate-500'
                          }`}
                        >{MARKET_SHORT[m]}</button>
                      ))}
                      {taxAppliesTo.length === 0 && (
                        <span className="text-[9px] text-slate-600 italic">All markets</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Broker
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingId(null); }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.div 
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="bg-slate-900/80 p-3 rounded-full border border-slate-800 mb-3 text-slate-500">
                  <Briefcase className="w-6 h-6 text-slate-400" />
                </div>
                <h4 className="text-xs font-bold text-slate-300">Detailed Net P&L Tracking</h4>
                <p className="text-slate-500 text-[11px] max-w-xs mt-1">
                  Select or create your broker configuration on the left. Click on Edit to check transaction calculations or create custom tax structures.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="mt-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs py-1.5 px-3 rounded-lg font-semibold transition-all cursor-pointer"
                >
                  Configure Custom Broker
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

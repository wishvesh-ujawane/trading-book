import React, { useState } from 'react';
import { BrokerConfig } from '../types';
import { dbService } from '../lib/dbService';
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
  Receipt 
} from 'lucide-react';

interface BrokerSettingsProps {
  userId: string | null;
  brokers: BrokerConfig[];
  onClose?: () => void;
}

export default function BrokerSettings({ userId, brokers, onClose }: BrokerSettingsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [brokeragePerTrade, setBrokeragePerTrade] = useState('1.00');
  const [estimatedSlippagePercent, setEstimatedSlippagePercent] = useState('0.02');
  const [customTaxes, setCustomTaxes] = useState<{ key: string; value: number }[]>([]);
  const [taxKey, setTaxKey] = useState('');
  const [taxValue, setTaxValue] = useState('');

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
  };

  // Add Custom Tax / Fee Key-Value Pair
  const handleAddTax = () => {
    if (!taxKey.trim() || !taxValue) return;
    const val = parseFloat(taxValue);
    if (isNaN(val)) return;

    setCustomTaxes([...customTaxes, { key: taxKey.trim(), value: val }]);
    setTaxKey('');
    setTaxValue('');
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

    const updatedBroker: BrokerConfig = {
      id: editingId || `${userId || 'guest'}-${Date.now()}`,
      name: name.trim(),
      brokeragePerTrade: isNaN(bFee) ? 0 : bFee,
      estimatedSlippagePercent: isNaN(sFee) ? 0 : sFee,
      customTaxes
    };

    await dbService.saveBroker(updatedBroker, userId);
    setIsAdding(false);
    setEditingId(null);
  };

  // Delete Broker
  const handleDelete = async (brokerId: string) => {
    if (brokerId.startsWith('default-')) {
      alert("System default presets cannot be deleted. You can create your own custom broker setups!");
      return;
    }
    if (window.confirm("Are you sure you want to delete this broker setup? This will not affect existing logs but will remove it from configuration.")) {
      await dbService.deleteBroker(brokerId, userId);
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
              const totalTaxes = (broker.customTaxes || []).reduce((acc, curr) => acc + curr.value, 0);
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
                        {totalTaxes > 0 && (
                          <div className="flex items-center gap-1 col-span-2 mt-1">
                            <Receipt className="w-3 h-3 text-slate-500" />
                            <span>Other Taxes: <strong className="text-slate-300">₹{totalTaxes.toFixed(2)}</strong> ({broker.customTaxes.length} items)</span>
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
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-40 bg-slate-850 text-[10px] text-slate-300 p-2 rounded shadow-lg border border-slate-700 z-50">
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
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-40 bg-slate-850 text-[10px] text-slate-300 p-2 rounded shadow-lg border border-slate-700 z-50">
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

                {/* Key-Value Pair Taxes */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Additional Taxes & regulatory fees</label>
                  
                  {/* Tax Key-Value Lists */}
                  {customTaxes.length > 0 && (
                    <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-800 space-y-1.5">
                      {customTaxes.map((tax, index) => (
                        <div key={index} className="flex justify-between items-center text-xs font-mono bg-slate-950 px-2 py-1 rounded">
                          <span className="text-slate-400">{tax.key}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-400 font-bold">₹{tax.value.toFixed(2)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTax(index)}
                              className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Key-Value Inputs */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Regulatory tax / GST"
                      value={taxKey}
                      onChange={(e) => setTaxKey(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white focus:outline-none"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Amount ₹"
                      value={taxValue}
                      onChange={(e) => setTaxValue(e.target.value)}
                      className="w-20 bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddTax}
                      className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 p-1.5 rounded-lg border border-indigo-500/20 transition-colors cursor-pointer flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
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

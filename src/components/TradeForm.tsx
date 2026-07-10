import React, { useState, useEffect, useMemo } from 'react';
import { Trade, BrokerConfig } from '../types';
import { dbService } from '../lib/dbService';
import { motion } from 'motion/react';
import { 
  PlusCircle, 
  IndianRupee, 
  Percent, 
  Calculator, 
  Upload, 
  Trash2, 
  BookOpen, 
  Sparkles, 
  Scale, 
  X,
  FileImage,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

const POPULAR_INDIAN_SYMBOLS = [
  { symbol: 'NIFTY', name: 'Nifty 50 Index' },
  { symbol: 'BANKNIFTY', name: 'Bank Nifty Index' },
  { symbol: 'RELIANCE', name: 'Reliance Industries' },
  { symbol: 'TCS', name: 'Tata Consultancy Services' },
  { symbol: 'INFY', name: 'Infosys' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank' },
  { symbol: 'SBIN', name: 'State Bank of India' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors' },
  { symbol: 'ITC', name: 'ITC Limited' }
];

interface TradeFormProps {
  userId: string | null;
  brokers: BrokerConfig[];
  tradeToEdit?: Trade | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function TradeForm({ userId, brokers, tradeToEdit, onSuccess, onCancel }: TradeFormProps) {
  // Form states
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [tradeType, setTradeType] = useState<'LIVE' | 'DEMO'>('LIVE');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'STOP_LOSS'>('MARKET');
  
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  
  const [selectedBrokerId, setSelectedBrokerId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  
  // Psychological findings
  const [whatWentWell, setWhatWentWell] = useState('');
  const [whatWentWrong, setWhatWentWrong] = useState('');
  const [whatCouldBeImproved, setWhatCouldBeImproved] = useState('');
  
  // Screenshot upload
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Submit & saving states
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize/populate form if editing
  useEffect(() => {
    if (tradeToEdit) {
      setSymbol(tradeToEdit.symbol);
      setDirection(tradeToEdit.direction);
      setTradeType(tradeToEdit.tradeType);
      setOrderType(tradeToEdit.orderType);
      setEntryPrice(tradeToEdit.entryPrice.toString());
      setExitPrice(tradeToEdit.exitPrice.toString());
      setQuantity(tradeToEdit.quantity.toString());
      setSelectedBrokerId(tradeToEdit.brokerId);
      setDate(tradeToEdit.date);
      setTime(tradeToEdit.time || '');
      setWhatWentWell(tradeToEdit.findings.whatWentWell || '');
      setWhatWentWrong(tradeToEdit.findings.whatWentWrong || '');
      setWhatCouldBeImproved(tradeToEdit.findings.whatCouldBeImproved || '');
      setScreenshotBase64(tradeToEdit.screenshotUrl || null);
    } else {
      // Defaults for new trade
      setSymbol('');
      setDirection('LONG');
      setTradeType('LIVE');
      setOrderType('MARKET');
      setEntryPrice('');
      setExitPrice('');
      setQuantity('');
      
      // Select first available broker, fallback to manual
      if (brokers.length > 0) {
        setSelectedBrokerId(brokers[0].id);
      } else {
        setSelectedBrokerId('default-manual');
      }

      // Default to current date and time
      const now = new Date();
      const localDate = now.toISOString().split('T')[0];
      const localTime = now.toTimeString().split(' ')[0].substring(0, 5);
      setDate(localDate);
      setTime(localTime);

      setWhatWentWell('');
      setWhatWentWrong('');
      setWhatCouldBeImproved('');
      setScreenshotBase64(null);
    }
    setImageError(null);
  }, [tradeToEdit, brokers]);

  // Selected broker configuration
  const currentBroker = useMemo(() => {
    return brokers.find(b => b.id === selectedBrokerId) || null;
  }, [brokers, selectedBrokerId]);

  // Real-time Automated Calculations
  const calculations = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const xp = parseFloat(exitPrice);
    const qty = parseFloat(quantity);

    if (isNaN(ep) || isNaN(xp) || isNaN(qty) || ep <= 0 || qty <= 0) {
      return {
        grossPnl: 0,
        brokerage: 0,
        slippage: 0,
        taxes: 0,
        netPnl: 0,
        status: 'BREAK_EVEN' as const
      };
    }

    // Gross P&L
    let grossPnl = 0;
    if (direction === 'LONG') {
      grossPnl = (xp - ep) * qty;
    } else {
      grossPnl = (ep - xp) * qty;
    }

    // Broker Fees
    let brokerage = 0;
    let slippage = 0;
    let taxes = 0;

    if (currentBroker) {
      // Flat brokerage per trade (applied on entry AND exit, so 2 times)
      brokerage = currentBroker.brokeragePerTrade * 2;
      
      // Slippage calculation based on volume (entry volume + exit volume or average)
      const volume = (ep * qty) + (xp * qty);
      slippage = volume * (currentBroker.estimatedSlippagePercent / 100);

      // Custom taxes from the broker configuration
      taxes = (currentBroker.customTaxes || []).reduce((acc, curr) => acc + curr.value, 0);
    }

    const totalFees = brokerage + slippage + taxes;
    const netPnl = grossPnl - totalFees;

    let status: 'WIN' | 'LOSS' | 'BREAK_EVEN' = 'BREAK_EVEN';
    if (netPnl > 0.01) status = 'WIN';
    else if (netPnl < -0.01) status = 'LOSS';

    return {
      grossPnl: parseFloat(grossPnl.toFixed(2)),
      brokerage: parseFloat(brokerage.toFixed(2)),
      slippage: parseFloat(slippage.toFixed(2)),
      taxes: parseFloat(taxes.toFixed(2)),
      netPnl: parseFloat(netPnl.toFixed(2)),
      status
    };
  }, [entryPrice, exitPrice, quantity, direction, currentBroker]);

  // Image resize and compress to Base64 (max 800px width/height)
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setImageError("Selected file is not an image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max_size = 800;

        // Resize proportional
        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            height = max_size;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7); // 70% quality jpeg
          setScreenshotBase64(compressedBase64);
          setImageError(null);
        }
      };
      img.onerror = () => {
        setImageError("Failed to load image file.");
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setImageError("Failed to read file.");
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processImageFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  };

  const removeScreenshot = () => {
    setScreenshotBase64(null);
  };

  // Save Trade Action
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Explicit manual validation for better sandbox/iframe UX
    if (!symbol.trim()) {
      setSubmitError("Asset Symbol is required.");
      return;
    }
    const ep = parseFloat(entryPrice);
    if (isNaN(ep) || ep <= 0) {
      setSubmitError("Entry Price must be a valid positive number.");
      return;
    }
    const xp = parseFloat(exitPrice);
    if (isNaN(xp) || xp <= 0) {
      setSubmitError("Exit Price must be a valid positive number.");
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setSubmitError("Quantity must be a valid positive number.");
      return;
    }
    if (!date) {
      setSubmitError("Date is required.");
      return;
    }

    try {
      setIsSaving(true);
      
      let parsedTimestamp = new Date(`${date}T${time || '00:00'}`).getTime();
      if (isNaN(parsedTimestamp)) {
        parsedTimestamp = Date.now();
      }

      const finalTrade: Trade = {
        id: tradeToEdit?.id || `${userId || 'guest'}-${Date.now()}`,
        userId: userId || 'guest',
        symbol: symbol.trim().toUpperCase(),
        direction,
        tradeType,
        orderType,
        entryPrice: ep,
        exitPrice: xp,
        quantity: qty,
        date,
        time: time || undefined,
        timestamp: parsedTimestamp,
        brokerId: selectedBrokerId,
        brokerageFee: calculations.brokerage,
        slippageFee: calculations.slippage,
        taxFee: calculations.taxes,
        pnlGross: calculations.grossPnl,
        pnlNet: calculations.netPnl,
        findings: {
          whatWentWell: whatWentWell.trim(),
          whatWentWrong: whatWentWrong.trim(),
          whatCouldBeImproved: whatCouldBeImproved.trim()
        },
        screenshotUrl: screenshotBase64 || undefined,
        status: calculations.status
      };

      await dbService.saveTrade(finalTrade, userId);
      onSuccess();
    } catch (err: any) {
      console.error("Error saving trade:", err);
      setSubmitError(err.message || "Failed to save trade. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
        <div>
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-indigo-400" />
            {tradeToEdit ? "Modify Journal Entry" : "Log New Trade"}
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            {tradeToEdit ? "Update details for this specific trade logs" : "Enter trade execution parameters and psychological reflections."}
          </p>
        </div>
        <button 
          type="button" 
          onClick={onCancel}
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid md:grid-cols-12 gap-6">
        
        {/* Left Hand: Core trade params */}
        <div className="md:col-span-6 space-y-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 block border-b border-slate-800 pb-1">1. Execution Parameters</span>
          
          {/* Symbol + Toggles */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Asset Symbol</label>
              <input
                type="text"
                required
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="e.g., RELIANCE or NIFTY"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 animate-none"
              />
              {/* Quick Preset Buttons for Indian Markets */}
              <div className="mt-2 space-y-1">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Popular Presets</span>
                <div className="flex flex-wrap gap-1 max-h-[64px] overflow-y-auto pr-1">
                  {POPULAR_INDIAN_SYMBOLS.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      onClick={() => setSymbol(item.symbol)}
                      className={`text-[9px] px-1.5 py-0.5 rounded border transition-all cursor-pointer font-bold ${
                        symbol.toUpperCase() === item.symbol 
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' 
                          : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                      title={item.name}
                    >
                      {item.symbol}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Trade Mode</label>
              <div className="grid grid-cols-2 bg-slate-950 rounded-xl p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setTradeType('LIVE')}
                  className={`py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${tradeType === 'LIVE' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Live
                </button>
                <button
                  type="button"
                  onClick={() => setTradeType('DEMO')}
                  className={`py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${tradeType === 'DEMO' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Demo
                </button>
              </div>
            </div>
          </div>

          {/* Direction + Order Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Direction</label>
              <div className="grid grid-cols-2 bg-slate-950 rounded-xl p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setDirection('LONG')}
                  className={`py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${direction === 'LONG' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                >
                  Long (Buy)
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('SHORT')}
                  className={`py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${direction === 'SHORT' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Short (Sell)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Order Type</label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="MARKET">Market Order</option>
                <option value="LIMIT">Limit Order</option>
                <option value="STOP_LOSS">Stop Loss Order</option>
              </select>
            </div>
          </div>

          {/* Price and Quantities */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Entry Price (₹)</label>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="1500.00"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Exit Price (₹)</label>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                placeholder="1550.00"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Quantity</label>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Broker selection + Date/Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Execution Broker</label>
              <select
                value={selectedBrokerId}
                onChange={(e) => setSelectedBrokerId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {brokers.map((broker) => (
                  <option key={broker.id} value={broker.id}>
                    {broker.name} (₹{broker.brokeragePerTrade.toFixed(2)} / {broker.estimatedSlippagePercent}%)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2 text-[11px] text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2 text-[11px] text-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Screenshot drag-and-drop container */}
          <div className="space-y-2 pt-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Trade Screenshot Upload</label>
            
            {screenshotBase64 ? (
              <div className="relative border border-slate-800 bg-slate-950 rounded-xl p-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center">
                    <img referrerPolicy="no-referrer" src={screenshotBase64} alt="Trade capture" className="object-cover w-full h-full" />
                  </div>
                  <div>
                    <span className="block text-xs text-slate-300 font-semibold font-mono">Screenshot attached</span>
                    <span className="text-[10px] text-slate-500">Auto-compressed for sync performance</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeScreenshot}
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
                  isDragging 
                    ? 'border-indigo-500 bg-indigo-500/5' 
                    : 'border-slate-800 bg-slate-950 hover:border-slate-700 hover:bg-slate-950/80'
                }`}
                onClick={() => document.getElementById('screenshot-input')?.click()}
              >
                <Upload className="w-5 h-5 text-slate-500" />
                <div className="text-xs text-slate-400">
                  <span className="text-indigo-400 font-semibold">Click to upload</span> or drag trade chart screenshot
                </div>
                <span className="text-[9px] text-slate-500">Supports PNG, JPG (Auto-scaled)</span>
                <input
                  id="screenshot-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}
            {imageError && (
              <div className="text-[10px] text-rose-400 flex items-center gap-1.5 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{imageError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Hand: Psychological findings & calculations */}
        <div className="md:col-span-6 flex flex-col justify-between space-y-4">
          
          <div className="space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 block border-b border-slate-800 pb-1">2. Structured Psychological Review</span>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  What went well? (Strategy execution, emotional state)
                </label>
                <textarea
                  value={whatWentWell}
                  onChange={(e) => setWhatWentWell(e.target.value)}
                  placeholder="e.g., Strictly waited for confirmation, stayed calm."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2.5 text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                  <Scale className="w-3 h-3 text-rose-400" />
                  What went wrong? (Fomo, early exit, sizing)
                </label>
                <textarea
                  value={whatWentWrong}
                  onChange={(e) => setWhatWentWrong(e.target.value)}
                  placeholder="e.g., Exited too early because of fear."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2.5 text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-teal-400" />
                  What could be improved? (Actionable future logs)
                </label>
                <textarea
                  value={whatCouldBeImproved}
                  onChange={(e) => setWhatCouldBeImproved(e.target.value)}
                  placeholder="e.g., Set trailing stop loss to protect profits."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2.5 text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Live Automated Metrics Widget */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 mt-2">
            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 block mb-2 flex items-center gap-1.5">
              <Calculator className="w-3 h-3" />
              Automated Net P&L Calculation
            </span>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Gross P&L:</span>
                  <span className={calculations.grossPnl >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                    {calculations.grossPnl >= 0 ? '+' : ''}₹{calculations.grossPnl.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Brokerage Fees:</span>
                  <span className="text-slate-300 font-mono">₹{calculations.brokerage.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Est. Slippage:</span>
                  <span className="text-slate-300 font-mono">₹{calculations.slippage.toFixed(2)}</span>
                </div>
                {calculations.taxes > 0 && (
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Other Taxes:</span>
                    <span className="text-slate-300 font-mono">₹{calculations.taxes.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Net PNL Outcome */}
              <div className="bg-slate-900 rounded-lg p-3 flex flex-col justify-center items-center border border-slate-850">
                <span className="text-[9px] uppercase font-bold text-slate-500">Estimated Net P&L</span>
                <div className={`text-xl font-black mt-1 ${
                  calculations.netPnl > 0.01 ? 'text-emerald-400' : 
                  calculations.netPnl < -0.01 ? 'text-rose-400' : 'text-slate-400'
                }`}>
                  {calculations.netPnl > 0.01 ? '+' : ''}₹{calculations.netPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full mt-1.5 font-mono ${
                  calculations.status === 'WIN' ? 'bg-emerald-500/10 text-emerald-400' :
                  calculations.status === 'LOSS' ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {calculations.status}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Form Action Controls */}
      {submitError && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center gap-2.5 text-xs text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
        <button
          type="button"
          disabled={isSaving}
          onClick={onCancel}
          className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold py-2 px-5 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className={`bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-6 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-indigo-950 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            tradeToEdit ? "Update Log" : "Add to Journal"
          )}
        </button>
      </div>

    </form>
  );
}

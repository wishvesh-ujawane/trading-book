import React, { useEffect, useMemo, useState } from 'react';
import type {
  BrokerConfig,
  ChartTimeframe,
  Fill,
  HoldingStyle,
  Instrument,
  InstrumentKind,
  Market,
  MistakeTag,
  OptionType,
  Strategy,
  Trade,
} from '../types';
import {
  CHART_TIMEFRAMES,
  HOLDING_STYLES,
  MISTAKE_TAG_LABELS,
} from '../types';
import { dbService } from '../lib/dbService';
import {
  computeLedger,
  plannedRR,
  suggestHoldingStyle,
} from '../lib/pnl';
import { motion } from 'motion/react';
import {
  AlertCircle,
  BookOpen,
  Calculator,
  FileImage,
  ListChecks,
  PlusCircle,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

const POPULAR_INDIAN_SYMBOLS = [
  { symbol: 'NIFTY', name: 'Nifty 50 Index', lot: 75 },
  { symbol: 'BANKNIFTY', name: 'Bank Nifty Index', lot: 15 },
  { symbol: 'FINNIFTY', name: 'Fin Nifty Index', lot: 65 },
  { symbol: 'MIDCPNIFTY', name: 'Midcap Nifty', lot: 120 },
  { symbol: 'SENSEX', name: 'Sensex', lot: 20 },
  { symbol: 'RELIANCE', name: 'Reliance Industries', lot: 500 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', lot: 175 },
  { symbol: 'INFY', name: 'Infosys', lot: 400 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', lot: 550 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', lot: 700 },
  { symbol: 'SBIN', name: 'State Bank of India', lot: 750 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', lot: 1425 },
  { symbol: 'ITC', name: 'ITC Limited', lot: 1600 },
];

const MARKET_LABEL: Record<Market, string> = {
  EQUITY: 'Equity',
  FNO: 'F&O',
  COMMODITY: 'Commodity',
  CURRENCY: 'Currency',
  CRYPTO: 'Crypto',
};

const MISTAKE_TAG_ORDER: MistakeTag[] = [
  'NO_SL', 'MOVED_SL_AGAINST', 'REVENGE', 'FOMO', 'OVERSIZED',
  'CUT_WINNER_EARLY', 'HELD_LOSER', 'AGAINST_TREND', 'NO_PLAN', 'BROKE_RULES',
];

interface TradeFormProps {
  userId: string | null;
  brokers: BrokerConfig[];
  strategies?: Strategy[];
  tradeToEdit?: Trade | null;
  onSuccess: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toLocalIsoDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function toLocalIsoTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function toEpoch(date: string, time: string): number | null {
  if (!date) return null;
  const ms = new Date(`${date}T${time || '00:00'}`).getTime();
  return isNaN(ms) ? null : ms;
}
function makeId(userId: string | null): string {
  const uid = userId || 'guest';
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto as Crypto).randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${uid}-${rand}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TradeForm({
  userId,
  brokers,
  strategies = [],
  tradeToEdit,
  onSuccess,
  onCancel,
}: TradeFormProps) {
  // ---- Strategy + timeframe + holding style ----
  const [strategyId, setStrategyId] = useState<string>('');
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe | ''>('');
  const [holdingStyle, setHoldingStyle] = useState<HoldingStyle | ''>('');

  // ---- Instrument ----
  const [market, setMarket] = useState<Market>('EQUITY');
  const [instrumentKind, setInstrumentKind] = useState<InstrumentKind>('CASH');
  const [symbol, setSymbol] = useState('');
  const [expiry, setExpiry] = useState('');
  const [strike, setStrike] = useState('');
  const [optionType, setOptionType] = useState<OptionType>('CE');
  const [lotSize, setLotSize] = useState('1');

  // ---- Execution ----
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [tradeType, setTradeType] = useState<'LIVE' | 'DEMO'>('LIVE');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'STOP_LOSS'>('MARKET');
  const [selectedBrokerId, setSelectedBrokerId] = useState('');
  const [quantity, setQuantity] = useState('');

  // ---- Fills (simple mode = single entry/exit; advanced mode = multiple) ----
  const [usePartialFills, setUsePartialFills] = useState(false);
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [entryFills, setEntryFills] = useState<Fill[]>([]);
  const [exitFills, setExitFills] = useState<Fill[]>([]);

  // ---- Times (split into entry & exit) ----
  const [entryDate, setEntryDate] = useState('');
  const [entryTime, setEntryTime] = useState('');
  const [exitDate, setExitDate] = useState('');
  const [exitTime, setExitTime] = useState('');

  // ---- Planned levels ----
  const [showPlan, setShowPlan] = useState(false);
  const [planEntry, setPlanEntry] = useState('');
  const [planStopLoss, setPlanStopLoss] = useState('');
  const [planTarget, setPlanTarget] = useState('');

  // ---- Trailing SL history ----
  const [showSLHistory, setShowSLHistory] = useState(false);
  const [slHistory, setSLHistory] = useState<
    { at: string; from: string; to: string; reason?: string }[]
  >([]);

  // ---- Psychology + mistakes ----
  const [mistakes, setMistakes] = useState<MistakeTag[]>([]);
  const [whatWentWell, setWhatWentWell] = useState('');
  const [whatWentWrong, setWhatWentWrong] = useState('');
  const [whatCouldBeImproved, setWhatCouldBeImproved] = useState('');

  // ---- Screenshot ----
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ---- Submit state ----
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Populate form when editing (or reset when creating).
  useEffect(() => {
    if (tradeToEdit) {
      setStrategyId(tradeToEdit.strategyId ?? '');
      setChartTimeframe(tradeToEdit.chartTimeframe ?? '');
      setHoldingStyle(tradeToEdit.holdingStyle ?? '');

      // Instrument fields
      const inst = tradeToEdit.instrument;
      if (inst) {
        setMarket(inst.market);
        setInstrumentKind(inst.kind);
        setSymbol(inst.underlying);
        setExpiry(inst.expiry ?? '');
        setStrike(inst.strike !== undefined ? String(inst.strike) : '');
        setOptionType(inst.optionType ?? 'CE');
        setLotSize(String(inst.lotSize ?? 1));
      } else {
        // Legacy trade — treat as cash equity.
        setMarket('EQUITY');
        setInstrumentKind('CASH');
        setSymbol(tradeToEdit.symbol);
        setExpiry('');
        setStrike('');
        setOptionType('CE');
        setLotSize('1');
      }

      setDirection(tradeToEdit.direction);
      setTradeType(tradeToEdit.tradeType);
      setOrderType(tradeToEdit.orderType);
      setSelectedBrokerId(tradeToEdit.brokerId);
      setQuantity(String(tradeToEdit.quantity));

      // Fills
      const hasFills = (tradeToEdit.entries?.length ?? 0) > 1 || (tradeToEdit.exits?.length ?? 0) > 1;
      setUsePartialFills(hasFills);
      if (hasFills) {
        setEntryFills(tradeToEdit.entries ?? []);
        setExitFills(tradeToEdit.exits ?? []);
      }
      setEntryPrice(String(tradeToEdit.entryPrice));
      setExitPrice(String(tradeToEdit.exitPrice));

      // Times
      const entryAtMs = tradeToEdit.entryAt
        ?? (tradeToEdit.date ? toEpoch(tradeToEdit.date, tradeToEdit.time ?? '00:00') : tradeToEdit.timestamp);
      const exitAtMs = tradeToEdit.exitAt ?? entryAtMs ?? Date.now();
      setEntryDate(entryAtMs ? toLocalIsoDate(entryAtMs) : tradeToEdit.date);
      setEntryTime(entryAtMs ? toLocalIsoTime(entryAtMs) : tradeToEdit.time ?? '');
      setExitDate(toLocalIsoDate(exitAtMs));
      setExitTime(toLocalIsoTime(exitAtMs));

      // Plan
      const plan = tradeToEdit.plan;
      setShowPlan(plan !== undefined);
      setPlanEntry(plan?.entry !== undefined ? String(plan.entry) : '');
      setPlanStopLoss(plan?.stopLoss !== undefined ? String(plan.stopLoss) : '');
      setPlanTarget(plan?.target !== undefined ? String(plan.target) : '');

      // SL history
      const hist = tradeToEdit.stopLossHistory ?? [];
      setShowSLHistory(hist.length > 0);
      setSLHistory(
        hist.map((h) => ({
          at: toLocalIsoDate(h.at) + 'T' + toLocalIsoTime(h.at),
          from: String(h.from),
          to: String(h.to),
          reason: h.reason,
        })),
      );

      // Mistakes + psych
      setMistakes(tradeToEdit.mistakes ?? []);
      setWhatWentWell(tradeToEdit.findings.whatWentWell ?? '');
      setWhatWentWrong(tradeToEdit.findings.whatWentWrong ?? '');
      setWhatCouldBeImproved(tradeToEdit.findings.whatCouldBeImproved ?? '');

      setScreenshotBase64(tradeToEdit.screenshotUrl ?? null);
    } else {
      // Fresh form defaults
      setStrategyId('');
      setChartTimeframe('');
      setHoldingStyle('');
      setMarket('EQUITY');
      setInstrumentKind('CASH');
      setSymbol('');
      setExpiry('');
      setStrike('');
      setOptionType('CE');
      setLotSize('1');
      setDirection('LONG');
      setTradeType('LIVE');
      setOrderType('MARKET');
      setSelectedBrokerId(brokers.length > 0 ? brokers[0].id : 'default-manual');
      setQuantity('');
      setUsePartialFills(false);
      setEntryPrice('');
      setExitPrice('');
      setEntryFills([]);
      setExitFills([]);

      const now = new Date();
      const iso = toLocalIsoDate(now.getTime());
      const t = toLocalIsoTime(now.getTime());
      setEntryDate(iso);
      setEntryTime(t);
      setExitDate(iso);
      setExitTime(t);

      setShowPlan(false);
      setPlanEntry('');
      setPlanStopLoss('');
      setPlanTarget('');
      setShowSLHistory(false);
      setSLHistory([]);
      setMistakes([]);
      setWhatWentWell('');
      setWhatWentWrong('');
      setWhatCouldBeImproved('');
      setScreenshotBase64(null);
    }
    setImageError(null);
  }, [tradeToEdit, brokers]);

  // When strategy changes, apply its defaults. Overwrite existing values
  // because the user explicitly picked this strategy — its defaults should
  // trump the earlier auto-suggested holding style from the entry/exit time.
  useEffect(() => {
    if (!strategyId) return;
    const s = strategies.find((x) => x.id === strategyId);
    if (!s) return;
    if (s.defaultChartTimeframe) setChartTimeframe(s.defaultChartTimeframe);
    if (s.defaultHoldingStyle) setHoldingStyle(s.defaultHoldingStyle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategyId]);

  // When market shifts back to EQUITY, force kind CASH.
  useEffect(() => {
    if (market === 'EQUITY' && instrumentKind !== 'CASH') setInstrumentKind('CASH');
    if (market === 'FNO' && instrumentKind === 'CASH') setInstrumentKind('OPTIONS');
    if (market === 'CRYPTO' && instrumentKind !== 'CASH') setInstrumentKind('CASH');
  }, [market, instrumentKind]);

  // When a popular symbol is picked and market is F&O, prefill lot.
  const applyPresetSymbol = (sym: string) => {
    setSymbol(sym);
    const preset = POPULAR_INDIAN_SYMBOLS.find((p) => p.symbol === sym);
    if (preset && market === 'FNO' && lotSize === '1') {
      setLotSize(String(preset.lot));
    }
  };

  // ------------------ Derived: instrument + trade object for calc ------------------
  const currentBroker = useMemo(
    () => brokers.find((b) => b.id === selectedBrokerId) ?? null,
    [brokers, selectedBrokerId],
  );

  const derivedInstrument = useMemo<Instrument | undefined>(() => {
    if (market === 'EQUITY' && instrumentKind === 'CASH' && !symbol.trim()) return undefined;
    if (!symbol.trim()) return undefined;
    const tradingSymbol =
      market === 'FNO' && instrumentKind === 'OPTIONS'
        ? `${symbol.toUpperCase()}${expiry ? ' ' + expiry : ''}${strike ? ' ' + strike : ''} ${optionType}`
        : symbol.toUpperCase();
    return {
      market,
      kind: instrumentKind,
      underlying: symbol.trim().toUpperCase(),
      tradingSymbol,
      expiry: expiry || undefined,
      strike: strike ? Number(strike) : undefined,
      optionType: instrumentKind === 'OPTIONS' ? optionType : undefined,
      lotSize: Math.max(1, Number(lotSize) || 1),
      exchange: market === 'FNO' ? 'NFO' : market === 'COMMODITY' ? 'MCX' : market === 'CURRENCY' ? 'CDS' : market === 'CRYPTO' ? 'CRYPTO' : 'NSE',
    };
  }, [market, instrumentKind, symbol, expiry, strike, optionType, lotSize]);

  const previewEntries = useMemo<Fill[]>(() => {
    if (usePartialFills) return entryFills.filter((f) => f.qty > 0);
    const p = parseFloat(entryPrice); const q = parseFloat(quantity);
    const at = toEpoch(entryDate, entryTime) ?? Date.now();
    if (isNaN(p) || isNaN(q) || p <= 0 || q <= 0) return [];
    return [{ price: p, qty: q, at }];
  }, [usePartialFills, entryFills, entryPrice, quantity, entryDate, entryTime]);

  const previewExits = useMemo<Fill[]>(() => {
    if (usePartialFills) return exitFills.filter((f) => f.qty > 0);
    const p = parseFloat(exitPrice); const q = parseFloat(quantity);
    const at = toEpoch(exitDate, exitTime) ?? Date.now();
    if (isNaN(p) || isNaN(q) || p <= 0 || q <= 0) return [];
    return [{ price: p, qty: q, at }];
  }, [usePartialFills, exitFills, exitPrice, quantity, exitDate, exitTime]);

  const previewTrade = useMemo<Trade>(() => {
    const entryAt = toEpoch(entryDate, entryTime) ?? Date.now();
    const exitAt = toEpoch(exitDate, exitTime) ?? entryAt;
    const q = usePartialFills
      ? Math.max(previewEntries.reduce((a, f) => a + f.qty, 0), previewExits.reduce((a, f) => a + f.qty, 0))
      : (Number(quantity) || 0);
    return {
      id: tradeToEdit?.id ?? 'preview',
      userId: userId ?? 'guest',
      symbol: symbol.trim().toUpperCase(),
      direction,
      tradeType,
      orderType,
      entryPrice: previewEntries.length ? previewEntries[0].price : Number(entryPrice) || 0,
      exitPrice: previewExits.length ? previewExits[previewExits.length - 1].price : Number(exitPrice) || 0,
      quantity: q,
      date: entryDate,
      time: entryTime || undefined,
      timestamp: entryAt,
      brokerId: selectedBrokerId,
      brokerageFee: 0,
      slippageFee: 0,
      taxFee: 0,
      pnlGross: 0,
      pnlNet: 0,
      status: 'BREAK_EVEN',
      findings: { whatWentWell: '', whatWentWrong: '', whatCouldBeImproved: '' },
      strategyId: strategyId || undefined,
      chartTimeframe: chartTimeframe || undefined,
      holdingStyle: holdingStyle || undefined,
      instrument: derivedInstrument,
      entries: usePartialFills ? previewEntries : undefined,
      exits: usePartialFills ? previewExits : undefined,
      entryAt,
      exitAt,
      plan: showPlan
        ? {
            entry: planEntry ? Number(planEntry) : undefined,
            stopLoss: planStopLoss ? Number(planStopLoss) : undefined,
            target: planTarget ? Number(planTarget) : undefined,
          }
        : undefined,
    };
  }, [
    tradeToEdit, userId, symbol, direction, tradeType, orderType,
    previewEntries, previewExits, entryPrice, exitPrice, quantity,
    entryDate, entryTime, exitDate, exitTime, selectedBrokerId,
    strategyId, chartTimeframe, holdingStyle, derivedInstrument,
    usePartialFills, showPlan, planEntry, planStopLoss, planTarget,
  ]);

  const ledger = useMemo(() => computeLedger(previewTrade, currentBroker), [previewTrade, currentBroker]);
  const rr = useMemo(() => plannedRR(previewTrade), [previewTrade]);

  // A meaningful preview requires quantity plus at least one of entry / exit
  // price. Otherwise the flat brokerage / GST rows fire against nothing and
  // the widget shows a spurious "LOSS -₹7.20".
  const hasPreviewInput =
    previewTrade.quantity > 0 && (previewTrade.entryPrice > 0 || previewTrade.exitPrice > 0);

  // Auto-suggest holding style when the user has entered both times but not picked one.
  useEffect(() => {
    if (holdingStyle) return;
    const entryAt = toEpoch(entryDate, entryTime);
    const exitAt = toEpoch(exitDate, exitTime);
    const suggested = suggestHoldingStyle(entryAt ?? undefined, exitAt ?? undefined);
    if (suggested) setHoldingStyle(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryDate, entryTime, exitDate, exitTime]);

  // ------------------ Screenshot helpers (unchanged) ------------------
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setImageError('Selected file is not an image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        const max_size = 800;
        if (width > height) {
          if (width > max_size) { height *= max_size / width; width = max_size; }
        } else {
          if (height > max_size) { width *= max_size / height; height = max_size; }
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          // Guard against Firestore 1 MiB doc limit — reject anything > 400 KB.
          const approxBytes = Math.ceil((compressed.length * 3) / 4);
          if (approxBytes > 400_000) {
            setImageError('Screenshot too large (max ~400 KB after compression). Try a smaller image.');
            return;
          }
          setScreenshotBase64(compressed);
          setImageError(null);
        }
      };
      img.onerror = () => setImageError('Failed to load image file.');
      img.src = event.target?.result as string;
    };
    reader.onerror = () => setImageError('Failed to read file.');
    reader.readAsDataURL(file);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files.length > 0) processImageFile(e.dataTransfer.files[0]);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processImageFile(e.target.files[0]);
  };

  // ------------------ Fill row helpers ------------------
  const addEntryFill = () => setEntryFills((prev) => [...prev, { price: 0, qty: 0, at: Date.now() }]);
  const addExitFill = () => setExitFills((prev) => [...prev, { price: 0, qty: 0, at: Date.now() }]);
  const updateEntryFill = (i: number, patch: Partial<Fill>) =>
    setEntryFills((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const updateExitFill = (i: number, patch: Partial<Fill>) =>
    setExitFills((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const removeEntryFill = (i: number) => setEntryFills((prev) => prev.filter((_, idx) => idx !== i));
  const removeExitFill = (i: number) => setExitFills((prev) => prev.filter((_, idx) => idx !== i));

  // ------------------ SL history helpers ------------------
  const addSLRow = () => setSLHistory((prev) => [
    ...prev,
    { at: `${entryDate || toLocalIsoDate(Date.now())}T${entryTime || toLocalIsoTime(Date.now())}`, from: '', to: '', reason: '' },
  ]);
  const updateSLRow = (i: number, patch: Partial<{ at: string; from: string; to: string; reason?: string }>) =>
    setSLHistory((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeSLRow = (i: number) => setSLHistory((prev) => prev.filter((_, idx) => idx !== i));

  const toggleMistake = (m: MistakeTag) =>
    setMistakes((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  // ------------------ Submit ------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!symbol.trim()) return setSubmitError('Asset symbol / underlying is required.');
    if (market === 'FNO' && instrumentKind === 'OPTIONS' && !strike) {
      return setSubmitError('Strike is required for options trades.');
    }
    if (market === 'FNO' && !expiry) return setSubmitError('Expiry is required for F&O trades.');

    const qtyN = usePartialFills
      ? Math.max(previewEntries.reduce((a, f) => a + f.qty, 0), previewExits.reduce((a, f) => a + f.qty, 0))
      : Number(quantity);
    if (isNaN(qtyN) || qtyN <= 0) return setSubmitError('Quantity must be positive.');

    if (usePartialFills) {
      const eq = previewEntries.reduce((a, f) => a + f.qty, 0);
      const xq = previewExits.reduce((a, f) => a + f.qty, 0);
      if (eq <= 0 || xq <= 0) return setSubmitError('Add at least one entry and one exit fill.');
      if (Math.abs(eq - xq) > 0.0001) return setSubmitError(`Entry qty (${eq}) must equal exit qty (${xq}) for a closed trade.`);
    } else {
      const ep = parseFloat(entryPrice); const xp = parseFloat(exitPrice);
      if (isNaN(ep) || ep <= 0) return setSubmitError('Entry price must be a positive number.');
      if (isNaN(xp) || xp <= 0) return setSubmitError('Exit price must be a positive number.');
    }
    if (!entryDate) return setSubmitError('Entry date is required.');
    if (!exitDate) return setSubmitError('Exit date is required.');

    try {
      setIsSaving(true);
      const entryAt = toEpoch(entryDate, entryTime) ?? Date.now();
      const exitAt = toEpoch(exitDate, exitTime) ?? entryAt;
      const inst = derivedInstrument;
      const avgEntryPrice = previewEntries.length
        ? previewEntries.reduce((a, f) => a + f.price * f.qty, 0) / Math.max(1, previewEntries.reduce((a, f) => a + f.qty, 0))
        : Number(entryPrice) || 0;
      const avgExitPrice = previewExits.length
        ? previewExits.reduce((a, f) => a + f.price * f.qty, 0) / Math.max(1, previewExits.reduce((a, f) => a + f.qty, 0))
        : Number(exitPrice) || 0;

      // Convert SL history rows to typed form.
      const slHistoryFinal = slHistory
        .filter((r) => r.from !== '' && r.to !== '')
        .map((r) => ({
          at: new Date(r.at).getTime() || Date.now(),
          from: Number(r.from),
          to: Number(r.to),
          reason: r.reason || undefined,
        }));

      const finalTrade: Trade = {
        id: tradeToEdit?.id ?? makeId(userId),
        userId: userId ?? 'guest',
        symbol: inst?.tradingSymbol ?? symbol.trim().toUpperCase(),
        direction,
        tradeType,
        orderType,
        entryPrice: avgEntryPrice,
        exitPrice: avgExitPrice,
        quantity: qtyN,
        date: entryDate,
        time: entryTime || undefined,
        timestamp: entryAt,
        brokerId: selectedBrokerId,
        brokerageFee: ledger.fees.brokerage,
        slippageFee: ledger.fees.slippage,
        taxFee: ledger.fees.taxes,
        pnlGross: ledger.grossPnl,
        pnlNet: ledger.netPnl,
        status: ledger.status,
        findings: {
          whatWentWell: whatWentWell.trim(),
          whatWentWrong: whatWentWrong.trim(),
          whatCouldBeImproved: whatCouldBeImproved.trim(),
        },
        screenshotUrl: screenshotBase64 ?? undefined,
        aiSummary: tradeToEdit?.aiSummary,

        strategyId: strategyId || undefined,
        chartTimeframe: chartTimeframe || undefined,
        holdingStyle: holdingStyle || undefined,
        instrument: inst,
        entries: usePartialFills ? previewEntries : undefined,
        exits: usePartialFills ? previewExits : undefined,
        entryAt,
        exitAt,
        plan: showPlan && (planEntry || planStopLoss || planTarget) ? {
          entry: planEntry ? Number(planEntry) : undefined,
          stopLoss: planStopLoss ? Number(planStopLoss) : undefined,
          target: planTarget ? Number(planTarget) : undefined,
        } : undefined,
        stopLossHistory: slHistoryFinal.length > 0 ? slHistoryFinal : undefined,
        mistakes: mistakes.length > 0 ? mistakes : undefined,
        rMultiple: ledger.rMultiple ?? undefined,
      };

      await dbService.saveTrade(finalTrade, userId);
      onSuccess();
    } catch (err: any) {
      console.error('Error saving trade:', err);
      setSubmitError(err?.message || 'Failed to save trade. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeStrategy = strategies.find((s) => s.id === strategyId);

  // ------------------ Render ------------------
  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
        <div>
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-indigo-400" />
            {tradeToEdit ? 'Modify Journal Entry' : 'Log New Trade'}
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            {tradeToEdit
              ? 'Update details for this trade log.'
              : 'Enter trade execution parameters, plan, and psychological reflections.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close form"
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Strategy / Timeframe / Holding style row */}
      <section className="grid md:grid-cols-3 gap-4">
        <div>
          <Label>Strategy</Label>
          <select
            value={strategyId}
            onChange={(e) => setStrategyId(e.target.value)}
            className={inputClass}
          >
            <option value="">— None (freeform trade) —</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {activeStrategy?.checklist && activeStrategy.checklist.length > 0 && (
            <div className="mt-2 bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
              <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                <ListChecks className="w-3 h-3" /> Pre-trade checklist
              </div>
              <ul className="text-[10px] text-slate-300 list-disc list-inside space-y-0.5">
                {activeStrategy.checklist.map((c, i) => (
                  <li key={i} className="leading-snug">{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div>
          <Label>Chart Timeframe</Label>
          <div className="flex flex-wrap gap-1">
            {CHART_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setChartTimeframe(chartTimeframe === tf ? '' : tf)}
                className={`text-[10px] font-bold px-2 py-1 rounded-md border transition-colors ${
                  chartTimeframe === tf
                    ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Holding Style</Label>
          <div className="flex flex-wrap gap-1">
            {HOLDING_STYLES.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHoldingStyle(holdingStyle === h ? '' : h)}
                className={`text-[10px] font-bold px-2 py-1 rounded-md border transition-colors ${
                  holdingStyle === h
                    ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {h}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-slate-600 mt-1">Auto-suggested from entry/exit times.</p>
        </div>
      </section>

      <div className="grid md:grid-cols-12 gap-6">
        {/* Left column: instrument + execution + fills + times + screenshot */}
        <div className="md:col-span-7 space-y-5">
          {/* Section: Instrument */}
          <Section title="1. Instrument">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Market</Label>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(MARKET_LABEL) as Market[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMarket(m)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-md border transition-colors ${
                        market === m
                          ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {MARKET_LABEL[m]}
                    </button>
                  ))}
                </div>
              </div>
              {market !== 'EQUITY' && market !== 'CRYPTO' && (
                <div>
                  <Label>Instrument Kind</Label>
                  <div className="flex gap-1">
                    {(['CASH', 'FUTURES', 'OPTIONS'] as InstrumentKind[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setInstrumentKind(k)}
                        className={`flex-1 text-[10px] font-bold px-2 py-1 rounded-md border transition-colors ${
                          instrumentKind === k
                            ? 'bg-blue-500/20 border-blue-500/60 text-blue-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{market === 'FNO' ? 'Underlying' : 'Symbol'}</Label>
                <input
                  type="text"
                  required
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder={market === 'FNO' ? 'e.g. NIFTY' : market === 'CRYPTO' ? 'e.g. BTCUSDT' : 'e.g. RELIANCE'}
                  className={inputClass}
                />
              </div>
              <div>
                <Label>Lot Size</Label>
                <input
                  type="number"
                  min="1"
                  value={lotSize}
                  onChange={(e) => setLotSize(e.target.value)}
                  className={inputClass}
                />
                <p className="text-[9px] text-slate-600 mt-1">
                  {market === 'FNO' ? 'Contract multiplier (NIFTY = 75, BANKNIFTY = 15…)' : 'Cash / crypto = 1'}
                </p>
              </div>
            </div>

            {/* Popular preset chips */}
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Popular Presets</span>
              <div className="flex flex-wrap gap-1">
                {POPULAR_INDIAN_SYMBOLS.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => applyPresetSymbol(item.symbol)}
                    className={`text-[9px] px-1.5 py-0.5 rounded border transition-all cursor-pointer font-bold ${
                      symbol.toUpperCase() === item.symbol
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                    title={item.name}
                  >
                    {item.symbol}
                  </button>
                ))}
              </div>
            </div>

            {/* F&O extras: expiry, strike, CE/PE */}
            {market === 'FNO' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Expiry</Label>
                  <input
                    type="date"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className={inputClass}
                  />
                </div>
                {instrumentKind === 'OPTIONS' && (
                  <>
                    <div>
                      <Label>Strike</Label>
                      <input
                        type="number"
                        step="any"
                        value={strike}
                        onChange={(e) => setStrike(e.target.value)}
                        placeholder="25000"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <Label>Option Type</Label>
                      <div className="grid grid-cols-2 bg-slate-950 rounded-xl p-1 border border-slate-800">
                        {(['CE', 'PE'] as OptionType[]).map((o) => (
                          <button
                            key={o}
                            type="button"
                            onClick={() => setOptionType(o)}
                            className={`py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                              optionType === o
                                ? o === 'CE' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </Section>

          {/* Section: Execution */}
          <Section title="2. Execution">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Direction</Label>
                <div className="grid grid-cols-2 bg-slate-950 rounded-xl p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDirection('LONG')}
                    className={`py-1 text-xs font-bold rounded-lg transition-all ${direction === 'LONG' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                  >Long</button>
                  <button
                    type="button"
                    onClick={() => setDirection('SHORT')}
                    className={`py-1 text-xs font-bold rounded-lg transition-all ${direction === 'SHORT' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'}`}
                  >Short</button>
                </div>
              </div>
              <div>
                <Label>Mode</Label>
                <div className="grid grid-cols-2 bg-slate-950 rounded-xl p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setTradeType('LIVE')}
                    className={`py-1 text-xs font-bold rounded-lg transition-all ${tradeType === 'LIVE' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
                  >Live</button>
                  <button
                    type="button"
                    onClick={() => setTradeType('DEMO')}
                    className={`py-1 text-xs font-bold rounded-lg transition-all ${tradeType === 'DEMO' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}
                  >Demo</button>
                </div>
              </div>
              <div>
                <Label>Order Type</Label>
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="MARKET">Market</option>
                  <option value="LIMIT">Limit</option>
                  <option value="STOP_LOSS">Stop Loss</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Broker</Label>
              <select
                value={selectedBrokerId}
                onChange={(e) => setSelectedBrokerId(e.target.value)}
                className={inputClass}
              >
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </Section>

          {/* Section: Fills */}
          <Section
            title="3. Fills"
            action={
              <button
                type="button"
                onClick={() => setUsePartialFills((v) => !v)}
                className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300"
              >
                {usePartialFills ? 'Use single fill' : 'Log partial fills'}
              </button>
            }
          >
            {!usePartialFills ? (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Entry Price</Label>
                  <input type="number" step="any" min="0" value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)} placeholder="1500.00"
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label>Exit Price</Label>
                  <input type="number" step="any" min="0" value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)} placeholder="1550.00"
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <input type="number" step="any" min="0" value={quantity}
                    onChange={(e) => setQuantity(e.target.value)} placeholder="10"
                    className={inputClass}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <FillsTable
                  title="Entry fills"
                  fills={entryFills}
                  onAdd={addEntryFill}
                  onUpdate={updateEntryFill}
                  onRemove={removeEntryFill}
                />
                <FillsTable
                  title="Exit fills"
                  fills={exitFills}
                  onAdd={addExitFill}
                  onUpdate={updateExitFill}
                  onRemove={removeExitFill}
                />
                <p className="text-[10px] text-slate-500">
                  Total entry qty must equal total exit qty for a closed trade.
                </p>
              </div>
            )}
          </Section>

          {/* Section: Times */}
          <Section title="4. Entry & Exit Time">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Entry time</Label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" required value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={inputClassSm} />
                  <input type="time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} className={inputClassSm} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Exit time</Label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" required value={exitDate} onChange={(e) => setExitDate(e.target.value)} className={inputClassSm} />
                  <input type="time" value={exitTime} onChange={(e) => setExitTime(e.target.value)} className={inputClassSm} />
                </div>
              </div>
            </div>
          </Section>

          {/* Section: Screenshot */}
          <Section title="5. Screenshot (optional)">
            {screenshotBase64 ? (
              <div className="relative border border-slate-800 bg-slate-950 rounded-xl p-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center">
                    <img referrerPolicy="no-referrer" src={screenshotBase64} alt="Trade capture" className="object-cover w-full h-full" />
                  </div>
                  <div>
                    <span className="block text-xs text-slate-300 font-semibold font-mono">Screenshot attached</span>
                    <span className="text-[10px] text-slate-500">Auto-compressed &lt; 400 KB</span>
                  </div>
                </div>
                <button type="button" onClick={() => setScreenshotBase64(null)} className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                onClick={() => document.getElementById('screenshot-input')?.click()}
                className={`border border-dashed rounded-xl p-4 text-center cursor-pointer flex flex-col items-center gap-1.5 transition-all ${
                  isDragging ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                }`}
              >
                <Upload className="w-5 h-5 text-slate-500" />
                <div className="text-xs text-slate-400">
                  <span className="text-indigo-400 font-semibold">Click to upload</span> or drag chart screenshot
                </div>
                <span className="text-[9px] text-slate-500">PNG, JPG (auto-scaled to 400 KB max)</span>
                <input id="screenshot-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>
            )}
            {imageError && (
              <div className="text-[10px] text-rose-400 flex items-center gap-1.5 mt-1">
                <AlertCircle className="w-3.5 h-3.5" /><span>{imageError}</span>
              </div>
            )}
          </Section>
        </div>

        {/* Right column: Plan + SL history + Psychology + Live P&L */}
        <div className="md:col-span-5 space-y-5">
          {/* Section: Planned levels */}
          <Section
            title="Planned levels"
            action={
              <button type="button" onClick={() => setShowPlan((v) => !v)}
                className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300">
                {showPlan ? 'Hide' : 'Add plan'}
              </button>
            }
          >
            {showPlan ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Planned Entry</Label>
                    <input type="number" step="any" value={planEntry} onChange={(e) => setPlanEntry(e.target.value)}
                      placeholder="Entry price" className={inputClassSm} />
                  </div>
                  <div>
                    <Label>Stop Loss</Label>
                    <input type="number" step="any" value={planStopLoss} onChange={(e) => setPlanStopLoss(e.target.value)}
                      placeholder="SL price" className={inputClassSm} />
                  </div>
                  <div>
                    <Label>Target</Label>
                    <input type="number" step="any" value={planTarget} onChange={(e) => setPlanTarget(e.target.value)}
                      placeholder="Target price" className={inputClassSm} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
                    <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Planned RR</div>
                    <div className="text-white font-mono font-bold">{rr !== null ? `${rr}R` : '—'}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
                    <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Realised R</div>
                    <div className={`font-mono font-bold ${ledger.rMultiple !== null && ledger.rMultiple > 0 ? 'text-emerald-400' : ledger.rMultiple !== null && ledger.rMultiple < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                      {ledger.rMultiple !== null ? `${ledger.rMultiple > 0 ? '+' : ''}${ledger.rMultiple}R` : '—'}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-[10px] text-slate-500">
                Add planned SL and target to unlock R-multiple analytics on the dashboard.
              </p>
            )}
          </Section>

          {/* Section: Trailing SL history */}
          <Section
            title="Trailing SL history"
            action={
              <button type="button" onClick={() => setShowSLHistory((v) => !v)}
                className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300">
                {showSLHistory ? 'Hide' : 'Log SL changes'}
              </button>
            }
          >
            {showSLHistory ? (
              <div className="space-y-1.5">
                {slHistory.map((row, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1 items-center bg-slate-950 border border-slate-800 rounded-lg p-1.5">
                    <input type="datetime-local" value={row.at} onChange={(e) => updateSLRow(i, { at: e.target.value })}
                      className="col-span-4 bg-transparent text-[10px] text-slate-200 focus:outline-none" />
                    <input type="number" step="any" value={row.from} onChange={(e) => updateSLRow(i, { from: e.target.value })}
                      placeholder="from" className="col-span-2 bg-transparent text-[10px] text-slate-200 focus:outline-none" />
                    <input type="number" step="any" value={row.to} onChange={(e) => updateSLRow(i, { to: e.target.value })}
                      placeholder="to" className="col-span-2 bg-transparent text-[10px] text-slate-200 focus:outline-none" />
                    <input type="text" value={row.reason ?? ''} onChange={(e) => updateSLRow(i, { reason: e.target.value })}
                      placeholder="reason" className="col-span-3 bg-transparent text-[10px] text-slate-200 focus:outline-none" />
                    <button type="button" onClick={() => removeSLRow(i)} className="col-span-1 text-slate-500 hover:text-rose-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addSLRow}
                  className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  <PlusCircle className="w-3 h-3" /> Add SL change
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500">
                Record when and why you moved your stop loss. Great for spotting over-trailing.
              </p>
            )}
          </Section>

          {/* Section: Mistake tags */}
          <Section title="Common mistakes on this trade">
            <div className="flex flex-wrap gap-1">
              {MISTAKE_TAG_ORDER.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMistake(m)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${
                    mistakes.includes(m)
                      ? 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {MISTAKE_TAG_LABELS[m]}
                </button>
              ))}
            </div>
          </Section>

          {/* Section: Psychology */}
          <Section title="Psychological review">
            <div className="space-y-3">
              <div>
                <Label icon={<Sparkles className="w-3 h-3 text-indigo-400" />}>What went well?</Label>
                <textarea value={whatWentWell} onChange={(e) => setWhatWentWell(e.target.value)}
                  rows={2} placeholder="e.g., Waited for confirmation, respected SL." className={textareaClass} />
              </div>
              <div>
                <Label icon={<Scale className="w-3 h-3 text-rose-400" />}>What went wrong?</Label>
                <textarea value={whatWentWrong} onChange={(e) => setWhatWentWrong(e.target.value)}
                  rows={2} placeholder="e.g., Exited too early because of fear." className={textareaClass} />
              </div>
              <div>
                <Label icon={<BookOpen className="w-3 h-3 text-teal-400" />}>What could be improved?</Label>
                <textarea value={whatCouldBeImproved} onChange={(e) => setWhatCouldBeImproved(e.target.value)}
                  rows={2} placeholder="e.g., Use a wider SL structure-based." className={textareaClass} />
              </div>
            </div>
          </Section>

          {/* Live automated calculation widget */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-1.5 mb-2">
              <Calculator className="w-3 h-3" />
              Automated Net P&L
            </span>
            {!hasPreviewInput ? (
              <p className="text-[11px] text-slate-500 py-4 text-center">
                Enter quantity and at least one price to preview fees and net P&L.
              </p>
            ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 text-[11px]">
                <RowKV label="Gross P&L" value={ledger.grossPnl} highlight />
                <RowKV label="Brokerage" value={ledger.fees.brokerage} />
                <RowKV label="Slippage (est.)" value={ledger.fees.slippage} />
                {ledger.fees.taxes > 0 && <RowKV label="Taxes" value={ledger.fees.taxes} />}
                {ledger.rMultiple !== null && (
                  <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-900/80">
                    <span>Realised R</span>
                    <span className={`font-mono font-bold ${ledger.rMultiple > 0 ? 'text-emerald-400' : ledger.rMultiple < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                      {ledger.rMultiple > 0 ? '+' : ''}{ledger.rMultiple}R
                    </span>
                  </div>
                )}
              </div>
              <div className="bg-slate-900 rounded-lg p-3 flex flex-col justify-center items-center border border-slate-800">
                <span className="text-[9px] uppercase font-bold text-slate-500">Estimated Net</span>
                <div className={`text-xl font-black mt-1 ${
                  ledger.netPnl > 0.01 ? 'text-emerald-400' : ledger.netPnl < -0.01 ? 'text-rose-400' : 'text-slate-400'
                }`}>
                  {ledger.netPnl > 0.01 ? '+' : ''}₹{ledger.netPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full mt-1.5 font-mono ${
                  ledger.status === 'WIN' ? 'bg-emerald-500/10 text-emerald-400'
                    : ledger.status === 'LOSS' ? 'bg-rose-500/10 text-rose-400'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {ledger.status}
                </span>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

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
              Saving…
            </>
          ) : tradeToEdit ? 'Update trade' : 'Add to journal'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Small render helpers (kept local to this file)
// ---------------------------------------------------------------------------

const inputClass = 'w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500';
const inputClassSm = 'w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500';
const textareaClass = 'w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2.5 text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500';

function Label({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
      {icon}
      {children}
    </label>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function RowKV({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-slate-400">
      <span>{label}</span>
      <span className={`font-mono ${
        highlight ? (value >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold') : 'text-slate-300'
      }`}>
        {value >= 0 ? '' : ''}₹{value.toFixed(2)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fills table
// ---------------------------------------------------------------------------

function FillsTable({
  title,
  fills,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string;
  fills: Fill[];
  onAdd: () => void;
  onUpdate: (i: number, patch: Partial<Fill>) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</span>
        <button type="button" onClick={onAdd}
          className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
          <PlusCircle className="w-3 h-3" /> Add fill
        </button>
      </div>
      {fills.length === 0 && (
        <p className="text-[10px] text-slate-500">No fills yet — click <em>Add fill</em>.</p>
      )}
      <div className="space-y-1">
        {fills.map((f, i) => (
          <div key={i} className="grid grid-cols-12 gap-1 items-center">
            <input
              type="number" step="any" value={f.price || ''}
              onChange={(e) => onUpdate(i, { price: parseFloat(e.target.value) || 0 })}
              placeholder="price"
              className="col-span-4 bg-slate-900 border border-slate-800 rounded-md py-1 px-1.5 text-[11px] text-slate-200 focus:outline-none"
            />
            <input
              type="number" step="any" value={f.qty || ''}
              onChange={(e) => onUpdate(i, { qty: parseFloat(e.target.value) || 0 })}
              placeholder="qty"
              className="col-span-3 bg-slate-900 border border-slate-800 rounded-md py-1 px-1.5 text-[11px] text-slate-200 focus:outline-none"
            />
            <input
              type="datetime-local"
              value={
                f.at
                  ? `${toLocalIsoDate(f.at)}T${toLocalIsoTime(f.at)}`
                  : ''
              }
              onChange={(e) => onUpdate(i, { at: new Date(e.target.value).getTime() || Date.now() })}
              className="col-span-4 bg-slate-900 border border-slate-800 rounded-md py-1 px-1.5 text-[10px] text-slate-200 focus:outline-none"
            />
            <button type="button" onClick={() => onRemove(i)}
              className="col-span-1 text-slate-500 hover:text-rose-400 flex justify-center">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import type { Market, Strategy, ChartTimeframe, HoldingStyle } from '../types';
import { CHART_TIMEFRAMES, HOLDING_STYLES, EMPTY_STRATEGY } from '../types';
import { dbService } from '../lib/dbService';
import { Button, EmptyState, IconButton, useConfirm, useToast } from './ui';
import { AnimatePresence, motion } from 'motion/react';
import {
  Plus,
  Trash2,
  Edit3,
  X,
  BookOpen,
  ListChecks,
  Sparkles,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

interface StrategyManagerProps {
  userId: string | null;
  strategies: Strategy[];
}

const MARKETS: Market[] = ['EQUITY', 'FNO', 'COMMODITY', 'CURRENCY', 'CRYPTO'];
const MARKET_LABEL: Record<Market, string> = {
  EQUITY: 'Equity',
  FNO: 'F&O',
  COMMODITY: 'Commodity',
  CURRENCY: 'Currency',
  CRYPTO: 'Crypto',
};

const COLORS: Strategy['color'][] = ['indigo', 'emerald', 'amber', 'rose', 'blue', 'purple', 'teal'];
const COLOR_CLASS: Record<NonNullable<Strategy['color']>, string> = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  teal: 'bg-teal-500',
};

/**
 * Strategy library screen. Users create/edit/delete named strategies with
 * markets, default chart timeframe, checklist, and rules. Trades in the
 * TradeForm can then reference a strategy for per-strategy analytics.
 */
export default function StrategyManager({ userId, strategies }: StrategyManagerProps) {
  const toast = useToast();
  const confirm = useConfirm();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Draft form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [defaultTf, setDefaultTf] = useState<ChartTimeframe | ''>('');
  const [defaultStyle, setDefaultStyle] = useState<HoldingStyle | ''>('');
  const [color, setColor] = useState<NonNullable<Strategy['color']>>('indigo');
  const [checklist, setChecklist] = useState<string[]>([]);
  const [entryRules, setEntryRules] = useState<string[]>([]);
  const [exitRules, setExitRules] = useState<string[]>([]);
  const [riskRules, setRiskRules] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const beginEdit = (s: Strategy) => {
    setEditingId(s.id);
    setIsCreating(false);
    setName(s.name);
    setDescription(s.description ?? '');
    setMarkets(s.markets ?? []);
    setDefaultTf(s.defaultChartTimeframe ?? '');
    setDefaultStyle(s.defaultHoldingStyle ?? '');
    setColor(s.color ?? 'indigo');
    setChecklist([...s.checklist]);
    setEntryRules([...s.rules.entry]);
    setExitRules([...s.rules.exit]);
    setRiskRules([...s.rules.risk]);
  };

  const beginCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setName('');
    setDescription('');
    setMarkets([]);
    setDefaultTf('');
    setDefaultStyle('');
    setColor('indigo');
    setChecklist([]);
    setEntryRules([]);
    setExitRules([]);
    setRiskRules([]);
  };

  const closeEditor = () => {
    setIsCreating(false);
    setEditingId(null);
  };

  const toggleMarket = (m: Market) => {
    setMarkets((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Strategy name is required.');
      return;
    }
    setSaving(true);
    try {
      const now = Date.now();
      const existing = editingId ? strategies.find((s) => s.id === editingId) : undefined;
      const next: Strategy = {
        ...EMPTY_STRATEGY,
        id: existing?.id ?? `${userId ?? 'guest'}-${(crypto as any).randomUUID?.() ?? now}`,
        userId: userId ?? 'guest',
        name: name.trim(),
        description: description.trim() || undefined,
        markets,
        defaultChartTimeframe: defaultTf || undefined,
        defaultHoldingStyle: defaultStyle || undefined,
        color,
        checklist: checklist.filter((s) => s.trim().length > 0),
        rules: {
          entry: entryRules.filter((s) => s.trim().length > 0),
          exit: exitRules.filter((s) => s.trim().length > 0),
          risk: riskRules.filter((s) => s.trim().length > 0),
        },
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await dbService.saveStrategy(next, userId);
      toast.success(editingId ? 'Strategy updated' : 'Strategy created');
      closeEditor();
    } catch (err) {
      toast.error('Could not save strategy', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Strategy) => {
    const ok = await confirm({
      title: `Delete "${s.name}"?`,
      message: 'Trades already tagged with this strategy will keep their tag but the strategy will no longer appear in pickers.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await dbService.deleteStrategy(s.id, userId);
      toast.success('Strategy deleted');
    } catch (err) {
      toast.error('Could not delete strategy', err instanceof Error ? err.message : String(err));
    }
  };

  const sorted = useMemo(
    () => [...strategies].sort((a, b) => a.name.localeCompare(b.name)),
    [strategies],
  );

  const isEditing = editingId !== null || isCreating;

  return (
    <div className="space-y-5">
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Strategy Library
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Your named playbooks. Tag each trade with the strategy you used to see per-strategy win-rate and expectancy.
          </p>
        </div>
        {!isEditing && (
          <Button onClick={beginCreate} leadingIcon={<Plus className="w-4 h-4" />}>
            New strategy
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-5 items-start">
        {/* List */}
        <div className="lg:col-span-6 space-y-3">
          {sorted.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="w-6 h-6" />}
              title="No strategies yet"
              description="Build your first strategy — even a simple one keeps you accountable to a plan."
              action={<Button onClick={beginCreate} leadingIcon={<Plus className="w-4 h-4" />}>Create strategy</Button>}
            />
          ) : (
            sorted.map((s) => (
              <div
                key={s.id}
                className={`bg-slate-900/60 border rounded-2xl p-4 transition-colors ${
                  editingId === s.id ? 'border-indigo-500/60' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${COLOR_CLASS[s.color ?? 'indigo']}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-bold text-white truncate">{s.name}</h3>
                      {s.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{s.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {s.markets.map((m) => (
                          <span
                            key={m}
                            className="text-[9px] uppercase font-bold tracking-wider bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded"
                          >
                            {MARKET_LABEL[m]}
                          </span>
                        ))}
                        {s.defaultChartTimeframe && (
                          <span className="text-[9px] uppercase font-bold tracking-wider bg-indigo-500/15 text-indigo-300 px-1.5 py-0.5 rounded">
                            {s.defaultChartTimeframe}
                          </span>
                        )}
                        {s.defaultHoldingStyle && (
                          <span className="text-[9px] uppercase font-bold tracking-wider bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded">
                            {s.defaultHoldingStyle}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconButton
                      aria-label={`Edit ${s.name}`}
                      onClick={() => beginEdit(s)}
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      aria-label={`Delete ${s.name}`}
                      variant="danger"
                      onClick={() => handleDelete(s)}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>
                </div>

                {(s.checklist.length > 0 || s.rules.entry.length > 0 || s.rules.exit.length > 0 || s.rules.risk.length > 0) && (
                  <div className="grid sm:grid-cols-2 gap-3 mt-3 text-[11px]">
                    {s.checklist.length > 0 && (
                      <RuleBlock icon={<ListChecks className="w-3 h-3" />} label="Pre-trade checklist" items={s.checklist} />
                    )}
                    {s.rules.entry.length > 0 && (
                      <RuleBlock icon={<ArrowRight className="w-3 h-3" />} label="Entry rules" items={s.rules.entry} />
                    )}
                    {s.rules.exit.length > 0 && (
                      <RuleBlock icon={<BookOpen className="w-3 h-3" />} label="Exit rules" items={s.rules.exit} />
                    )}
                    {s.rules.risk.length > 0 && (
                      <RuleBlock icon={<ShieldAlert className="w-3 h-3" />} label="Risk rules" items={s.rules.risk} />
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-6 lg:sticky lg:top-4">
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.form
                key="editor"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={(e) => { e.preventDefault(); handleSave(); }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-display font-bold text-white">
                      {editingId ? 'Edit strategy' : 'New strategy'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      A strategy is a repeatable setup with rules and a checklist. Keep it short.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                    aria-label="Close editor"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <FormRow label="Name">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Opening Range Breakout (15m)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </FormRow>

                <FormRow label="Description (optional)">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="One sentence: what is this setup?"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </FormRow>

                <FormRow label="Markets">
                  <div className="flex flex-wrap gap-1.5">
                    {MARKETS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleMarket(m)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md border transition-colors ${
                          markets.includes(m)
                            ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {MARKET_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </FormRow>

                <div className="grid grid-cols-2 gap-3">
                  <FormRow label="Default chart timeframe">
                    <select
                      value={defaultTf}
                      onChange={(e) => setDefaultTf(e.target.value as ChartTimeframe | '')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">— None —</option>
                      {CHART_TIMEFRAMES.map((tf) => (
                        <option key={tf} value={tf}>{tf}</option>
                      ))}
                    </select>
                  </FormRow>
                  <FormRow label="Default holding style">
                    <select
                      value={defaultStyle}
                      onChange={(e) => setDefaultStyle(e.target.value as HoldingStyle | '')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">— None —</option>
                      {HOLDING_STYLES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </FormRow>
                </div>

                <FormRow label="Colour">
                  <div className="flex gap-1.5">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c!)}
                        aria-label={`${c} colour`}
                        className={`w-6 h-6 rounded-full ${COLOR_CLASS[c!]} border-2 transition-all ${
                          color === c ? 'border-white scale-110' : 'border-transparent'
                        }`}
                      />
                    ))}
                  </div>
                </FormRow>

                <ListEditor label="Pre-trade checklist" items={checklist} onChange={setChecklist} placeholder="e.g. Marked opening range" />
                <ListEditor label="Entry rules" items={entryRules} onChange={setEntryRules} placeholder="e.g. Close above 15m range" />
                <ListEditor label="Exit rules" items={exitRules} onChange={setExitRules} placeholder="e.g. Trail SL to breakeven at 1R" />
                <ListEditor label="Risk rules" items={riskRules} onChange={setRiskRules} placeholder="e.g. Max 2 trades a day" />

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <Button variant="secondary" size="sm" onClick={closeEditor} disabled={saving}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : editingId ? 'Update strategy' : 'Create strategy'}
                  </Button>
                </div>
              </motion.form>
            ) : (
              <motion.div
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400"
              >
                Select a strategy on the left to edit it, or click <strong className="text-slate-200">New strategy</strong> to add one.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const update = (i: number, v: string) => {
    const next = [...items];
    next[i] = v;
    onChange(next);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);

  return (
    <FormRow label={label}>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              type="text"
              value={it}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove row"
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-1"
        >
          <Plus className="w-3 h-3" /> Add row
        </button>
      </div>
    </FormRow>
  );
}

function RuleBlock({ icon, label, items }: { icon: React.ReactNode; label: string; items: string[] }) {
  return (
    <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-2.5">
      <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        {icon}
        {label}
      </div>
      <ul className="space-y-0.5 text-[11px] text-slate-300 list-disc list-inside">
        {items.map((it, i) => (
          <li key={i} className="leading-snug">{it}</li>
        ))}
      </ul>
    </div>
  );
}

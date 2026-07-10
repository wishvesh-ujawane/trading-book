import { useEffect, useState } from 'react';
import { Sparkles, Target, ExternalLink } from 'lucide-react';
import { dbService } from '../lib/dbService';
import { UserGoals } from '../types';
import {
  getStoredApiKey,
  setStoredApiKey,
} from '../lib/aiCoach';
import { Button, Input, Modal, useToast } from './ui';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  goals: UserGoals;
}

/**
 * User preferences dialog. Currently houses monthly trading goals and the
 * bring-your-own-key Gemini API key for the AI Coach.
 */
export default function Settings({ open, onClose, userId, goals }: SettingsProps) {
  const toast = useToast();

  const [profitTarget, setProfitTarget] = useState('');
  const [winRateTarget, setWinRateTarget] = useState('');
  const [tradeCountTarget, setTradeCountTarget] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync form state with incoming goals + stored key whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setProfitTarget(
      goals.monthlyNetProfitTarget !== undefined
        ? String(goals.monthlyNetProfitTarget)
        : '',
    );
    setWinRateTarget(
      goals.monthlyWinRateTarget !== undefined
        ? String(goals.monthlyWinRateTarget)
        : '',
    );
    setTradeCountTarget(
      goals.monthlyTradeCountTarget !== undefined
        ? String(goals.monthlyTradeCountTarget)
        : '',
    );
    setGeminiKey(getStoredApiKey());
  }, [open, goals]);

  const parseOptional = (s: string): number | undefined => {
    const trimmed = s.trim();
    if (trimmed === '') return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const next: UserGoals = {
        monthlyNetProfitTarget: parseOptional(profitTarget),
        monthlyWinRateTarget: parseOptional(winRateTarget),
        monthlyTradeCountTarget: parseOptional(tradeCountTarget),
      };
      // Validate win rate range if provided.
      if (
        next.monthlyWinRateTarget !== undefined &&
        (next.monthlyWinRateTarget < 0 || next.monthlyWinRateTarget > 100)
      ) {
        toast.error('Win rate must be between 0 and 100.');
        setSaving(false);
        return;
      }
      await dbService.saveGoals(next, userId);
      // Persist the Gemini key locally alongside goals (BYOK, device-only).
      setStoredApiKey(geminiKey);
      toast.success(
        'Settings saved',
        geminiKey ? 'Goals stored. AI Coach ready.' : 'Goals stored.',
      );
      onClose();
    } catch (err) {
      toast.error(
        'Could not save settings',
        err instanceof Error ? err.message : 'Unknown error',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      description="Personal preferences and trading goals."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <section className="space-y-4">
        <header className="flex items-start gap-3">
          <div className="bg-indigo-500/15 border border-indigo-500/30 rounded-xl p-2">
            <Target className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-display font-bold text-white">Monthly trading goals</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Optional targets for the current calendar month. Leave a field
              blank to skip that ring on the dashboard.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Net P&L target (₹)"
            type="number"
            inputMode="decimal"
            step="100"
            placeholder="e.g. 10000"
            value={profitTarget}
            onChange={(e) => setProfitTarget(e.target.value)}
            hint="Positive number in INR"
          />
          <Input
            label="Win rate target (%)"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            max="100"
            placeholder="e.g. 55"
            value={winRateTarget}
            onChange={(e) => setWinRateTarget(e.target.value)}
            hint="0 to 100"
          />
          <Input
            label="Trade count target"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            placeholder="e.g. 20"
            value={tradeCountTarget}
            onChange={(e) => setTradeCountTarget(e.target.value)}
            hint="Trades logged this month"
          />
        </div>
      </section>

      <hr className="border-slate-800" />

      <section className="space-y-4">
        <header className="flex items-start gap-3">
          <div className="bg-purple-500/15 border border-purple-500/30 rounded-xl p-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-white">AI Coach (Gemini)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Bring your own Gemini API key to unlock per-trade coaching and
              weekly reviews. The key is stored only in this browser (
              <code className="text-slate-300">localStorage</code>) and sent
              directly to Google&apos;s Gemini endpoint — never to us.
            </p>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 mt-1"
            >
              Get a free API key <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </header>

        <Input
          label="Gemini API key"
          type="password"
          autoComplete="off"
          placeholder="AIza…"
          value={geminiKey}
          onChange={(e) => setGeminiKey(e.target.value)}
          hint={
            geminiKey
              ? 'A key is set. Leave field as-is to keep, clear it to remove.'
              : 'Leave empty to keep the AI Coach disabled.'
          }
        />
      </section>
    </Modal>
  );
}

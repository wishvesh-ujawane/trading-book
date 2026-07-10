import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { dbService } from '../lib/dbService';
import { UserGoals } from '../types';
import { Button, Input, Modal, useToast } from './ui';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  goals: UserGoals;
}

/**
 * User preferences dialog. Currently houses monthly trading goals.
 * Future BYOK Gemini key input, theme toggle, etc. can be added here.
 */
export default function Settings({ open, onClose, userId, goals }: SettingsProps) {
  const toast = useToast();

  const [profitTarget, setProfitTarget] = useState('');
  const [winRateTarget, setWinRateTarget] = useState('');
  const [tradeCountTarget, setTradeCountTarget] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync form state with incoming goals whenever the modal opens.
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
      toast.success('Goals saved', 'Progress rings will update on the dashboard.');
      onClose();
    } catch (err) {
      toast.error(
        'Could not save goals',
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
    </Modal>
  );
}

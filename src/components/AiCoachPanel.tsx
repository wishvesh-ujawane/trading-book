import { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, Save, Trash2, Settings as SettingsIcon } from 'lucide-react';
import { MissingApiKeyError, hasStoredApiKey } from '../lib/aiCoach';
import { Button } from './ui';

/**
 * Watches the BYOK Gemini key stored in localStorage. Updates when the user
 * saves a new key via Settings (which fires a `tj_gemini_key_updated` event).
 */
export function useHasGeminiKey(): boolean {
  const [present, setPresent] = useState<boolean>(() => hasStoredApiKey());
  useEffect(() => {
    const sync = () => setPresent(hasStoredApiKey());
    window.addEventListener('tj_gemini_key_updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tj_gemini_key_updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return present;
}

interface AiCoachPanelProps {
  /** Called when the user clicks "Generate". Should call summarizeTrade/reviewWeek. */
  onGenerate: () => Promise<string>;
  /** Existing saved response, if any. */
  savedText?: string;
  /** Optional persist callback — if provided, a "Save" button appears. */
  onSave?: (text: string) => Promise<void> | void;
  /** Optional clear callback — if provided (and savedText present), a "Clear" button appears. */
  onClear?: () => Promise<void> | void;
  /** Called when user needs to open Settings to add a Gemini key. */
  onOpenSettings: () => void;
  /** Heading + descriptive copy. */
  title?: string;
  description?: string;
  /** Compact = fewer paddings, for embedded contexts. */
  compact?: boolean;
}

/**
 * Reusable "AI Coach" surface: prompt-to-generate button, streaming-free
 * loading state, response display, save/clear/regenerate controls, and a
 * BYOK CTA when no Gemini key is present.
 */
export function AiCoachPanel({
  onGenerate,
  savedText,
  onSave,
  onClear,
  onOpenSettings,
  title = 'AI Coach',
  description = 'Ask Gemini for a short review.',
  compact,
}: AiCoachPanelProps) {
  const hasKey = useHasGeminiKey();
  const [text, setText] = useState<string | undefined>(savedText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync incoming savedText when it changes (e.g. subscription updates the trade).
  useEffect(() => {
    setText(savedText);
  }, [savedText]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onGenerate();
      setText(result);
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        setError('Add your Gemini key in Settings to enable the AI Coach.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!onSave || !text) return;
    try {
      await onSave(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  };

  const handleClear = async () => {
    if (!onClear) return;
    try {
      await onClear();
      setText(undefined);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear.');
    }
  };

  const pad = compact ? 'p-3' : 'p-4';

  return (
    <div
      className={`bg-slate-950/50 border border-purple-500/20 rounded-xl ${pad} space-y-3`}
    >
      <div className="flex items-start gap-2">
        <span className="text-purple-400 mt-0.5">
          <Sparkles className="w-3.5 h-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-purple-300">
            {title}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>

      {!hasKey ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 leading-relaxed">
            Add your Gemini API key in Settings to unlock this coach. Your key
            stays on this device — trades and prompts are sent directly to
            Google&apos;s Gemini endpoint.
          </p>
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={<SettingsIcon className="w-3.5 h-3.5" />}
            onClick={onOpenSettings}
          >
            Add Gemini key
          </Button>
        </div>
      ) : text ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
            {text}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />}
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? 'Thinking…' : 'Regenerate'}
            </Button>
            {onSave && text !== savedText && (
              <Button
                size="sm"
                leadingIcon={<Save className="w-3 h-3" />}
                onClick={handleSave}
                disabled={loading}
              >
                Save
              </Button>
            )}
            {onClear && savedText && (
              <Button
                size="sm"
                variant="ghost"
                leadingIcon={<Trash2 className="w-3 h-3" />}
                onClick={handleClear}
                disabled={loading}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            leadingIcon={<Sparkles className={`w-3 h-3 ${loading ? 'animate-pulse' : ''}`} />}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? 'Thinking…' : 'Get AI feedback'}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2">
          {error}
        </p>
      )}
    </div>
  );
}

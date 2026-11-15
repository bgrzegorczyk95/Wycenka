import {
  formatPercent,
  formatPLNShort,
  parsePLN,
  priceInputText,
  type PriceListRule,
  type PricingRuleInput,
} from '@wycenka/core';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Notice } from '../../components/fields';
import { errorMessage } from '../../lib/api';
import { usePriceListMutations } from '../../lib/priceList';

const metres = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });

function label(rule: PriceListRule): string {
  if (rule.kind === 'height_surcharge' && rule.thresholdMilli !== null) {
    return `Wysokość powyżej ${metres.format(rule.thresholdMilli / 1000)} m`;
  }
  return rule.label;
}

const isSurcharge = (rule: PriceListRule) =>
  rule.kind === 'mosaic_surcharge' || rule.kind === 'height_surcharge';
/** Percentage rules (bps); the others are amounts in grosze. */
const isPercent = (rule: PriceListRule) => isSurcharge(rule) || rule.kind === 'material_markup';

function value(rule: PriceListRule): string {
  if (rule.bps !== null) return `${isSurcharge(rule) ? '+' : ''}${formatPercent(rule.bps)}`;
  if (rule.amountGr !== null) return formatPLNShort(rule.amountGr);
  return '—';
}

interface Draft {
  enabled: boolean;
  /** Percent („20”) or złoty („500”), depending on the rule. */
  value: string;
  /** Metres, height rule only („3”). */
  threshold: string;
}

const toDraft = (r: PriceListRule): Draft => ({
  enabled: r.enabled,
  // parsePLN/priceInputText work in hundredths, which is exactly bps for percentages.
  value: priceInputText(r.bps ?? r.amountGr),
  threshold: r.thresholdMilli === null ? '' : priceInputText(r.thresholdMilli / 10),
});

/** „Dopłaty i zasady” (Cennik / CennikDesktop). */
export function RulesCard({ rules, compact }: { rules: PriceListRule[]; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const { saveRule } = usePriceListMutations();

  function startEditing() {
    setDrafts(Object.fromEntries(rules.map((r) => [r.kind, toDraft(r)])));
    setError(null);
    setEditing(true);
  }

  async function save() {
    const changes: { rule: PriceListRule; input: PricingRuleInput }[] = [];
    for (const rule of rules) {
      const d = drafts[rule.kind]!;
      const parsed = d.value.trim() === '' ? null : parsePLN(d.value);
      if (d.value.trim() !== '' && parsed === null) return setError(`Popraw wartość: ${label(rule)}.`);
      if (d.enabled && parsed === null) return setError(`Wpisz wartość albo wyłącz: ${label(rule)}.`);
      const threshold = rule.kind === 'height_surcharge' ? parsePLN(d.threshold) : null;
      if (rule.kind === 'height_surcharge' && threshold === null)
        return setError('Wpisz wysokość w metrach.');
      const input: PricingRuleInput = {
        enabled: d.enabled,
        ...(isPercent(rule) ? { bps: parsed } : { amountGr: parsed }),
        ...(threshold !== null ? { thresholdMilli: threshold * 10 } : {}),
      };
      const before = toDraft(rule);
      if (before.enabled !== d.enabled || before.value !== d.value || before.threshold !== d.threshold) {
        changes.push({ rule, input });
      }
    }
    try {
      for (const c of changes) await saveRule.mutateAsync({ kind: c.rule.kind, input: c.input });
      setEditing(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const update = (kind: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [kind]: { ...d[kind]!, ...patch } }));

  return (
    <section className={`rounded-card border border-line bg-surface ${compact ? 'p-[18px]' : 'p-4'}`}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className={`m-0 font-semibold ${compact ? 'text-base' : 'text-[17px]'}`}>Dopłaty i zasady</h2>
        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            className="min-h-11 px-1 text-[15px] font-semibold text-accent"
          >
            Edytuj
          </button>
        )}
      </div>

      {!editing ? (
        <dl className={`m-0 flex flex-col ${compact ? 'gap-1.5 text-[13px]' : 'gap-2 text-[15px]'}`}>
          {rules.map((r) => (
            <div key={r.kind} className={`flex justify-between gap-3 ${r.enabled ? '' : 'text-muted'}`}>
              <dt className={r.enabled ? 'text-ink-2' : ''}>{label(r)}</dt>
              <dd className="m-0 font-semibold whitespace-nowrap">{r.enabled ? value(r) : 'wyłączone'}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((r) => {
            const d = drafts[r.kind]!;
            return (
              <div
                key={r.kind}
                className="flex flex-col gap-1.5 border-b border-[#EEEAE2] pb-3 last:border-b-0"
              >
                <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    onChange={(e) => update(r.kind, { enabled: e.target.checked })}
                    className="size-[18px] accent-[#1C2430]"
                  />
                  {r.label}
                </label>
                <div className="flex flex-col gap-1.5 pl-7 text-[13px] text-muted">
                  {r.kind === 'height_surcharge' && (
                    <span className="flex items-center gap-2">
                      <span className="w-[72px] whitespace-nowrap">powyżej</span>
                      <input
                        aria-label="Wysokość w metrach"
                        inputMode="decimal"
                        value={d.threshold}
                        onChange={(e) => update(r.kind, { threshold: e.target.value })}
                        className="min-h-10 w-20 rounded-[10px] border border-line-strong px-2 text-right text-[15px] text-ink"
                      />
                      m
                    </span>
                  )}
                  <span className="flex items-center gap-2">
                    <span className="w-[72px] whitespace-nowrap">
                      {isSurcharge(r) ? 'dopłata +' : isPercent(r) ? 'narzut' : 'kwota'}
                    </span>
                    <input
                      aria-label={`Wartość: ${r.label}`}
                      inputMode="decimal"
                      value={d.value}
                      onChange={(e) => update(r.kind, { value: e.target.value })}
                      className="min-h-10 w-20 rounded-[10px] border border-line-strong px-2 text-right text-[15px] text-ink"
                    />
                    {isPercent(r) ? '%' : 'zł'}
                  </span>
                </div>
              </div>
            );
          })}
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex gap-2">
            <Button variant="dark" disabled={saveRule.isPending} onClick={() => void save()}>
              Zapisz
            </Button>
            <Button variant="secondary" disabled={saveRule.isPending} onClick={() => setEditing(false)}>
              Anuluj
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

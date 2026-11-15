import { OFFER_STATUS_LABELS, type OfferStatus } from '@wycenka/core';

/** Status pills from the Main / PanelOfert mockups. */
const STYLES: Record<OfferStatus, string> = {
  draft: 'border border-[#C9C2B4] text-muted',
  queued: 'border border-warn-line bg-warn-bg text-warn',
  processing: 'border border-[#C9C2B4] text-muted',
  ready: 'border border-[#C9C2B4] text-muted',
  sent: 'bg-[#EEF0F3] text-ink-2',
  opened: 'bg-[#E7F0FB] text-[#1F4F8A]',
  accepted: 'bg-success-bg text-success',
  rejected: 'bg-[#EEF0F3] text-muted',
  expired: 'bg-[#EEF0F3] text-muted',
};

/** Short labels for the list (docs/01 table: „Szkic (AI układa)” etc.). */
const SHORT: Partial<Record<OfferStatus, string>> = { processing: 'AI układa', queued: 'Czeka' };

export function StatusPill({ status, long }: { status: OfferStatus; long?: boolean }) {
  const label = long ? OFFER_STATUS_LABELS[status] : (SHORT[status] ?? OFFER_STATUS_LABELS[status]);
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STYLES[status]}`}>
      {label}
    </span>
  );
}

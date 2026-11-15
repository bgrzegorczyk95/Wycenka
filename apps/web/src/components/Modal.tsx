import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Native <dialog>: bottom sheet on the phone, centered card on the desktop. Esc and backdrop close it. */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto w-full max-w-none rounded-t-[20px] bg-bg p-0 text-ink backdrop:bg-ink/40 lg:m-auto lg:max-w-[480px] lg:rounded-card"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 className="m-0 font-display text-[22px] font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="flex size-11 items-center justify-center rounded-[10px] text-muted hover:bg-sand"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          {open && children}
        </div>
      </div>
    </dialog>
  );
}

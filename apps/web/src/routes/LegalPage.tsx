import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router';

/** Placeholder – the owner provides the texts (docs/08 #8, M10). */
export function LegalPage({ title }: { title: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[720px] flex-col gap-4 px-5 py-6">
      <Link
        to="/"
        className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-muted"
      >
        <ChevronLeft size={18} aria-hidden /> Wróć
      </Link>
      <h1 className="m-0 font-display text-[30px] font-bold">{title}</h1>
      <p className="m-0 text-[15px] text-ink-2">Treść dokumentu pojawi się przed startem usługi.</p>
    </main>
  );
}

import { Mic, Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';

export function OffersPage() {
  return (
    <>
      <PageHeader
        title="Oferty"
        actions={
          <div className="hidden lg:block">
            <Button variant="accent">
              <Plus size={18} aria-hidden /> Nowa oferta
            </Button>
          </div>
        }
      />
      <section className="mx-5 flex flex-col items-center gap-4 rounded-card border border-line bg-surface px-6 py-10 text-center lg:mx-0">
        <p className="m-0 max-w-[320px] text-[15px] leading-[22px] text-ink-2">
          Nie masz jeszcze żadnej oferty. AI ułoży pozycje z Twojego cennika. Ceny zawsze sprawdzasz Ty.
        </p>
        <Button variant="dark">Zrób pierwszą ofertę</Button>
      </section>
      <div className="mt-auto px-5 pt-4 pb-4 lg:hidden">
        <Button size="main">
          <Mic size={22} aria-hidden /> Nowa oferta
        </Button>
      </div>
    </>
  );
}

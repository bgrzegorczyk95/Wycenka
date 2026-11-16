import { useQueryClient } from '@tanstack/react-query';
import { FileText, List, User } from 'lucide-react';
import { useEffect, type ComponentType } from 'react';
import { NavLink, Outlet } from 'react-router';
import { OFFERS_KEY } from '../lib/offers';
import { useMe } from '../lib/session';
import { startAutoSync } from '../offline/autoSync';

interface NavItem {
  to: string;
  label: string;
  sidebarLabel: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>;
}

const navItems: NavItem[] = [
  { to: '/oferty', label: 'Oferty', sidebarLabel: 'Oferty', icon: FileText },
  { to: '/cennik', label: 'Cennik', sidebarLabel: 'Cennik', icon: List },
  { to: '/firma', label: 'Firma', sidebarLabel: 'Firma i logo', icon: User },
];

export function AppLayout() {
  const queryClient = useQueryClient();
  // Screens needed without signal are fetched now, so they open later at the client's even if offline
  // (the service worker covers the next app starts).
  useEffect(() => {
    void import('../routes/offers/NewOfferPage');
    void import('../routes/offers/PendingPage');
    void import('../routes/offers/OfferPage');
  }, []);
  // Offline queue: send recordings waiting on the phone (start, back online, foreground, every 30 s).
  useEffect(
    () =>
      startAutoSync((r) => {
        if (r.sent.length) void queryClient.invalidateQueries({ queryKey: OFFERS_KEY });
      }),
    [queryClient],
  );
  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar />
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col pb-[76px] lg:max-w-none lg:min-w-0 lg:flex-1 lg:px-[clamp(16px,3vw,40px)] lg:py-8 lg:pb-8">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

function Sidebar() {
  const { data: me } = useMe();
  return (
    <aside className="hidden w-[220px] shrink-0 flex-col gap-6 border-r border-line bg-surface px-4 py-7 lg:flex">
      <div className="flex flex-col gap-0.5 px-2">
        <span className="font-display text-[22px] font-bold text-accent">Wycenka</span>
        {me && <span className="text-[13px] text-muted">{me.company.name}</span>}
      </div>
      <nav aria-label="Menu główne" className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex min-h-11 items-center rounded-[10px] px-3 text-[15px] ${
                isActive ? 'bg-bg font-semibold text-ink' : 'font-medium text-ink-2 hover:bg-bg'
              }`
            }
          >
            {item.sidebarLabel}
          </NavLink>
        ))}
      </nav>
      <p className="m-0 rounded-field bg-bg p-3 text-[13px] leading-[19px] text-ink-2">
        Nagrywasz oględziny na telefonie – oferta pojawi się tutaj od razu.
      </p>
    </aside>
  );
}

function BottomNav() {
  return (
    <nav
      aria-label="Menu główne"
      className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t border-line bg-surface px-2 pt-1.5 pb-[max(14px,env(safe-area-inset-bottom))] lg:hidden"
    >
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex min-h-[52px] flex-col items-center justify-center gap-1 text-xs ${
              isActive ? 'font-semibold text-ink' : 'font-medium text-muted'
            }`
          }
        >
          <Icon size={22} strokeWidth={2} aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

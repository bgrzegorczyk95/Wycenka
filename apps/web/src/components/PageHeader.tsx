import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 px-5 pt-7 pb-4 lg:px-0 lg:pt-0">
      <div className="flex flex-col gap-1">
        {eyebrow && <p className="text-[13px] text-muted">{eyebrow}</p>}
        <h1 className="font-display text-[30px] leading-tight font-bold tracking-[-0.5px] lg:text-[34px]">
          {title}
        </h1>
      </div>
      {actions}
    </header>
  );
}

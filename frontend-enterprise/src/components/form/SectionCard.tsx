import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type SectionCardProps = {
  title?: ReactNode;
  extra?: ReactNode;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  bodyClassName?: string;
} & Omit<HTMLAttributes<HTMLElement>, 'title'>;

export function SectionCard({
  title,
  extra,
  loading,
  children,
  className,
  headerClassName,
  titleClassName,
  bodyClassName,
  ...rest
}: SectionCardProps) {
  return (
    <section className={cn('overflow-hidden', className)} {...rest}>
      {(title || extra) && (
        <div className={cn('flex items-center justify-between gap-[12px]', headerClassName)}>
          <div className={cn('min-w-0', titleClassName)}>{title}</div>
          {extra ? <div className="shrink-0">{extra}</div> : null}
        </div>
      )}
      <div className={bodyClassName}>
        {loading ? (
          <div className="py-[24px] text-center text-[13px] text-[#858b9c]">加載中…</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  labelClassName = 'text-[13px] font-medium text-[#18181a]',
  hintClassName = 'text-[12px] leading-[1.55] text-[#858b9c]',
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  labelClassName?: string;
  hintClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label htmlFor={htmlFor} className={labelClassName}>
        {label}
      </label>
      {children}
      {hint ? <span className={hintClassName}>{hint}</span> : null}
    </div>
  );
}

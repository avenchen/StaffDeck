import { cn } from '@/lib/utils';
import { SectionCard as BaseSectionCard, type SectionCardProps } from '@/components/form/SectionCard';
import { SECTION_CARD_CLASS, SECTION_CARD_TITLE_CLASS } from '../styles';

export function SectionCard({ className, bodyClassName, ...props }: SectionCardProps) {
  return (
    <BaseSectionCard
      {...props}
      className={cn(SECTION_CARD_CLASS, className)}
      headerClassName="min-h-[40px]"
      titleClassName={SECTION_CARD_TITLE_CLASS}
      bodyClassName={cn('min-h-0 flex-1', bodyClassName)}
    />
  );
}

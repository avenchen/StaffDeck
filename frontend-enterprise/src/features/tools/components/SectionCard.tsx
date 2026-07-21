import {
  SectionCard as BaseSectionCard,
  type SectionCardProps,
} from '@/components/form/SectionCard';
import { cn } from '@/lib/utils';
import { CARD_CLASS, CARD_TITLE_CLASS } from '../styles';

export function SectionCard({ className, bodyClassName, ...props }: SectionCardProps) {
  return (
    <BaseSectionCard
      {...props}
      className={cn(CARD_CLASS, className)}
      headerClassName="min-h-[54px] border-b border-[#eceef1] px-[20px] py-[10px]"
      titleClassName={CARD_TITLE_CLASS}
      bodyClassName={cn('p-[20px]', bodyClassName)}
    />
  );
}

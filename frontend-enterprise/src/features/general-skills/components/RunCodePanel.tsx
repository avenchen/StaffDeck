import { cn } from '@/lib/utils';
import CodeBlock from '@/components/CodeBlock';
import { SKILL_TRACE_CODE_DETAILS_CLASS, SKILL_TRACE_CODE_SUMMARY_CLASS, SKILL_CODE_BLOCK_CLASS } from '../styles';
import { codeLanguage } from '../lib/skillFiles';
import { TraceDisclosureLabel } from './TraceDisclosureLabel';

export function RunCodePanel({
  title,
  code,
  language,
  defaultOpen = false,
  className,
}: {
  title: string;
  code: string;
  language?: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details className={cn(SKILL_TRACE_CODE_DETAILS_CLASS, 'mt-0', className)} open={defaultOpen}>
      <summary className={SKILL_TRACE_CODE_SUMMARY_CLASS}>
        {title}
        <TraceDisclosureLabel />
      </summary>
      <CodeBlock className={SKILL_CODE_BLOCK_CLASS} code={code} language={language || codeLanguage(code)} />
    </details>
  );
}

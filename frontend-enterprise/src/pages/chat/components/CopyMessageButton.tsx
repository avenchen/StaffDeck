import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { cn } from '@/lib/utils';

import { CHAT_FEEDBACK_BTN_CLASS } from '../chatPageStyles';

/** Copies an assistant message to the clipboard, with a brief confirmation. */
export default function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context); fail silently.
    }
  }

  return (
    <button
      type="button"
      className={cn(CHAT_FEEDBACK_BTN_CLASS, copied && 'text-[#18a058]')}
      aria-label={copied ? '已复制' : '复制回答'}
      title={copied ? '已复制' : '复制回答'}
      onClick={() => void copy()}
    >
      {copied ? <Check width={15} height={15} /> : <Copy width={15} height={15} />}
    </button>
  );
}

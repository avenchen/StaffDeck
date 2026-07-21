import { cn } from '@/lib/utils';

export const SECTION_CARD_CLASS =
  'flex flex-col gap-[24px] rounded-[20px_20px_0_0] bg-[#FFF] p-[18px] shadow-[0_-4px_16px_0_rgba(0,0,0,0.05)]';
export const SECTION_CARD_TITLE_CLASS = 'text-[14px] font-medium text-[#18181a]';
export const RETURN_BUTTON_CLASS =
  'h-8 gap-1 rounded-[10px] border-[0.5px] border-[#e3e7f1] bg-white px-5 text-[12px] font-normal text-[#757f9c] hover:border-[#cbd3e6]! hover:bg-white! hover:text-[#18181a]! aria-expanded:border-[#cbd3e6]! aria-expanded:bg-white! aria-expanded:text-[#18181a]!';
export const PRIMARY_BUTTON_CLASS =
  'h-8 gap-1 rounded-[10px] bg-[#18181a] px-5 text-[12px] font-normal text-white hover:bg-[#303030]';
export const DELETE_BUTTON_CLASS =
  'h-8 gap-1 rounded-[10px] border-[0.5px] border-[#e3e7f1] bg-white px-5 text-[12px] font-normal text-[#d20b0b] hover:border-[#f3b6b6]! hover:bg-[#fce7e7]! hover:text-[#d20b0b]! aria-expanded:border-[#f3b6b6]! aria-expanded:bg-[#fce7e7]! aria-expanded:text-[#d20b0b]!';
export const EDITOR_ACTION_OUTLINE_CLASS = RETURN_BUTTON_CLASS;
export const EDITOR_ACTION_PRIMARY_CLASS = PRIMARY_BUTTON_CLASS;
export const HIDDEN_FILE_INPUT_CLASS =
  'pointer-events-none fixed size-px opacity-0 [inset:auto_auto_0_0]';
export const SKILL_EDITOR_DRAG_ACTIVE_CLASS =
  'ring-1 ring-[#18181a]/20 shadow-[0_-4px_16px_0_rgba(0,0,0,0.08)]';
export const SKILL_DROP_HINT_CLASS =
  'pointer-events-none absolute inset-x-[18px] bottom-[18px] top-[46px] z-[6] flex items-center justify-center gap-3 rounded-[14px] border border-dashed border-[#18181a] bg-white/90 text-[15px] font-semibold text-[#18181a] shadow-sm backdrop-blur-sm';
export const SKILL_FILE_EDITOR_CLASS =
  'grid min-h-[560px] flex-1 grid-cols-[minmax(180px,240px)_minmax(0,1fr)] overflow-hidden border-t border-[#e3e7f1] bg-[#fafafa]';
export const SKILL_FILE_TREE_CLASS =
  'grid min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] border-r border-[#e3e7f1] bg-white';
export const SKILL_FILE_TREE_HEADER_CLASS =
  'flex min-h-[44px] items-center gap-2 border-b border-[#e3e7f1] bg-[#f6f6f6] px-[14px] text-[12px] font-medium text-[#757f9c]';
export const SKILL_FILE_TREE_LIST_CLASS =
  'min-h-0 overflow-auto bg-white p-2';
export const SKILL_FILE_TREE_ACTIONS_CLASS =
  'flex gap-2 border-t border-[#e3e7f1] bg-white p-[10px]';
export const SKILL_FILE_PANE_CLASS =
  'grid min-w-0 grid-rows-[auto_minmax(0,1fr)]';
export const SKILL_FILE_TAB_CLASS =
  'flex min-h-[44px] items-center gap-2 border-b border-[#e3e7f1] bg-[#f6f6f6] px-[14px] text-[12px] font-medium text-[#757f9c]';
export const SKILL_CODE_EDITOR_CLASS =
  'relative min-h-0 overflow-hidden bg-[#fafafa] font-mono text-[13px] leading-[1.7] tab-[2] shadow-[inset_0_1px_0_#e3e7f1]';
export const SKILL_CODE_HIGHLIGHT_CLASS =
  'pointer-events-none absolute inset-0 z-[1] m-0 overflow-hidden whitespace-pre p-[18px_20px] text-[#18181a] tab-[2]';
export const SKILL_CODE_HIGHLIGHT_CODE_CLASS =
  'block w-max min-w-full font-[inherit] will-change-transform';
export const SKILL_CODE_INPUT_CLASS =
  'absolute inset-0 z-[2] m-0 size-full min-h-0 resize-none overflow-auto rounded-none border-0 bg-transparent! p-[18px_20px] font-[inherit] leading-[inherit] tracking-normal whitespace-pre text-transparent caret-[#18181a] outline-none tab-[2] [scrollbar-gutter:stable] selection:bg-[rgba(0,120,215,0.24)] [-webkit-text-fill-color:transparent]';
export const SKILL_RESULT_LAYOUT_CLASS = 'grid gap-5';
export const SKILL_SECTION_LABEL_CLASS =
  'mb-2 text-[12px] font-semibold text-[#757f9c]';
export const SKILL_REPLY_PANEL_CLASS =
  'rounded-xl border border-[#eceef1] bg-white p-[16px_18px]';
export const SKILL_REPLY_TEXT_CLASS =
  'mb-0! text-[15px] leading-[1.8] text-[#18181a]';
export const SKILL_TRACE_LIST_CLASS =
  'grid gap-[10px] rounded-xl border border-[#eceef1] bg-[#fbfcfd] p-[12px_14px]';
export const SKILL_TRACE_ITEM_CLASS =
  'grid min-w-0 grid-cols-[12px_minmax(0,1fr)] gap-[10px]';
export const SKILL_TRACE_ITEM_BODY_CLASS = 'min-w-0 max-w-full';
export const SKILL_TRACE_DOT_CLASS =
  'mt-[9px] size-[7px] shrink-0 rounded-full bg-[#18181a]';
export const SKILL_TRACE_TITLE_CLASS =
  'text-[13px] font-semibold text-[#18181a]';
export const SKILL_TRACE_MESSAGE_CLASS =
  'mt-[2px] break-words text-[12px] leading-[1.55] text-[#757f9c]';
export const SKILL_TRACE_CODE_DETAILS_CLASS =
  'group/gs-trace box-border w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-[#eceef1] bg-white';
export const SKILL_TRACE_CODE_SUMMARY_CLASS =
  'flex min-h-[38px] cursor-pointer list-none items-center gap-2 px-3 py-[9px] text-[12px] font-semibold text-[#18181a] select-none group-open/gs-trace:border-b group-open/gs-trace:border-[#eceef1] [&::-webkit-details-marker]:hidden';
export const SKILL_CODE_BLOCK_CLASS =
  'm-0 max-h-[520px] max-w-full overflow-auto whitespace-pre border-0 p-[16px_18px] font-mono text-[12px] leading-[1.65]';
export const SKILL_OUTPUT_STACK_CLASS = 'grid gap-[10px]';

export function skillFileNodeClass(active: boolean) {
  return cn(
    'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-[10px] py-2 text-left text-[12px] text-[#757f9c] transition-[background,color,box-shadow] duration-150',
    'hover:bg-[#f6f6f6] hover:text-[#18181a]',
    active && 'bg-[#f6f6f6] text-[#18181a]',
  );
}

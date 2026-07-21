import {
  ApiOutlined,
  ArrowLeftOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  CodeOutlined,
  CloseOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DownOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  PlusOutlined,
  RightOutlined,
  SaveOutlined,
  SendOutlined,
  StopOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@/icons';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
  type ClipboardEvent,
  type CSSProperties,
  type DragEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui';
import { Button as UIButton } from '@/components/ui/button';
import { notify } from '@/components/ui/app-toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import AppHeader from '@/components/AppHeader';
import { ModelConfigDropdown } from '@/components/ModelConfigDropdown';
import { cn } from '@/lib/utils';
import { SELECT_TRIGGER_CLASS } from '@/lib/enterprise-ui';
import type { EnterpriseAuthUser } from '@/auth';
import {
  ACTION_EMPTY_CLASS,
  ACTION_LIST_CLASS,
  CARD_OUTLINE_BUTTON_CLASS,
  CHAT_ACTIONS_GROUP_CLASS,
  CHAT_CARD_BODY_CLASS,
  CHAT_ATTACHMENT_CLASS,
  CHAT_ATTACHMENT_ICON_CLASS,
  CHAT_ATTACHMENT_MAIN_CLASS,
  CHAT_ATTACHMENT_NAME_CLASS,
  CHAT_ATTACHMENT_TYPE_CLASS,
  CHAT_ATTACHMENT_USER_CLASS,
  CHAT_ATTACHMENTS_CLASS,
  CHAT_ATTACHMENTS_USER_CLASS,
  CHAT_CARD_CLASS,
  CHAT_CARD_DRAGGING_CLASS,
  CHAT_ACTIONS_CLASS,
  CHAT_COMPOSER_SHELL_CLASS,
  CHAT_CONFIRM_CLASS,
  CHAT_CONTENT_CLASS,
  CHAT_CONTENT_USER_ATTACHMENTS_CLASS,
  CHAT_DECISION_CLASS,
  CHAT_EDIT_ACTIONS_CLASS,
  CHAT_EDIT_PANEL_CLASS,
  CHAT_EDIT_PANEL_USER_ATTACHMENTS_CLASS,
  CHAT_EDIT_TEXTAREA_CLASS,
  CHAT_HOVER_ACTIONS_CLASS,
  CHAT_HOVER_BUTTON_CLASS,
  CHAT_MESSAGES_CLASS,
  CHAT_PANEL_CLASS,
  CHAT_COMPOSER_CLASS,
  CHAT_TEXTAREA_CLASS,
  CHAT_THINKING_BLOCK_CLASS,
  CHAT_THINKING_BUTTON_CLASS,
  CHAT_THINKING_DETAIL_CLASS,
  CHAT_THINKING_DETAILS_CLASS,
  CHAT_TIME_CLASS,
  CHAT_UPLOAD_DROP_HINT_CLASS,
  CHAT_WARNING_CLASS,
  CHAT_WARNING_ITEM_CLASS,
  CHAT_WARNING_TITLE_CLASS,
  CONDITION_EDITOR_CLASS,
  CONDITION_INPUT_CLASS,
  CONDITION_PRESET_CLASS,
  CONDITION_READABLE_CLASS,
  DIFF_NEW_CLASS,
  DIFF_OLD_CLASS,
  DISTILL_CARD_BODY_CLASS,
  DISTILL_CARD_CLASS,
  DISTILL_CARD_HEADER_CLASS,
  DISTILL_ACTIONS_CLASS,
  DISTILL_PAGE_CLASS,
  FLOW_CHIP_CLASS,
  FLOW_CHIP_LIST_CLASS,
  FLOW_CHIP_MUTED_CLASS,
  FLOW_CLASS,
  FLOW_COMPACT_META_CLASS,
  FLOW_COMPACT_ROW_CLASS,
  FLOW_EDGES_CLASS,
  FLOW_EDGE_PATH_CLASS,
  FLOW_GRAPH_CANVAS_CLASS,
  FLOW_META_CLASS,
  FLOW_META_LABEL_CLASS,
  FLOW_META_ROW_CLASS,
  FLOW_NODE_BADGES_CLASS,
  FLOW_NODE_POSITION_CLASS,
  FLOW_NODE_SHELL_CLASS,
  FLOW_NODE_SUMMARY_CLASS,
  FLOW_ROOT_POSITION_CLASS,
  FLOW_ROUTE_COUNT_CLASS,
  FLOW_RULE_CONDITION_CONTROLS_CLASS,
  FLOW_RULE_CONDITION_INPUT_CLASS,
  FLOW_RULE_DELETE_CLASS,
  FLOW_RULE_EDITOR_CLASS,
  FLOW_RULE_EMPTY_CLASS,
  FLOW_RULE_FIELD_CLASS,
  FLOW_RULE_FIELD_CONDITION_CLASS,
  FLOW_RULE_FIELD_LABEL_CLASS,
  FLOW_RULE_FIELD_PRIORITY_CLASS,
  FLOW_RULE_FIELD_TARGET_CLASS,
  FLOW_RULE_HEAD_CLASS,
  FLOW_RULE_ITEM_CLASS,
  FLOW_RULE_LABEL_INPUT_CLASS,
  FLOW_RULE_LIST_CLASS,
  FLOW_RULE_PRIORITY_CLASS,
  FLOW_RULE_TARGET_CLASS,
  FLOW_ZOOM_SHELL_CLASS,
  FLOW_ZOOM_STEP_BUTTON_CLASS,
  FLOW_ZOOM_TOOLBAR_CLASS,
  FLOW_ZOOM_VALUE_CLASS,
  flowZoomPresetButtonClass,
  INLINE_ADD_CLASS,
  INLINE_ADD_SETTLED_CLASS,
  INLINE_REMOVE_CLASS,
  NODE_DELETE_CONFIRM_CLASS,
  PILL_OUTLINE_BUTTON_CLASS,
  NODE_INSERT_BUTTON_CLASS,
  NODE_INSERT_ROW_CLASS,
  NODE_INSERT_ROW_EDGE_CLASS,
  RETRY_POLICY_EDITOR_CLASS,
  RETRY_POLICY_FIELD_CLASS,
  PRIMARY_BUTTON_CLASS,
  RETURN_BUTTON_CLASS,
  REWRITE_MODEL_BUTTON_CLASS,
  SAVE_REVIEW_ACTION_DIFF_CLASS,
  SAVE_REVIEW_ACTION_DIFF_NEW_CLASS,
  SAVE_REVIEW_ACTION_DIFF_OLD_CLASS,
  SAVE_REVIEW_DIFF_CLASS,
  SAVE_REVIEW_DIFF_PATH_CLASS,
  SAVE_REVIEW_DIFF_ROW_CLASS,
  SAVE_REVIEW_DIFF_SIGN_CLASS,
  SAVE_REVIEW_DIFF_SIGN_NEW_CLASS,
  SAVE_REVIEW_DIFF_SIGN_OLD_CLASS,
  SAVE_REVIEW_FORM_CLASS,
  SAVE_REVIEW_FORM_LABEL_CLASS,
  SECTION_CARD_TITLE_CLASS,
  SELECTION_MARK_CLASS,
  SOURCE_ACTION_ADD_CLASS,
  SOURCE_ACTION_EDIT_BUTTON_CLASS,
  SOURCE_ACTION_EDITOR_CLASS,
  SOURCE_ACTION_LIST_CLASS,
  SOURCE_ACTION_LIST_EDITABLE_CLASS,
  SOURCE_ACTION_PICKER_CLASS,
  SOURCE_ACTION_REMOVE_CLASS,
  SOURCE_ACTION_SELECT_CLASS,
  SOURCE_ACTION_TOKEN_CLASS,
  SOURCE_EMPTY_STATE_CLASS,
  SOURCE_EMPTY_TEXT_CLASS,
  SOURCE_CARD_CLASS,
  SOURCE_COLLAPSIBLE_EDITOR_CLASS,
  SOURCE_COLLAPSIBLE_HEAD_CLASS,
  SOURCE_COLLAPSIBLE_PREVIEW_CLASS,
  SOURCE_COLLAPSIBLE_PREVIEW_MUTED_CLASS,
  SOURCE_COLLAPSIBLE_TOGGLE_CLASS,
  SOURCE_EDIT_FIELD_CLASS,
  SOURCE_EDIT_HINT_CLASS,
  SOURCE_EDIT_INPUT_CLASS,
  SOURCE_GROUP_TITLE_CLASS,
  SOURCE_INPUT_CLASS,
  SOURCE_JSON_INLINE_CLASS,
  SOURCE_KEY_CLASS,
  SOURCE_LINE_CLASS,
  SOURCE_MD_CLASS,
  SOURCE_META_LIST_CLASS,
  SOURCE_READONLY_VALUE_CLASS,
  SOURCE_RENDERED_CLASS,
  SOURCE_SELECT_CLASS,
  SOURCE_STEP_BLOCK_CLASS,
  SOURCE_STEP_HEADER_CLASS,
  SOURCE_STEP_TITLE_EDIT_CLASS,
  SOURCE_STEPS_CLASS,
  SOURCE_TITLE_INPUT_CLASS,
  SOURCE_TOOLBAR_CLASS,
  SOURCE_VALUE_CLASS,
  TOOL_ACTION_BUTTON_CLASS,
  TOOL_ACTION_CONFIRM_CLASS,
  TOOL_ACTION_GROUP_CLASS,
  TOOL_ACTION_GROUP_DETAIL_CLASS,
  TOOL_ACTION_REJECT_CLASS,
  TOOL_METHOD_CLASS,
  TOOL_SUGGESTION_ACTIONS_CLASS,
  TOOL_SUGGESTION_CLASS,
  TOOL_SUGGESTION_DESC_CLASS,
  TOOL_SUGGESTION_DETAIL_CLASS,
  TOOL_SUGGESTION_DETAIL_FOOTER_CLASS,
  TOOL_SUGGESTION_DETAIL_PRE_CLASS,
  TOOL_SUGGESTION_HEAD_CLASS,
  TOOL_SUGGESTION_MAIN_CLASS,
  TOOL_SUGGESTION_META_CLASS,
  TOOL_SUGGESTION_TITLE_CLASS,
  TOOL_SUGGESTIONS_CLASS,
  UPLOAD_LIST_CLASS,
  UPLOAD_NAME_CLASS,
  UPLOAD_STATUS_CLASS,
  WORKBENCH_CLASS,
  actionChipClass,
  chatBubbleClass,
  chatRowClass,
  distillFlowNodeClass,
  distillSourceSectionClass,
  flowEdgeLabelClass,
  toolStatusBadgeClass,
  uploadItemClass,
  type ToolStatusBadgeVariant,
} from '@/pages/distillPageStyles';
import { api, ApiError, streamGet, streamPost, TENANT_ID } from '@/api/client';
import type { ModelConfigRead, SkillCard, SkillRead, ToolProbeResponse, ToolRead, ToolSuggestion } from '@/types';

import { ActiveDistillJob, BASE_ACTION_OPTIONS, CONDITION_PRESET_OPTIONS, CONDITION_PRESET_TEXT, ChatAttachment, ChatItem, DEFAULT_DISTILL_MESSAGES, DEFAULT_TARGET_PATHS, DISTILL_REWRITE_MODEL_STORAGE_KEY, DistillCacheSnapshot, DistillHistoryOperation, DistillHistoryOperationKind, DistillHistorySnapshot, DistillPageProps, ENTERPRISE_AGENT_STORAGE_KEY, EditingMessage, NODE_TYPE_OPTIONS, PendingChange, ProbeToolOptions, RETRY_STRATEGY_OPTIONS, SelectOption, TargetSelection, TextDiffAnimation, TextDiffPhase, ToolActionStatus, ToolDescriptionMap, ToolStatusMap, ToolSuggestionItem, UploadAttachment, ViewMode } from './types';

export function lockSkillIdForDraft(draft: SkillCard, lockedSkillId: string): SkillCard {
  if (!lockedSkillId || draft.skill_id === lockedSkillId) return draft;
  return { ...cloneSkill(draft), skill_id: lockedSkillId };
}

export function lockNullableSkillIdForDraft(draft: SkillCard | null, lockedSkillId: string): SkillCard | null {
  return draft ? lockSkillIdForDraft(draft, lockedSkillId) : null;
}

export function lockPendingChangeSkillId(change: PendingChange | null, lockedSkillId: string): PendingChange | null {
  if (!change || !lockedSkillId) return change;
  return {
    ...change,
    previousDraft: lockSkillIdForDraft(change.previousDraft, lockedSkillId),
    nextDraft: lockSkillIdForDraft(change.nextDraft, lockedSkillId),
  };
}


export function DistillSectionCard({
  className,
  bodyClassName,
  title,
  extra,
  children,
  ...rest
}: {
  className?: string;
  bodyClassName?: string;
  title?: ReactNode;
  extra?: ReactNode;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'title'>) {
  return (
    <section className={cn(DISTILL_CARD_CLASS, 'h-full min-h-0', className)} {...rest}>
      {(title || extra) && (
        <div className={DISTILL_CARD_HEADER_CLASS}>
          <div className={cn('min-w-0', SECTION_CARD_TITLE_CLASS)}>{title}</div>
          {extra ? <div className="shrink-0">{extra}</div> : null}
        </div>
      )}
      <div className={cn(DISTILL_CARD_BODY_CLASS, bodyClassName)}>{children}</div>
    </section>
  );
}

export function KDialog({
  open,
  onOpenChange,
  title,
  width = 520,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  width?: number;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] gap-0 overflow-y-auto rounded-[16px] p-0"
        style={{ width: `min(${width}px, calc(100vw - 32px))`, maxWidth: 'calc(100vw - 32px)' }}
      >
        {title != null && (
          <DialogTitle className="border-b border-border px-[24px] py-[16px] text-[16px] font-semibold text-foreground">
            {title}
          </DialogTitle>
        )}
        <div className="px-[24px] py-[20px]">{children}</div>
        {footer != null && (
          <DialogFooter>{footer}</DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SimpleTooltip({ title, children }: { title?: ReactNode; children: ReactNode }) {
  if (!title) return <>{children}</>;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function EmptyState({ description }: { description: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-[8px] py-[32px] text-center text-[13px] text-[#858b9c]">
      {description}
    </div>
  );
}

export function DistillTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[6px] bg-[#f2f3f5] px-[8px] py-px text-[12px] font-medium leading-[18px] text-[#5b6273]">
      {children}
    </span>
  );
}

/**
 * Inline text input for the SOP source editor.
 */
export function SourceInput({
  className,
  ...rest
}: {
  className?: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  style?: CSSProperties;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}) {
  return <Input className={cn(SOURCE_INPUT_CLASS, className)} {...rest} />;
}

/** Auto-growing textarea replacement for Ant Design's `Input.TextArea autoSize`. */
export function AutoGrowTextarea({
  className,
  minRows = 1,
  value,
  ...rest
}: {
  className?: string;
  minRows?: number;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  style?: CSSProperties;
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <Textarea
      ref={ref}
      rows={minRows}
      value={value}
      className={cn(SOURCE_INPUT_CLASS, className)}
      {...rest}
    />
  );
}

/** Native number input replacement for Ant Design's `InputNumber`. */
export function SourceNumberInput({
  className,
  value,
  min,
  placeholder,
  onChange,
}: {
  className?: string;
  value: number | null;
  min?: number;
  placeholder?: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <Input
      type="number"
      className={cn(SOURCE_INPUT_CLASS, className)}
      value={value ?? ''}
      min={min}
      placeholder={placeholder}
      onChange={(event) => {
        const raw = event.target.value;
        onChange(raw === '' ? null : Number(raw));
      }}
    />
  );
}

/**
 * Searchable action picker (replaces Ant Design's `Select showSearch`). Renders
 * a filterable input backed by a popover list. Committing an empty value removes
 * the action, matching the previous `allowClear` behaviour.
 */
export function ActionCombobox({
  value,
  options,
  placeholder = '选择一个动作',
  onSelect,
}: {
  value?: string;
  options: SelectOption[];
  placeholder?: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(normalizedQuery) ||
          String(option.value).toLowerCase().includes(normalizedQuery),
      )
    : options;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onSelect(value || '');
      }}
    >
      <PopoverTrigger asChild>
        <input
          className={SOURCE_ACTION_SELECT_CLASS}
          autoFocus
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (filtered.length > 0) onSelect(String(filtered[0].value));
            } else if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="max-h-[280px] w-[320px] overflow-y-auto p-[4px]"
      >
        {filtered.length === 0 ? (
          <div className="px-[10px] py-[12px] text-center text-[13px] text-[#858b9c]">无匹配动作</div>
        ) : (
          filtered.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              className={cn(
                'flex w-full items-center rounded-[8px] px-[10px] py-[6px] text-left text-[13px] text-foreground hover:bg-muted',
                option.value === value && 'bg-muted',
              )}
              onClick={() => onSelect(String(option.value))}
            >
              {option.label}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

/** shadcn Select styled for the SOP source editor. */
export function SourceSelect({
  className,
  value,
  options,
  placeholder,
  onChange,
}: {
  className?: string;
  value?: string;
  options: SelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <UISelect value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={String(option.value)} value={String(option.value)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </UISelect>
  );
}

export function SkillSource({
  skill,
  selectedPaths,
  highlightedPaths,
  updatingPaths,
  dirtyPaths,
  textDiffs,
  toolDescriptions,
  toolStatuses,
  containerRef,
  lockSkillId,
  onToggle,
  onEdit,
}: {
  skill: SkillCard;
  selectedPaths: string[];
  highlightedPaths: string[];
  updatingPaths: string[];
  dirtyPaths: string[];
  textDiffs: TextDiffAnimation[];
  toolDescriptions: ToolDescriptionMap;
  toolStatuses: ToolStatusMap;
  containerRef: RefObject<HTMLDivElement>;
  lockSkillId?: boolean;
  onToggle: (target: TargetSelection) => void;
  onEdit: (nextDraft: SkillCard, path: string) => void;
}) {
  const [deleteNodeIndex, setDeleteNodeIndex] = useState<number | null>(null);

  function editBasic(field: keyof SkillCard, value: string | string[]) {
    if (field === 'skill_id' && lockSkillId) return;
    const next = cloneSkill(skill);
    if (field === 'trigger_intents' || field === 'user_utterance_examples' || field === 'goal' || field === 'required_info' || field === 'response_rules') {
      next[field] = Array.isArray(value) ? value : splitEditableList(value);
    } else if (field === 'skill_id' || field === 'name' || field === 'version' || field === 'business_domain' || field === 'description') {
      next[field] = String(value);
    }
    onEdit(next, 'basic');
  }

  function editStep(index: number, field: string, value: string | string[] | boolean | Record<string, unknown>) {
    const next = cloneSkill(skill);
    const listValue = field === 'expected_user_info' || field === 'allowed_actions'
      ? Array.isArray(value)
        ? value
        : splitEditableList(String(value))
      : value;
    next.nodes = Array.isArray(next.nodes) ? [...next.nodes] : [];
    const currentNode = { ...(next.nodes[index] || {}) };
    const nodeField = field === 'step_id' ? 'node_id' : field;
    if (nodeField === 'node_id') {
      const previousId = String(currentNode.node_id || currentNode.step_id || `node_${index + 1}`);
      const nextId = String(listValue || '').trim();
      if (!nextId) {
        notify.warning('节点 ID 不能为空');
        return;
      }
      const duplicated = next.nodes.some((node, nodeIndex) => (
        nodeIndex !== index && String(node?.node_id || node?.step_id || '') === nextId
      ));
      if (duplicated) {
        notify.warning(`节点 ID「${nextId}」已经存在`);
        return;
      }
      currentNode.node_id = nextId;
      next.edges = normalizeSkillEdges(next).map((edge) => ({
        ...edge,
        source_node_id: String(edge.source_node_id || '') === previousId ? nextId : edge.source_node_id,
        next_node_id: String(edge.next_node_id || '') === previousId ? nextId : edge.next_node_id,
      }));
      if (next.start_node_id === previousId) next.start_node_id = nextId;
      next.terminal_node_ids = asStringList(next.terminal_node_ids).map((nodeId) => (nodeId === previousId ? nextId : nodeId));
      next.nodes[index] = currentNode;
      onEdit(next, stepTargetPath(index));
      return;
    }
    currentNode[nodeField] = listValue;
    next.nodes[index] = currentNode;
    onEdit(next, stepTargetPath(index));
  }

  function updateEdge(index: number, edgeIndex: number, patch: Record<string, unknown>) {
    const next = cloneSkill(skill);
    const sourceId = nodeIdAt(next, index);
    const edges = normalizeSkillEdges(next);
    const globalIndex = findSourceEdgeIndex(edges, sourceId, edgeIndex);
    if (globalIndex < 0) return;
    edges[globalIndex] = { ...edges[globalIndex], ...patch };
    next.edges = edges;
    onEdit(next, stepTargetPath(index));
  }

  function addEdge(index: number) {
    const next = cloneSkill(skill);
    const sourceId = nodeIdAt(next, index);
    const nodes = normalizeSkillNodes(next);
    const fallbackTarget = nodes.find((node) => String(node.node_id || node.step_id || '') !== sourceId);
    const targetId = String(nodes[index + 1]?.node_id || nodes[index + 1]?.step_id || fallbackTarget?.node_id || fallbackTarget?.step_id || '');
    const sourceEdges = normalizeSkillEdges(next).filter((edge) => String(edge.source_node_id || '') === sourceId);
    const priority = sourceEdges.length > 0
      ? Math.max(...sourceEdges.map((edge, sourceIndex) => edgePriority(edge, sourceIndex))) + 1
      : 1;
    next.edges = [
      ...normalizeSkillEdges(next),
      {
        source_node_id: sourceId,
        next_node_id: targetId,
        condition: '',
        priority,
        label: targetId ? '新增流转' : '',
      },
    ];
    onEdit(next, stepTargetPath(index));
  }

  function deleteEdge(index: number, edgeIndex: number) {
    const next = cloneSkill(skill);
    const sourceId = nodeIdAt(next, index);
    const edges = normalizeSkillEdges(next);
    const globalIndex = findSourceEdgeIndex(edges, sourceId, edgeIndex);
    if (globalIndex < 0) return;
    edges.splice(globalIndex, 1);
    next.edges = edges;
    onEdit(next, stepTargetPath(index));
  }

  function insertNodeBetween(index: number) {
    const next = cloneSkill(skill);
    const nodes = normalizeSkillNodes(next);
    const insertAt = nodes.length === 0 ? 0 : Math.max(0, Math.min(index + 1, nodes.length));
    const sourceNode = insertAt > 0 ? nodes[insertAt - 1] : null;
    const targetNode = insertAt < nodes.length ? nodes[insertAt] : null;
    const sourceId = sourceNode ? String(sourceNode.node_id || sourceNode.step_id || `node_${insertAt}`) : '';
    const targetId = targetNode ? String(targetNode.node_id || targetNode.step_id || `node_${insertAt + 1}`) : '';
    const newNodeId = uniqueNodeId(nodes, `node_${insertAt + 1}`);
    const newNode = {
      node_id: newNodeId,
      type: 'collect_info',
      name: '新增节点',
      instruction: '说明这个节点要完成的目标。',
      optional: false,
      condition: '',
      expected_user_info: [],
      allowed_actions: ['continue_flow'],
      knowledge_scope: {},
      retry_policy: {},
      metadata: {},
    };
    nodes.splice(insertAt, 0, newNode);
    next.nodes = nodes;

    const edges = normalizeSkillEdges(next);
    if (sourceId && targetId) {
      const directEdgeIndexes = edges
        .map((edge, edgeIndex) => ({ edge, edgeIndex }))
        .filter(({ edge }) => String(edge.source_node_id || '') === sourceId && String(edge.next_node_id || '') === targetId)
        .map(({ edgeIndex }) => edgeIndex);
      if (directEdgeIndexes.length > 0) {
        directEdgeIndexes.forEach((edgeIndex) => {
          edges[edgeIndex] = {
            ...edges[edgeIndex],
            next_node_id: newNodeId,
            label: String(edges[edgeIndex].label || '').trim() || '进入新增节点',
          };
        });
        const maxPriority = Math.max(...directEdgeIndexes.map((edgeIndex, localIndex) => edgePriority(edges[edgeIndex], localIndex)));
        edges.push({
          source_node_id: newNodeId,
          next_node_id: targetId,
          condition: '',
          priority: maxPriority + 1,
          label: `继续到 ${String(targetNode?.name || targetId)}`,
        });
      } else {
        const sourcePriority = edges
          .filter((edge) => String(edge.source_node_id || '') === sourceId)
          .reduce((max, edge, sourceIndex) => Math.max(max, edgePriority(edge, sourceIndex)), 0) + 1;
        edges.push({
          source_node_id: sourceId,
          next_node_id: newNodeId,
          condition: '',
          priority: sourcePriority,
          label: '进入新增节点',
        });
        edges.push({
          source_node_id: newNodeId,
          next_node_id: targetId,
          condition: '',
          priority: 1,
          label: `继续到 ${String(targetNode?.name || targetId)}`,
        });
      }
    } else if (!sourceId && targetId) {
      edges.push({
        source_node_id: newNodeId,
        next_node_id: targetId,
        condition: '',
        priority: 1,
        label: `继续到 ${String(targetNode?.name || targetId)}`,
      });
      next.start_node_id = newNodeId;
    } else if (sourceId && !targetId) {
      const sourcePriority = edges
        .filter((edge) => String(edge.source_node_id || '') === sourceId)
        .reduce((max, edge, sourceIndex) => Math.max(max, edgePriority(edge, sourceIndex)), 0) + 1;
      edges.push({
        source_node_id: sourceId,
        next_node_id: newNodeId,
        condition: '',
        priority: sourcePriority,
        label: '进入新增节点',
      });
      const previousTerminalIds = asStringList(next.terminal_node_ids);
      next.terminal_node_ids = previousTerminalIds.length > 0
        ? [...previousTerminalIds.filter((terminalId) => terminalId !== sourceId), newNodeId]
        : [newNodeId];
    } else {
      next.start_node_id = newNodeId;
      next.terminal_node_ids = [newNodeId];
    }
    next.edges = edges;
    if (!next.start_node_id) next.start_node_id = String(nodes[0]?.node_id || '');
    if (asStringList(next.terminal_node_ids).length === 0 && nodes.length > 0) {
      next.terminal_node_ids = [String(nodes[nodes.length - 1].node_id || '')];
    }
    onEdit(next, stepTargetPath(insertAt));
  }

  function confirmDeleteNode(index: number) {
    const nodes = normalizeSkillNodes(skill);
    if (nodes.length <= 1) {
      notify.warning('至少需要保留一个节点');
      return;
    }
    setDeleteNodeIndex(index);
  }

  function runDeleteNode(index: number) {
    const nodes = normalizeSkillNodes(skill);
    const node = nodes[index];
    if (!node) return;
    const nodeId = String(node.node_id || node.step_id || `node_${index + 1}`);
    const next = cloneSkill(skill);
    const nextNodes = normalizeSkillNodes(next).filter((_node, nodeIndex) => nodeIndex !== index);
    next.nodes = nextNodes;
    next.edges = normalizeSkillEdges(next).filter((edge) => (
      String(edge.source_node_id || '') !== nodeId && String(edge.next_node_id || '') !== nodeId
    ));
    if (next.start_node_id === nodeId) next.start_node_id = String(nextNodes[0]?.node_id || '');
    next.terminal_node_ids = asStringList(next.terminal_node_ids).filter((terminalId) => terminalId !== nodeId);
    if (next.terminal_node_ids.length === 0 && nextNodes.length > 0) {
      next.terminal_node_ids = [String(nextNodes[nextNodes.length - 1].node_id || '')];
    }
    onEdit(next, stepTargetPath(Math.min(index, Math.max(nextNodes.length - 1, 0))));
  }

  function renderDeleteNodeConfirm() {
    if (deleteNodeIndex === null) return null;
    const nodes = normalizeSkillNodes(skill);
    const index = deleteNodeIndex;
    const node = nodes[index];
    if (!node) return null;
    const nodeId = String(node.node_id || node.step_id || `node_${index + 1}`);
    const edges = normalizeSkillEdges(skill);
    const incomingEdges = edges.filter((edge) => String(edge.next_node_id || '') === nodeId);
    const outgoingEdges = edges.filter((edge) => String(edge.source_node_id || '') === nodeId);
    const affected = [...incomingEdges, ...outgoingEdges];
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => !open && setDeleteNodeIndex(null)}
        title={`确认删除 Node ${index + 1}：${String(node.name || nodeId)}？`}
        confirmText="确认删除"
        description={
          <div className={NODE_DELETE_CONFIRM_CLASS}>
            <p>删除后会同时移除所有连接到这个节点、或从这个节点发出的流转规则。</p>
            <strong>将受影响的连接</strong>
            <ul>
              {affected.length > 0 ? (
                affected.map((edge, edgeIndex) => (
                  <li key={`${String(edge.source_node_id)}_${String(edge.next_node_id)}_${edgeIndex}`}>
                    {nodeDisplayNameById(nodes, String(edge.source_node_id || ''))}
                    {' -> '}
                    {nodeDisplayNameById(nodes, String(edge.next_node_id || ''))}
                    {String(edge.label || edge.condition || '').trim() ? `：${String(edge.label || edge.condition)}` : ''}
                  </li>
                ))
              ) : (
                <li>无直接连接关系</li>
              )}
            </ul>
          </div>
        }
        onConfirm={() => {
          runDeleteNode(index);
          setDeleteNodeIndex(null);
        }}
      />
    );
  }

  const steps = skillGraphSteps(skill);
  const nodeNameMap = steps.reduce<Record<string, string>>((acc, step, index) => {
    const nodeId = String(step.node_id || step.step_id || `node_${index + 1}`);
    acc[nodeId] = String(step.name || nodeId);
    return acc;
  }, {});
  const edgeMap = skillGraphEdgeMap(skill);
  const terminalNodeIds = new Set(asStringList(skill.terminal_node_ids));
  const startNodeId = String(skill.start_node_id || '');
  const nodeOptions = steps.map((step, index) => {
    const nodeId = String(step.node_id || step.step_id || `node_${index + 1}`);
    return {
      value: nodeId,
      label: `Node ${index + 1} · ${String(step.name || nodeId)}`,
    };
  });
  const actionOptions = buildActionOptions(toolDescriptions, toolStatuses, steps);

  return (
    <div className={SOURCE_MD_CLASS} ref={containerRef}>
      <div className={SOURCE_GROUP_TITLE_CLASS}>基础信息</div>
      <SelectableTarget
        className={distillSourceSectionClass('basic', selectedPaths, highlightedPaths, updatingPaths, dirtyPaths)}
        target={{ path: 'basic', label: '基础信息' }}
        onToggle={onToggle}
      >
        {selectedPaths.includes('basic') && <span className={SELECTION_MARK_CLASS}><CheckOutlined /></span>}
        <div className={SOURCE_RENDERED_CLASS}>
          <EditableSourceHeading value={skill.name} onChange={(value) => editBasic('name', value)} />
          <div className={SOURCE_META_LIST_CLASS}>
            <EditableSourceTextLine
              label={fieldLabel('skill_id')}
              value={skill.skill_id}
              readOnly={lockSkillId}
              onChange={(value) => editBasic('skill_id', value)}
            />
            <EditableSourceTextLine label={fieldLabel('version')} value={skill.version} onChange={(value) => editBasic('version', value)} />
            <EditableSourceTextLine label={fieldLabel('business_domain')} value={skill.business_domain || ''} onChange={(value) => editBasic('business_domain', value)} />
            <EditableSourceTextLine label={fieldLabel('description')} value={skill.description || ''} multiline onChange={(value) => editBasic('description', value)} />
            <EditableSourceListLine label={fieldLabel('trigger_intents')} values={skill.trigger_intents} onChange={(value) => editBasic('trigger_intents', value)} />
            <EditableSourceListLine label={fieldLabel('user_utterance_examples')} values={skill.user_utterance_examples} onChange={(value) => editBasic('user_utterance_examples', value)} />
            <EditableSourceListLine label={fieldLabel('goal')} values={skill.goal} onChange={(value) => editBasic('goal', value)} />
            <EditableSourceListLine label={fieldLabel('required_info')} values={skill.required_info} onChange={(value) => editBasic('required_info', value)} />
            <EditableSourceListLine label={fieldLabel('response_rules')} values={skill.response_rules} onChange={(value) => editBasic('response_rules', value)} />
          </div>
        </div>
      </SelectableTarget>
      <div className={SOURCE_GROUP_TITLE_CLASS}>详细节点</div>
      <div className={SOURCE_STEPS_CLASS}>
        <div className={cn(NODE_INSERT_ROW_CLASS, NODE_INSERT_ROW_EDGE_CLASS)}>
          <UIButton variant="outline" size="sm" className={NODE_INSERT_BUTTON_CLASS} onClick={() => insertNodeBetween(-1)}>
            <PlusOutlined />
            {steps.length > 0 ? '在最前新增节点' : '新增第一个节点'}
          </UIButton>
        </div>
        {steps.map((step, index) => {
          const stepId = String(step.node_id || step.step_id || `node_${index + 1}`);
          const path = stepTargetPath(index);
          const outgoingEdges = edgeMap[stepId] || [];
          const nodeState = [
            stepId === startNodeId ? '起始节点' : '',
            Boolean(step.optional) ? '可选' : '必选',
            terminalNodeIds.has(stepId) ? '终止节点' : '流程节点',
          ].filter(Boolean).join(' · ');
          return (
            <div className={SOURCE_STEP_BLOCK_CLASS} key={path}>
              {index > 0 && (
                <div className={NODE_INSERT_ROW_CLASS}>
                  <UIButton variant="outline" size="sm" className={NODE_INSERT_BUTTON_CLASS} onClick={() => insertNodeBetween(index - 1)}>
                    <PlusOutlined />
                    在 Node {index} 和 Node {index + 1} 之间新增节点
                  </UIButton>
                </div>
              )}
              <SelectableTarget
                className={distillSourceSectionClass(path, selectedPaths, highlightedPaths, updatingPaths, dirtyPaths)}
                target={{ path, label: `节点 ${index + 1}：${step.name || stepId}` }}
                onToggle={onToggle}
              >
                {selectedPaths.includes(path) && <span className={SELECTION_MARK_CLASS}><CheckOutlined /></span>}
                <div className={SOURCE_RENDERED_CLASS}>
                  <div className={SOURCE_STEP_HEADER_CLASS}>
                    <EditableSourceStepHeading
                      index={index}
                      value={String(step.name || '')}
                      fallback={stepId}
                      onChange={(value) => editStep(index, 'name', value)}
                    />
                    <EditableSourceField>
                      <UIButton variant="destructive" size="sm" onClick={() => confirmDeleteNode(index)}>
                        <DeleteOutlined />
                        删除节点
                      </UIButton>
                    </EditableSourceField>
                  </div>
                  <div className={SOURCE_META_LIST_CLASS}>
                    <EditableSourceTextLine label={fieldLabel('step_id')} value={stepId} onChange={(value) => editStep(index, 'step_id', value)} />
                    <EditableSourceSelectLine
                      label={fieldLabel('type')}
                      value={String(step.type || 'collect_info')}
                      options={NODE_TYPE_OPTIONS}
                      onChange={(value) => editStep(index, 'type', value)}
                    />
                    <SourceReadonlyLine label="节点状态" value={nodeState} />
                    <EditableSourceTextLine
                      label={fieldLabel('instruction')}
                      value={String(step.instruction || '')}
                      multiline
                      collapsible
                      onChange={(value) => editStep(index, 'instruction', value)}
                    />
                    <EditableSourceListLine label={fieldLabel('expected_user_info')} values={asStringList(step.expected_user_info)} onChange={(value) => editStep(index, 'expected_user_info', value)} />
                    <EditableSourceActionLine
                      values={asStringList(step.allowed_actions)}
                      options={actionOptions}
                      toolDescriptions={toolDescriptions}
                      toolStatuses={toolStatuses}
                      onChange={(value) => editStep(index, 'allowed_actions', value)}
                    />
                    <EditableFlowRulesLine
                      sourceNodeId={stepId}
                      edges={outgoingEdges}
                      nodes={steps}
                      nodeOptions={nodeOptions}
                      terminal={terminalNodeIds.has(stepId)}
                      onAdd={() => addEdge(index)}
                      onUpdate={(edgeIndex, patch) => updateEdge(index, edgeIndex, patch)}
                      onDelete={(edgeIndex) => deleteEdge(index, edgeIndex)}
                    />
                    <SourceJsonLine label="知识范围" value={step.knowledge_scope} />
                    <EditableRetryPolicyLine
                      value={step.retry_policy}
                      onChange={(value) => editStep(index, 'retry_policy', value)}
                    />
                  </div>
                </div>
              </SelectableTarget>
            </div>
          );
        })}
        {steps.length > 0 && (
          <div className={cn(NODE_INSERT_ROW_CLASS, NODE_INSERT_ROW_EDGE_CLASS)}>
            <UIButton variant="outline" size="sm" className={NODE_INSERT_BUTTON_CLASS} onClick={() => insertNodeBetween(steps.length - 1)}>
              <PlusOutlined />
              在最后新增节点
            </UIButton>
          </div>
        )}
      </div>
      {renderDeleteNodeConfirm()}
    </div>
  );
}

export function SkillFlow({
  skill,
  selectedPaths,
  highlightedPaths,
  updatingPaths,
  dirtyPaths,
  textDiffs,
  toolDescriptions,
  toolStatuses,
  containerRef,
  onToggle,
}: {
  skill: SkillCard;
  selectedPaths: string[];
  highlightedPaths: string[];
  updatingPaths: string[];
  dirtyPaths: string[];
  textDiffs: TextDiffAnimation[];
  toolDescriptions: ToolDescriptionMap;
  toolStatuses: ToolStatusMap;
  containerRef: RefObject<HTMLDivElement>;
  onToggle: (target: TargetSelection) => void;
}) {
  const [flowZoom, setFlowZoom] = useState(0.64);
  const nodes = skillGraphSteps(skill);
  const edgeMap = skillGraphEdgeMap(skill);
  const terminalSet = new Set(asStringList(skill.terminal_node_ids));
  const nodeNameMap = Object.fromEntries(
    nodes.map((node, index) => {
      const nodeId = String(node.node_id || node.step_id || `node_${index + 1}`);
      return [nodeId, String(node.name || nodeId)];
    }),
  );
  const graphKey = `${skill.skill_id || 'skill'}:${skill.version || 'draft'}:${nodes.length}:${skill.start_node_id || ''}`;
  const centeredGraphKey = useRef('');
  const graphLayout = buildSkillFlowCanvasLayout(skill, nodes, nodeNameMap);
  const zoomedWidth = graphLayout.width * flowZoom;
  const zoomedHeight = graphLayout.height * flowZoom;
  const updateZoom = (nextZoom: number) => {
    const next = Math.min(1.18, Math.max(0.54, Math.round(nextZoom * 100) / 100));
    const container = containerRef.current;
    if (!container) {
      setFlowZoom(next);
      return;
    }
    const centerX = (container.scrollLeft + container.clientWidth / 2) / flowZoom;
    const centerY = (container.scrollTop + container.clientHeight / 2) / flowZoom;
    setFlowZoom(next);
    window.requestAnimationFrame(() => {
      container.scrollLeft = Math.max(0, centerX * next - container.clientWidth / 2);
      container.scrollTop = Math.max(0, centerY * next - container.clientHeight / 2);
    });
  };
  useEffect(() => {
    const container = containerRef.current;
    if (!container || centeredGraphKey.current === graphKey) return undefined;
    centeredGraphKey.current = graphKey;
    const frame = window.requestAnimationFrame(() => {
      const rootCenterX = (graphLayout.root.x + graphLayout.root.width / 2) * flowZoom;
      const targetScrollLeft = Math.max(0, rootCenterX - container.clientWidth / 2);
      container.scrollLeft = targetScrollLeft;
      container.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [containerRef, flowZoom, graphKey, graphLayout.root.x, graphLayout.root.width]);
  const isFitZoom = Math.abs(flowZoom - 0.64) < 0.001;
  const isFullZoom = Math.abs(flowZoom - 1) < 0.001;
  return (
    <>
      <div className={FLOW_ZOOM_TOOLBAR_CLASS} aria-label="流程图缩放">
        <span className="shrink-0">缩放</span>
        <UIButton variant="outline" size="sm" className={FLOW_ZOOM_STEP_BUTTON_CLASS} onClick={() => updateZoom(flowZoom - 0.08)} aria-label="缩小">
          -
        </UIButton>
        <span className={FLOW_ZOOM_VALUE_CLASS}>{Math.round(flowZoom * 100)}%</span>
        <UIButton variant="outline" size="sm" className={FLOW_ZOOM_STEP_BUTTON_CLASS} onClick={() => updateZoom(flowZoom + 0.08)} aria-label="放大">
          +
        </UIButton>
        <UIButton
          variant="outline"
          size="sm"
          className={flowZoomPresetButtonClass(isFitZoom)}
          aria-pressed={isFitZoom}
          onClick={() => updateZoom(0.64)}
        >
          适配
        </UIButton>
        <UIButton
          variant="outline"
          size="sm"
          className={flowZoomPresetButtonClass(isFullZoom)}
          aria-pressed={isFullZoom}
          onClick={() => updateZoom(1)}
        >
          100%
        </UIButton>
      </div>
      <div className={FLOW_CLASS} ref={containerRef}>
        <div
          className={FLOW_ZOOM_SHELL_CLASS}
          style={{ width: zoomedWidth, height: zoomedHeight }}
        >
          <div
            className={FLOW_GRAPH_CANVAS_CLASS}
            style={{
              width: graphLayout.width,
              height: graphLayout.height,
              transform: `scale(${flowZoom})`,
            }}
          >
            <svg
              className={FLOW_EDGES_CLASS}
              width={graphLayout.width}
              height={graphLayout.height}
              viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`}
              aria-hidden="true"
            >
              <defs>
                <marker id="skill-flow-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" />
                </marker>
              </defs>
              {graphLayout.edges.map((edge) => (
                <path
                  className={FLOW_EDGE_PATH_CLASS}
                  d={edge.path}
                  key={edge.id}
                  markerEnd="url(#skill-flow-arrow)"
                  strokeDasharray="6 14"
                >
                  <title>{edge.title}</title>
                </path>
              ))}
            </svg>
            {graphLayout.edges.map((edge) => (
              <span
                className={flowEdgeLabelClass(edge.labelTone || edge.kind)}
                key={`${edge.id}_label`}
                style={{ left: edge.labelX, top: edge.labelY }}
                title={edge.title}
              >
                {edge.label}
              </span>
            ))}
            <div
              className={FLOW_ROOT_POSITION_CLASS}
              style={{ left: graphLayout.root.x, top: graphLayout.root.y, width: graphLayout.root.width, height: graphLayout.root.height }}
            >
              <SelectableTarget
                className={distillFlowNodeClass('basic', true, selectedPaths, highlightedPaths, updatingPaths, dirtyPaths)}
                target={{ path: 'basic', label: '基础信息' }}
                onToggle={onToggle}
              >
                {selectedPaths.includes('basic') && <span className={SELECTION_MARK_CLASS}><CheckOutlined /></span>}
                <span>基础信息</span>
                <strong><InlineDiffText path="basic" field="name" value={skill.name} diffs={textDiffs} /></strong>
                <small>{skill.skill_id}</small>
                <p><InlineDiffText path="basic" field="description" value={skill.description || '暂无描述'} diffs={textDiffs} /></p>
                <div className={FLOW_META_CLASS}>
                  <FlowMetaRow label="业务域">
                    <span className={FLOW_CHIP_CLASS}>{skill.business_domain || '-'}</span>
                  </FlowMetaRow>
                  <FlowMetaRow label="必填信息">
                    <PlainChipList values={skill.required_info} />
                  </FlowMetaRow>
                  <FlowMetaRow label="触发意图">
                    <PlainChipList values={skill.trigger_intents} />
                  </FlowMetaRow>
                </div>
              </SelectableTarget>
            </div>
            {graphLayout.nodes.map((item) => (
              <div
                className={FLOW_NODE_POSITION_CLASS}
                key={item.nodeId}
                style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
              >
                <SkillFlowNodeCard
                  index={item.index}
                  step={item.step}
                  terminal={terminalSet.has(item.nodeId)}
                  outgoingEdges={edgeMap[item.nodeId] || []}
                  selectedPaths={selectedPaths}
                  highlightedPaths={highlightedPaths}
                  updatingPaths={updatingPaths}
                  dirtyPaths={dirtyPaths}
                  textDiffs={textDiffs}
                  toolDescriptions={toolDescriptions}
                  toolStatuses={toolStatuses}
                  onToggle={onToggle}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function SkillFlowNodeCard({
  index,
  step,
  terminal,
  outgoingEdges,
  selectedPaths,
  highlightedPaths,
  updatingPaths,
  dirtyPaths,
  textDiffs,
  toolDescriptions,
  toolStatuses,
  onToggle,
}: {
  index: number;
  step: Record<string, unknown>;
  terminal: boolean;
  outgoingEdges: Array<Record<string, unknown>>;
  selectedPaths: string[];
  highlightedPaths: string[];
  updatingPaths: string[];
  dirtyPaths: string[];
  textDiffs: TextDiffAnimation[];
  toolDescriptions: ToolDescriptionMap;
  toolStatuses: ToolStatusMap;
  onToggle: (target: TargetSelection) => void;
}) {
  const nodeId = String(step.node_id || step.step_id || `node_${index + 1}`);
  const path = stepTargetPath(index);
  const expectedInfo = asStringList(step.expected_user_info);
  const actionList = asStringList(step.allowed_actions);
  const instruction = String(step.instruction || '暂无说明');
  return (
    <div className={FLOW_NODE_SHELL_CLASS}>
      <SelectableTarget
        className={distillFlowNodeClass(path, false, selectedPaths, highlightedPaths, updatingPaths, dirtyPaths)}
        target={{ path, label: `节点 ${index + 1}：${step.name || nodeId}` }}
        onToggle={onToggle}
      >
        {selectedPaths.includes(path) && <span className={SELECTION_MARK_CLASS}><CheckOutlined /></span>}
        <span>节点 {index + 1}</span>
        <strong><InlineDiffText path={path} field="name" value={String(step.name || nodeId)} diffs={textDiffs} /></strong>
        <small>{nodeId}</small>
        <div className={FLOW_NODE_BADGES_CLASS}>
          <span className={FLOW_CHIP_CLASS}>{nodeTypeLabel(String(step.type || 'collect_info'))}</span>
          {Boolean(step.optional) && <span className={FLOW_CHIP_CLASS}>可选</span>}
          {terminal && <span className={FLOW_CHIP_CLASS}>终止</span>}
        </div>
        <p className={FLOW_NODE_SUMMARY_CLASS} title={instruction}>
          <InlineDiffText path={path} field="instruction" value={instruction} diffs={textDiffs} />
        </p>
        <div className={FLOW_COMPACT_META_CLASS}>
          {expectedInfo.length > 0 && (
            <div className={FLOW_COMPACT_ROW_CLASS}>
              <span>字段</span>
              <PlainChipList values={expectedInfo.slice(0, 4)} />
            </div>
          )}
          {actionList.length > 0 && (
            <div className={FLOW_COMPACT_ROW_CLASS}>
              <span>动作</span>
              <ActionList actions={actionList.slice(0, 4)} toolDescriptions={toolDescriptions} toolStatuses={toolStatuses} />
            </div>
          )}
          {outgoingEdges.length > 0 && <span className={FLOW_ROUTE_COUNT_CLASS}>{outgoingRouteCountLabel(outgoingEdges)}</span>}
        </div>
      </SelectableTarget>
    </div>
  );
}

export function FlowMetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={FLOW_META_ROW_CLASS}>
      <span className={FLOW_META_LABEL_CLASS}>{label}</span>
      {children}
    </div>
  );
}

export function PlainChipList({ values }: { values: unknown }) {
  const items = asStringList(values);
  if (items.length === 0) return <span className={cn(FLOW_CHIP_CLASS, FLOW_CHIP_MUTED_CLASS)}>-</span>;
  return (
    <div className={FLOW_CHIP_LIST_CLASS}>
      {items.map((item, index) => (
        <span className={FLOW_CHIP_CLASS} key={`${item}_${index}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

export function skillGraphSteps(skill: SkillCard): Array<Record<string, unknown>> {
  if (Array.isArray(skill.nodes) && skill.nodes.length > 0) {
    return skill.nodes.map((node, index) => ({
      step_id: node.node_id || `node_${index + 1}`,
      node_id: node.node_id || `node_${index + 1}`,
      type: node.type || 'collect_info',
      name: node.name || node.node_id || `节点 ${index + 1}`,
      instruction: node.instruction || '',
      optional: Boolean(node.optional),
      condition: node.condition || '',
      expected_user_info: asStringList(node.expected_user_info),
      allowed_actions: asStringList(node.allowed_actions),
      knowledge_scope: isRecord(node.knowledge_scope) ? node.knowledge_scope : {},
      retry_policy: isRecord(node.retry_policy) ? node.retry_policy : {},
      metadata: isRecord(node.metadata) ? node.metadata : {},
    }));
  }
  return [];
}

export function skillGraphEdgeMap(skill: SkillCard): Record<string, Array<Record<string, unknown>>> {
  const map: Record<string, Array<Record<string, unknown>>> = {};
  (Array.isArray(skill.edges) ? skill.edges : []).forEach((edge) => {
    const source = String(edge.source_node_id || '');
    if (!source) return;
    if (!map[source]) map[source] = [];
    map[source].push(edge);
  });
  return map;
}

export function normalizeSkillNodes(skill: SkillCard): Array<Record<string, unknown>> {
  return Array.isArray(skill.nodes) ? skill.nodes.filter(isRecord).map((node, index) => ({
    ...node,
    node_id: String(node.node_id || node.step_id || `node_${index + 1}`),
  })) : [];
}

export function normalizeSkillEdges(skill: SkillCard): Array<Record<string, unknown>> {
  return Array.isArray(skill.edges) ? skill.edges.filter(isRecord).map((edge, index) => ({
    source_node_id: String(edge.source_node_id || ''),
    next_node_id: String(edge.next_node_id || ''),
    condition: typeof edge.condition === 'string' ? edge.condition : '',
    priority: Number.isFinite(Number(edge.priority)) ? Number(edge.priority) : index,
    label: typeof edge.label === 'string' ? edge.label : '',
  })) : [];
}

export function nodeIdAt(skill: SkillCard, index: number): string {
  const node = normalizeSkillNodes(skill)[index];
  return String(node?.node_id || node?.step_id || `node_${index + 1}`);
}

export function findSourceEdgeIndex(edges: Array<Record<string, unknown>>, sourceId: string, localIndex: number): number {
  let seen = -1;
  return edges.findIndex((edge) => {
    if (String(edge.source_node_id || '') !== sourceId) return false;
    seen += 1;
    return seen === localIndex;
  });
}

export function edgePriority(edge: Record<string, unknown>, fallback = 0): number {
  const value = Number(edge.priority);
  return Number.isFinite(value) ? value : fallback;
}

export function uniqueNodeId(nodes: Array<Record<string, unknown>>, preferred: string): string {
  const used = new Set(nodes.map((node) => String(node.node_id || node.step_id || '')).filter(Boolean));
  const base = preferred.replace(/\s+/g, '_').replace(/[^\w.-]/g, '') || 'node';
  if (!used.has(base)) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}_${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}_${Date.now()}`;
}

export function nodeDisplayNameById(nodes: Array<Record<string, unknown>>, nodeId: string): string {
  const index = nodes.findIndex((node) => String(node.node_id || node.step_id || '') === nodeId);
  if (index < 0) return nodeId || '未指定节点';
  const node = nodes[index];
  return `Node ${index + 1} · ${String(node.name || nodeId)}`;
}

export type SkillFlowCanvasNode = {
  nodeId: string;
  step: Record<string, unknown>;
  index: number;
  rank: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SkillFlowCanvasEdge = {
  id: string;
  kind: 'root' | 'edge';
  labelTone?: 'root' | 'branch' | 'parallel' | 'return';
  label: string;
  title: string;
  path: string;
  labelX: number;
  labelY: number;
};

export function buildSkillFlowCanvasLayout(
  skill: SkillCard,
  nodes: Array<Record<string, unknown>>,
  nodeNameMap: Record<string, string>,
) {
  const layerLayout = buildSkillFlowLayout(skill, nodes);
  const cardWidth = 360;
  const cardHeight = 324;
  const rootWidth = 500;
  const rootHeight = 270;
  const columnGap = 188;
  const rowGap = 236;
  const rootGap = 126;
  const paddingX = 144;
  const paddingY = 66;
  const layerWidths = layerLayout.layers.map((layer) => (
    layer.length * cardWidth + Math.max(0, layer.length - 1) * columnGap
  ));
  const maxContentWidth = Math.max(rootWidth, ...layerWidths, 0);
  const width = Math.max(1180, paddingX * 2 + maxContentWidth);
  const root = {
    x: (width - rootWidth) / 2,
    y: paddingY,
    width: rootWidth,
    height: rootHeight,
  };
  const positionedNodes: SkillFlowCanvasNode[] = [];
  const positionMap = new Map<string, SkillFlowCanvasNode>();

  layerLayout.layers.forEach((layer, layerIndex) => {
    const layerWidth = layer.length * cardWidth + Math.max(0, layer.length - 1) * columnGap;
    const layerStartX = Math.max(paddingX, (width - layerWidth) / 2);
    layer.forEach((item, itemIndex) => {
      const positioned = {
        ...item,
        rank: layerIndex,
        x: layerStartX + itemIndex * (cardWidth + columnGap),
        y: paddingY + rootHeight + rootGap + layerIndex * (cardHeight + rowGap),
        width: cardWidth,
        height: cardHeight,
      };
      positionedNodes.push(positioned);
      positionMap.set(item.nodeId, positioned);
    });
  });

  const rawEdges = Array.isArray(skill.edges) ? skill.edges : [];
  const edgeSiblingCounts = rawEdges.reduce<Record<string, number>>((acc, edge) => {
    const sourceId = String(edge.source_node_id || '');
    if (sourceId) acc[sourceId] = (acc[sourceId] || 0) + 1;
    return acc;
  }, {});
  const sourceEdgeLabelCounts = rawEdges.reduce<Record<string, Record<string, number>>>((acc, edge) => {
    const sourceId = String(edge.source_node_id || '').trim();
    if (!sourceId) return acc;
    const label = normalizedEdgeLabel(edge, nodeNameMap);
    if (!acc[sourceId]) acc[sourceId] = {};
    acc[sourceId][label] = (acc[sourceId][label] || 0) + 1;
    return acc;
  }, {});
  const incomingCounts = rawEdges.reduce<Record<string, number>>((acc, edge) => {
    const targetId = String(edge.next_node_id || '');
    if (targetId) acc[targetId] = (acc[targetId] || 0) + 1;
    return acc;
  }, {});
  const edgeSiblingIndexes: Record<string, number> = {};
  const incomingIndexes: Record<string, number> = {};
  const layoutEdges: SkillFlowCanvasEdge[] = [];
  const height = paddingY * 2 + rootHeight + rootGap + layerLayout.layers.length * cardHeight + Math.max(0, layerLayout.layers.length - 1) * rowGap;
  const startNode = positionMap.get(String(skill.start_node_id || positionedNodes[0]?.nodeId || ''));
  if (startNode) {
    const sourceX = root.x + root.width / 2;
    const sourceY = root.y + root.height + 8;
    const targetX = startNode.x + startNode.width / 2;
    const targetY = startNode.y - 8;
    const laneY = edgeLaneY(sourceY, targetY, 0, 1);
    const labelAnchor = avoidFlowLabelOverlap(
      { x: (sourceX + targetX) / 2, y: laneY },
      [...positionedNodes, { ...root, nodeId: '__root__' } as SkillFlowCanvasNode],
      width,
      height,
    );
    layoutEdges.push({
      id: `root_${startNode.nodeId}`,
      kind: 'root',
      labelTone: 'root',
      label: '开始',
      title: `开始 -> ${nodeNameMap[startNode.nodeId] || startNode.nodeId}`,
      path: forwardFlowPath(sourceX, sourceY, targetX, targetY, laneY),
      labelX: labelAnchor.x,
      labelY: labelAnchor.y,
    });
  }
  rawEdges.forEach((edge, index) => {
    const sourceId = String(edge.source_node_id || '');
    const targetId = String(edge.next_node_id || '');
    const source = positionMap.get(sourceId);
    const target = positionMap.get(targetId);
    if (!source || !target) return;
    const siblingCount = edgeSiblingCounts[sourceId] || 1;
    const baseLabel = normalizedEdgeLabel(edge, nodeNameMap);
    const hasDuplicateSourceLabel = (sourceEdgeLabelCounts[sourceId]?.[baseLabel] || 0) > 1;
    const isParallelFlow = hasDuplicateSourceLabel;
    const label = flowEdgeDisplayLabel(edge, nodeNameMap, siblingCount, hasDuplicateSourceLabel);
    const title = incomingEdgeLabel(edge, nodeNameMap);
    const siblingIndex = edgeSiblingIndexes[sourceId] || 0;
    edgeSiblingIndexes[sourceId] = siblingIndex + 1;
    const incomingCount = incomingCounts[targetId] || 1;
    const incomingIndex = incomingIndexes[targetId] || 0;
    incomingIndexes[targetId] = incomingIndex + 1;
    const sourceX = source.x + source.width / 2;
    const sourceY = source.y + source.height + 8;
    const targetX = target.x + target.width / 2;
    const targetY = target.y - 8;
    const isReturn = targetY <= sourceY;
    const laneY = edgeLaneY(sourceY, targetY, siblingIndex, siblingCount);
    const shouldAvoidNodes = !isReturn && forwardRouteHitsNode(source, target, positionedNodes, laneY);
    const path = isReturn
      ? sideReturnFlowPath(source, target, width, siblingIndex)
      : shouldAvoidNodes
        ? sideForwardFlowPath(source, target, positionedNodes, width, siblingIndex, incomingIndex)
        : forwardFlowPath(sourceX, sourceY, targetX, targetY, laneY);
    const labelAnchor = isReturn
      ? returnEdgeLabelPosition(source, target, width, siblingIndex)
      : shouldAvoidNodes
        ? sideForwardEdgeLabelPosition(source, target, positionedNodes, width, siblingIndex, incomingIndex)
        : forwardEdgeLabelPosition(sourceX, targetX, laneY, siblingIndex, siblingCount, incomingIndex, incomingCount);
    const safeLabelAnchor = avoidFlowLabelOverlap(labelAnchor, positionedNodes, width, height);
    layoutEdges.push({
      id: `${sourceId}_${targetId}_${index}`,
      kind: 'edge',
      label: compactEdgeLabel(label),
      title,
      path,
      labelX: safeLabelAnchor.x,
      labelY: safeLabelAnchor.y,
      labelTone: isReturn ? 'return' : (isParallelFlow ? 'parallel' : (siblingCount > 1 ? 'branch' : 'root')),
    });
  });

  return { width, height, root, nodes: positionedNodes, edges: layoutEdges };
}

export function buildSkillFlowLayout(skill: SkillCard, nodes: Array<Record<string, unknown>>) {
  const byId = new Map(nodes.map((node, index) => [
    String(node.node_id || node.step_id || `node_${index + 1}`),
    { node, index },
  ]));
  const edgeMap = skillGraphEdgeMap(skill);
  const startId = String(skill.start_node_id || nodes[0]?.node_id || nodes[0]?.step_id || '');
  const start = startId && byId.has(startId)
    ? startId
    : nodes.length > 0
      ? String(nodes[0].node_id || nodes[0].step_id || 'node_1')
      : '';
  const reachable = new Set<string>();
  const queue = start ? [start] : [];
  while (queue.length > 0) {
    const nodeId = queue.shift() || '';
    if (!nodeId || reachable.has(nodeId) || !byId.has(nodeId)) continue;
    reachable.add(nodeId);
    (edgeMap[nodeId] || [])
      .slice()
      .sort((a, b) => {
        const priorityDelta = Number(a.priority || 0) - Number(b.priority || 0);
        if (priorityDelta !== 0) return priorityDelta;
        const aIndex = byId.get(String(a.next_node_id || ''))?.index ?? Number.MAX_SAFE_INTEGER;
        const bIndex = byId.get(String(b.next_node_id || ''))?.index ?? Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
      })
      .forEach((edge) => {
        const nextId = String(edge.next_node_id || '');
        if (nextId && byId.has(nextId) && !reachable.has(nextId)) queue.push(nextId);
      });
  }

  const ranks = new Map<string, number>();
  if (start) ranks.set(start, 0);
  for (let pass = 0; pass < nodes.length + 2; pass += 1) {
    let changed = false;
    (Array.isArray(skill.edges) ? skill.edges : []).forEach((edge) => {
      const sourceId = String(edge.source_node_id || '');
      const targetId = String(edge.next_node_id || '');
      if (!reachable.has(sourceId) || !reachable.has(targetId)) return;
      const sourceMeta = byId.get(sourceId);
      const targetMeta = byId.get(targetId);
      if (!sourceMeta || !targetMeta) return;
      if (targetMeta.index <= sourceMeta.index) return;
      const sourceRank = ranks.get(sourceId);
      if (sourceRank === undefined) return;
      const nextRank = sourceRank + 1;
      if ((ranks.get(targetId) ?? -1) < nextRank) {
        ranks.set(targetId, nextRank);
        changed = true;
      }
    });
    if (!changed) break;
  }

  const layerMap = new Map<number, Array<{ nodeId: string; step: Record<string, unknown>; index: number }>>();
  const orderedReachable = nodes
    .map((node, index) => ({
      nodeId: String(node.node_id || node.step_id || `node_${index + 1}`),
      step: node,
      index,
    }))
    .filter((item) => reachable.has(item.nodeId));
  orderedReachable.forEach((item) => {
    const rank = Math.max(0, Math.min(ranks.get(item.nodeId) ?? item.index, item.index));
    if (!layerMap.has(rank)) layerMap.set(rank, []);
    layerMap.get(rank)?.push(item);
  });

  const layers = Array.from(layerMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, layer]) => layer.sort((a, b) => a.index - b.index));

  const remainder = nodes
    .map((node, index) => ({
      nodeId: String(node.node_id || node.step_id || `node_${index + 1}`),
      step: node,
      index,
    }))
    .filter((item) => !reachable.has(item.nodeId));
  if (remainder.length > 0) layers.push(remainder);
  return { layers };
}

export function edgeLaneY(sourceY: number, targetY: number, siblingIndex: number, siblingCount: number): number {
  const safeTop = sourceY + 58;
  const safeBottom = targetY - 58;
  if (safeBottom <= safeTop) {
    return sourceY + Math.max(72, (targetY - sourceY) * 0.42);
  }
  const laneCount = Math.max(1, siblingCount);
  const maxSpread = Math.min(38, Math.max(24, (safeBottom - safeTop) / Math.max(1, laneCount - 1 || 1)));
  const start = (safeTop + safeBottom) / 2 - ((laneCount - 1) * maxSpread) / 2;
  return Math.max(safeTop, Math.min(safeBottom, start + siblingIndex * maxSpread));
}

export function forwardFlowPath(sourceX: number, sourceY: number, targetX: number, targetY: number, laneY: number): string {
  const safeLaneY = Math.max(sourceY + 48, Math.min(targetY - 48, laneY));
  const verticalEase = Math.min(44, Math.max(22, (targetY - sourceY) * 0.18));
  const horizontalGap = Math.abs(targetX - sourceX);
  if (horizontalGap < 12) {
    return [
      `M ${sourceX} ${sourceY}`,
      `C ${sourceX} ${sourceY + verticalEase}, ${targetX} ${targetY - verticalEase}, ${targetX} ${targetY}`,
    ].join(' ');
  }
  const bend = Math.max(44, Math.min(120, horizontalGap * 0.28));
  return [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX} ${sourceY + verticalEase}, ${sourceX} ${safeLaneY - verticalEase}, ${sourceX} ${safeLaneY}`,
    `C ${sourceX + Math.sign(targetX - sourceX) * bend} ${safeLaneY}, ${targetX - Math.sign(targetX - sourceX) * bend} ${safeLaneY}, ${targetX} ${safeLaneY}`,
    `C ${targetX} ${safeLaneY + verticalEase}, ${targetX} ${targetY - verticalEase}, ${targetX} ${targetY}`,
  ].join(' ');
}

export function rectsOverlap(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export function segmentHitsFlowNode(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  node: SkillFlowCanvasNode,
  margin = 18,
) {
  const segmentRect = {
    left: Math.min(x1, x2) - margin,
    right: Math.max(x1, x2) + margin,
    top: Math.min(y1, y2) - margin,
    bottom: Math.max(y1, y2) + margin,
  };
  const nodeRect = {
    left: node.x,
    right: node.x + node.width,
    top: node.y,
    bottom: node.y + node.height,
  };
  return rectsOverlap(segmentRect, nodeRect);
}

export function forwardRouteHitsNode(
  source: SkillFlowCanvasNode,
  target: SkillFlowCanvasNode,
  nodes: SkillFlowCanvasNode[],
  laneY: number,
) {
  const sourceX = source.x + source.width / 2;
  const sourceY = source.y + source.height + 8;
  const targetX = target.x + target.width / 2;
  const targetY = target.y - 8;
  const safeLaneY = Math.max(sourceY + 48, Math.min(targetY - 48, laneY));
  return nodes.some((node) => {
    if (node.nodeId === source.nodeId || node.nodeId === target.nodeId) return false;
    return segmentHitsFlowNode(sourceX, sourceY, sourceX, safeLaneY, node)
      || segmentHitsFlowNode(sourceX, safeLaneY, targetX, safeLaneY, node)
      || segmentHitsFlowNode(targetX, safeLaneY, targetX, targetY, node);
  });
}

export function sideForwardLaneX(
  source: SkillFlowCanvasNode,
  target: SkillFlowCanvasNode,
  nodes: SkillFlowCanvasNode[],
  canvasWidth: number,
  siblingIndex: number,
  incomingIndex: number,
) {
  const sourceY = source.y + source.height + 8;
  const targetY = target.y - 8;
  const verticalTop = Math.min(sourceY, targetY);
  const verticalBottom = Math.max(sourceY, targetY);
  const relevantNodes = nodes.filter((node) => (
    node.nodeId !== source.nodeId
    && node.nodeId !== target.nodeId
    && node.y < verticalBottom + 80
    && node.y + node.height > verticalTop - 80
  ));
  const laneOffset = 76 + siblingIndex * 28 + incomingIndex * 18;
  const rightBoundary = Math.max(
    source.x + source.width,
    target.x + target.width,
    ...relevantNodes.map((node) => node.x + node.width),
  );
  const leftBoundary = Math.min(
    source.x,
    target.x,
    ...relevantNodes.map((node) => node.x),
  );
  const rightX = Math.min(canvasWidth - 74, rightBoundary + laneOffset);
  const leftX = Math.max(74, leftBoundary - laneOffset);
  const preferRight = target.x >= source.x;
  const candidates = preferRight ? [rightX, leftX] : [leftX, rightX];
  const clear = candidates.find((candidateX) => !relevantNodes.some((node) => (
    segmentHitsFlowNode(candidateX, sourceY + 34, candidateX, targetY - 34, node, 12)
  )));
  return clear ?? candidates[0];
}

export function sideForwardFlowPath(
  source: SkillFlowCanvasNode,
  target: SkillFlowCanvasNode,
  nodes: SkillFlowCanvasNode[],
  canvasWidth: number,
  siblingIndex: number,
  incomingIndex: number,
): string {
  const sourceX = source.x + source.width / 2;
  const sourceY = source.y + source.height + 8;
  const targetX = target.x + target.width / 2;
  const targetY = target.y - 8;
  const sideX = sideForwardLaneX(source, target, nodes, canvasWidth, siblingIndex, incomingIndex);
  const exitY = sourceY + 54 + (siblingIndex % 2) * 18;
  const entryY = targetY - 54 - (incomingIndex % 2) * 18;
  return [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX} ${exitY - 24}, ${sideX} ${exitY - 24}, ${sideX} ${exitY}`,
    `C ${sideX} ${(exitY + entryY) / 2}, ${sideX} ${(exitY + entryY) / 2}, ${sideX} ${entryY}`,
    `C ${sideX} ${entryY + 24}, ${targetX} ${entryY + 24}, ${targetX} ${targetY}`,
  ].join(' ');
}

export function sideForwardEdgeLabelPosition(
  source: SkillFlowCanvasNode,
  target: SkillFlowCanvasNode,
  nodes: SkillFlowCanvasNode[],
  canvasWidth: number,
  siblingIndex: number,
  incomingIndex: number,
) {
  const sourceY = source.y + source.height + 8;
  const targetY = target.y - 8;
  const sideX = sideForwardLaneX(source, target, nodes, canvasWidth, siblingIndex, incomingIndex);
  return {
    x: sideX,
    y: (sourceY + targetY) / 2,
  };
}

export function forwardEdgeLabelPosition(
  sourceX: number,
  targetX: number,
  laneY: number,
  siblingIndex: number,
  siblingCount: number,
  incomingIndex: number,
  incomingCount: number,
) {
  const siblingOffset = siblingCount > 1 ? (siblingIndex - (siblingCount - 1) / 2) * 18 : 0;
  const incomingOffset = incomingCount > 1 ? (incomingIndex - (incomingCount - 1) / 2) * 28 : 0;
  const minX = Math.min(sourceX, targetX);
  const maxX = Math.max(sourceX, targetX);
  const midpoint = (sourceX + targetX) / 2;
  const hasHorizontalRoom = maxX - minX > 220;
  const x = hasHorizontalRoom
    ? Math.max(minX + 98, Math.min(maxX - 98, midpoint + siblingOffset + incomingOffset))
    : targetX + siblingOffset + incomingOffset;
  return { x, y: laneY };
}

export function returnEdgeLabelPosition(
  source: SkillFlowCanvasNode,
  target: SkillFlowCanvasNode,
  canvasWidth: number,
  siblingIndex: number,
) {
  const sideX = Math.min(canvasWidth - 96, Math.max(source.x + source.width + 96 + siblingIndex * 30, target.x + target.width + 96));
  return {
    x: sideX,
    y: Math.max(72, target.y - 84 - siblingIndex * 18),
  };
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function flowLabelOverlapsNode(
  point: { x: number; y: number },
  node: Pick<SkillFlowCanvasNode, 'x' | 'y' | 'width' | 'height'>,
) {
  const labelWidth = 210;
  const labelHeight = 34;
  const margin = 22;
  const left = point.x - labelWidth / 2;
  const right = point.x + labelWidth / 2;
  const top = point.y - labelHeight / 2;
  const bottom = point.y + labelHeight / 2;
  return !(
    right < node.x - margin
    || left > node.x + node.width + margin
    || bottom < node.y - margin
    || top > node.y + node.height + margin
  );
}

export function avoidFlowLabelOverlap(
  anchor: { x: number; y: number },
  nodes: SkillFlowCanvasNode[],
  canvasWidth: number,
  canvasHeight: number,
) {
  const clampPoint = (point: { x: number; y: number }) => ({
    x: clampNumber(point.x, 112, canvasWidth - 112),
    y: clampNumber(point.y, 34, canvasHeight - 34),
  });
  const fits = (point: { x: number; y: number }) => !nodes.some((node) => flowLabelOverlapsNode(point, node));
  const base = clampPoint(anchor);
  if (fits(base)) return base;
  const candidates: Array<{ x: number; y: number }> = [];
  [48, 84, 122, 168, 216].forEach((offset) => {
    candidates.push(
      { x: anchor.x, y: anchor.y - offset },
      { x: anchor.x, y: anchor.y + offset },
      { x: anchor.x - offset * 1.4, y: anchor.y },
      { x: anchor.x + offset * 1.4, y: anchor.y },
      { x: anchor.x - offset, y: anchor.y - offset },
      { x: anchor.x + offset, y: anchor.y - offset },
      { x: anchor.x - offset, y: anchor.y + offset },
      { x: anchor.x + offset, y: anchor.y + offset },
    );
  });
  const found = candidates.map(clampPoint).find(fits);
  return found || clampPoint({ x: anchor.x, y: anchor.y - 76 });
}

export function sideReturnFlowPath(
  source: SkillFlowCanvasNode,
  target: SkillFlowCanvasNode,
  canvasWidth: number,
  siblingIndex: number,
): string {
  const sourceX = source.x + source.width / 2;
  const sourceY = source.y + source.height + 8;
  const targetX = target.x + target.width / 2;
  const targetY = target.y - 8;
  const sideX = Math.min(canvasWidth - 54, Math.max(source.x + source.width + 70 + siblingIndex * 28, target.x + target.width + 70));
  const bottomY = sourceY + 64;
  const topY = Math.max(44, targetY - 64);
  return [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX} ${bottomY}, ${sideX} ${bottomY}, ${sideX} ${bottomY}`,
    `C ${sideX} ${bottomY}, ${sideX} ${topY}, ${sideX} ${topY}`,
    `C ${sideX} ${topY}, ${targetX} ${topY}, ${targetX} ${targetY}`,
  ].join(' ');
}

export function incomingEdgeLabel(edge: Record<string, unknown>, nodeNameMap: Record<string, string> = {}): string {
  const source = String(edge.source_node_id || '');
  const sourceName = source && nodeNameMap[source] ? nodeNameMap[source] : source;
  const targetName = edgeTargetName(edge, nodeNameMap);
  const label = String(edge.label || '');
  const condition = conditionNaturalText(String(edge.condition || ''));
  const route = [sourceName, targetName].filter(Boolean).join(' -> ');
  const detail = label && condition ? `${label}（${condition}）` : label || condition;
  if (route && detail) return `${route}：${detail}`;
  if (route) return route;
  return detail || '流转';
}

export function edgeDisplayLabel(edge: Record<string, unknown>, nodeNameMap: Record<string, string> = {}): string {
  const label = String(edge.label || '').trim();
  if (label) return label;
  const condition = conditionNaturalText(String(edge.condition || '')).trim();
  if (condition) return condition;
  const source = String(edge.source_node_id || '');
  const sourceName = source && nodeNameMap[source] ? nodeNameMap[source] : source;
  return sourceName ? `来自 ${sourceName}` : '流转';
}

export function normalizedEdgeLabel(edge: Record<string, unknown>, nodeNameMap: Record<string, string> = {}): string {
  return edgeDisplayLabel(edge, nodeNameMap).replace(/\s+/g, ' ').trim() || '流转';
}

export function edgeTargetName(edge: Record<string, unknown>, nodeNameMap: Record<string, string> = {}): string {
  const targetId = String(edge.next_node_id || '').trim();
  return targetId ? nodeNameMap[targetId] || targetId : '';
}

export function hasDuplicateSiblingEdgeLabel(
  edge: Record<string, unknown>,
  siblings: Array<Record<string, unknown>>,
  nodeNameMap: Record<string, string> = {},
): boolean {
  if (siblings.length <= 1) return false;
  const sourceId = String(edge.source_node_id || '').trim();
  const label = normalizedEdgeLabel(edge, nodeNameMap);
  return siblings.filter((item) => (
    String(item.source_node_id || '').trim() === sourceId
    && normalizedEdgeLabel(item, nodeNameMap) === label
  )).length > 1;
}

export function hasDuplicateOutgoingEdgeLabel(
  edges: Array<Record<string, unknown>>,
  nodeNameMap: Record<string, string> = {},
): boolean {
  if (edges.length <= 1) return false;
  const labelCounts = edges.reduce<Record<string, number>>((acc, edge) => {
    const label = normalizedEdgeLabel(edge, nodeNameMap);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return Object.values(labelCounts).some((count) => count > 1);
}

export function outgoingRouteCountLabel(edges: Array<Record<string, unknown>>): string {
  return `${edges.length} 条${hasDuplicateOutgoingEdgeLabel(edges) ? '并行' : ''}流转`;
}

export function flowEdgeDisplayLabel(
  edge: Record<string, unknown>,
  nodeNameMap: Record<string, string> = {},
  siblingCount = 1,
  hasDuplicateSourceLabel = false,
): string {
  const label = normalizedEdgeLabel(edge, nodeNameMap);
  const targetName = edgeTargetName(edge, nodeNameMap);
  if (hasDuplicateSourceLabel && targetName) {
    return `并行执行 · ${targetName}`;
  }
  const hasExplicitLabel = Boolean(String(edge.label || '').trim() || String(edge.condition || '').trim());
  if (siblingCount > 1 && targetName && (hasDuplicateSourceLabel || !hasExplicitLabel)) {
    return `${label} · 到${targetName}`;
  }
  return label;
}

export function sourceEdgeSummary(
  edge: Record<string, unknown>,
  nodeNameMap: Record<string, string> = {},
  index = 0,
  siblingEdges: Array<Record<string, unknown>> = [],
): string {
  const targetName = edgeTargetName(edge, nodeNameMap) || '未指定节点';
  const label = String(edge.label || '').trim();
  const condition = conditionNaturalText(String(edge.condition || '')).trim();
  const hasPriority = edge.priority !== undefined && edge.priority !== null && String(edge.priority).trim() !== '';
  const priority = hasPriority && typeof edge.priority === 'number' ? edge.priority : hasPriority && Number.isFinite(Number(edge.priority)) ? Number(edge.priority) : index;
  const prefix = label || condition;
  const parallelText = hasDuplicateSiblingEdgeLabel(edge, siblingEdges, nodeNameMap) ? '并行执行 · ' : '';
  const priorityText = hasPriority && Number.isFinite(priority) ? ` · 优先级 ${priority}` : '';
  return `${parallelText}${prefix ? `${prefix} -> ` : ''}${targetName}${priorityText}`;
}

export function compactEdgeLabel(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= 24) return text;
  return `${text.slice(0, 21)}...`;
}

export function nodeTypeLabel(type: string): string {
  return NODE_TYPE_OPTIONS.find((item) => item.value === type)?.label || type || '节点';
}

export function knowledgeScopeLabels(value: unknown): string[] {
  if (!isRecord(value) || Object.keys(value).length === 0) return [];
  return Object.entries(value).map(([key, item]) => `${key}: ${String(item)}`);
}

export function compactInputStyle(value: string, minCh = 8, maxCh = 92): CSSProperties {
  const longestLine = String(value || '').split('\n').reduce((max, line) => Math.max(max, visualTextWidth(line)), 0);
  const width = Math.max(minCh, Math.min(maxCh, longestLine + 2));
  return { width: `min(${width}ch, 100%)` };
}

export function visualTextWidth(value: string): number {
  return Array.from(value).reduce((total, char) => {
    if (/[\u2e80-\u9fff\uff00-\uffef]/.test(char)) return total + 2;
    return total + 1;
  }, 0);
}

export function sourceInputStyle(value: string, multiline = false): CSSProperties {
  const longestLine = String(value || '').split('\n').reduce((max, line) => Math.max(max, visualTextWidth(line)), 0);
  const minCh = multiline ? 34 : 18;
  const maxCh = multiline ? 96 : 72;
  const width = Math.max(minCh, Math.min(maxCh, longestLine + 4));
  return { width: `min(${width}ch, 100%)`, maxWidth: '100%' };
}

export function previewSourceText(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return '暂无节点说明';
  return text.length > 96 ? `${text.slice(0, 96)}...` : text;
}

export function EditableSourceHeading({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <EditableSourceField>
      <SourceInput
        className={SOURCE_TITLE_INPUT_CLASS}
        style={compactInputStyle(value, 10, 56)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </EditableSourceField>
  );
}

export function EditableSourceStepHeading({
  index,
  value,
  fallback,
  onChange,
}: {
  index: number;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  return (
    <EditableSourceField>
      <div className={SOURCE_STEP_TITLE_EDIT_CLASS}>
        <span>Node {index + 1}:</span>
        <SourceInput
          value={value}
          placeholder={fallback}
          style={compactInputStyle(value || fallback, 10, 88)}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </EditableSourceField>
  );
}

export function EditableSourceTextLine({
  label,
  value,
  multiline = false,
  collapsible = false,
  readOnly = false,
  onChange,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  collapsible?: boolean;
  readOnly?: boolean;
  onChange: (value: string) => void;
}) {
  const canCollapse = collapsible && multiline;
  const shouldStartCollapsed = canCollapse && value.trim().length > 90;
  const [collapsed, setCollapsed] = useState(shouldStartCollapsed);

  useEffect(() => {
    if (!canCollapse || value.trim().length <= 90) {
      setCollapsed(false);
    }
  }, [canCollapse, value]);

  return (
    <div className={cn(SOURCE_LINE_CLASS, canCollapse && "collapsible")}>
      <span className={SOURCE_KEY_CLASS}>{label}</span>
      <span className={SOURCE_VALUE_CLASS}>
        <EditableSourceField>
          {canCollapse ? (
            <div className={SOURCE_COLLAPSIBLE_EDITOR_CLASS}>
              <button
                type="button"
                className={SOURCE_COLLAPSIBLE_HEAD_CLASS}
                onClick={() => setCollapsed((current) => !current)}
              >
                <span className={cn(SOURCE_COLLAPSIBLE_PREVIEW_CLASS, !collapsed && SOURCE_COLLAPSIBLE_PREVIEW_MUTED_CLASS)}>
                  {collapsed ? previewSourceText(value) : '正在编辑节点说明'}
                </span>
                <span className={SOURCE_COLLAPSIBLE_TOGGLE_CLASS}>
                  {collapsed ? <RightOutlined /> : <DownOutlined />}
                  {collapsed ? '展开' : '收起'}
                </span>
              </button>
              {!collapsed && (
                <AutoGrowTextarea
                  className={SOURCE_EDIT_INPUT_CLASS}
                  value={value}
                  style={sourceInputStyle(value, true)}
                  minRows={3}
                  readOnly={readOnly}
                  onChange={(event) => {
                    if (!readOnly) onChange(event.target.value);
                  }}
                />
              )}
            </div>
          ) : multiline ? (
            <AutoGrowTextarea
              className={SOURCE_EDIT_INPUT_CLASS}
              value={value}
              style={sourceInputStyle(value, true)}
              minRows={2}
              readOnly={readOnly}
              onChange={(event) => {
                if (!readOnly) onChange(event.target.value);
              }}
            />
          ) : (
            <SourceInput
              className={SOURCE_EDIT_INPUT_CLASS}
              value={value}
              style={sourceInputStyle(value)}
              readOnly={readOnly}
              onChange={(event) => {
                if (!readOnly) onChange(event.target.value);
              }}
            />
          )}
        </EditableSourceField>
      </span>
    </div>
  );
}

export function EditableSourceListLine({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className={SOURCE_LINE_CLASS}>
      <span className={SOURCE_KEY_CLASS}>{label}</span>
      <span className={SOURCE_VALUE_CLASS}>
        <EditableSourceField>
          <AutoGrowTextarea
            className={SOURCE_EDIT_INPUT_CLASS}
            value={values.join('\n')}
            style={sourceInputStyle(values.join('\n'), true)}
            minRows={1}
            onChange={(event) => onChange(event.target.value)}
          />
        </EditableSourceField>
      </span>
    </div>
  );
}

export function EditableSourceSelectLine({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const mergedOptions = options.some((option) => option.value === value) || !value
    ? options
    : [...options, { value, label: value }];
  return (
    <div className={SOURCE_LINE_CLASS}>
      <span className={SOURCE_KEY_CLASS}>{label}</span>
      <span className={SOURCE_VALUE_CLASS}>
        <EditableSourceField>
          <SourceSelect
            className={cn(SOURCE_SELECT_CLASS, "w-[220px]")}
            value={value}
            options={mergedOptions}
            onChange={onChange}
          />
        </EditableSourceField>
      </span>
    </div>
  );
}

export function EditableConditionLine({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const presetValue = conditionPresetValue(value);
  const naturalValue = conditionNaturalText(value);
  return (
    <div className={SOURCE_LINE_CLASS}>
      <span className={SOURCE_KEY_CLASS}>{fieldLabel('condition')}</span>
      <span className={SOURCE_VALUE_CLASS}>
        <EditableSourceField>
          <div className={CONDITION_EDITOR_CLASS}>
            <SourceSelect
              className={CONDITION_PRESET_CLASS}
              value={presetValue}
              options={CONDITION_PRESET_OPTIONS}
              onChange={(nextValue) => {
                if (nextValue === '__custom__') {
                  onChange(naturalValue);
                  return;
                }
                onChange(conditionFromPreset(nextValue));
              }}
            />
            <AutoGrowTextarea
              className={cn(SOURCE_EDIT_INPUT_CLASS, CONDITION_INPUT_CLASS)}
              value={naturalValue}
              placeholder="用一句话描述什么时候进入，例如：用户已经提供商品名称后进入"
              minRows={1}
              onChange={(event) => onChange(event.target.value)}
            />
            <span className={CONDITION_READABLE_CLASS}>{conditionReadableText(value)}</span>
          </div>
        </EditableSourceField>
      </span>
    </div>
  );
}

export function SourceReadonlyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn(SOURCE_LINE_CLASS, "readonly")}>
      <span className={SOURCE_KEY_CLASS}>{label}</span>
      <span className={cn(SOURCE_VALUE_CLASS, SOURCE_READONLY_VALUE_CLASS)}>{value || '-'}</span>
    </div>
  );
}

export function SourceJsonLine({ label, value }: { label: string; value: unknown }) {
  if (!hasReadableSourceObject(value)) return null;
  return (
    <div className={cn(SOURCE_LINE_CLASS, "readonly")}>
      <span className={SOURCE_KEY_CLASS}>{label}</span>
      <span className={SOURCE_VALUE_CLASS}>
        <pre className={SOURCE_JSON_INLINE_CLASS}>{JSON.stringify(value, null, 2)}</pre>
      </span>
    </div>
  );
}

export function EditableRetryPolicyLine({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const policy = isRecord(value) ? value : {};
  const attemptKey = Object.prototype.hasOwnProperty.call(policy, 'max_retries') ? 'max_retries' : 'max_attempts';
  const strategyKey = Object.prototype.hasOwnProperty.call(policy, 'strategy') ? 'strategy' : 'on_failure';
  const messageKey = Object.prototype.hasOwnProperty.call(policy, 'message') ? 'message' : 'retry_message';
  const maxAttempts = retryPolicyNumber(policy.max_retries ?? policy.max_attempts);
  const strategy = retryPolicyString(policy.strategy ?? policy.on_failure);
  const retryMessage = retryPolicyString(policy.retry_message ?? policy.message);
  const strategyOptions = mergeSelectOptions(
    RETRY_STRATEGY_OPTIONS,
    strategy ? [{ value: strategy, label: retryStrategyLabel(strategy) }] : [],
  );

  function commit(patch: Record<string, unknown>) {
    const next = { ...policy, ...patch };
    Object.keys(next).forEach((key) => {
      if (next[key] === '' || next[key] === null || next[key] === undefined) delete next[key];
    });
    onChange(next);
  }

  function updateAttempts(nextValue: number | string | null) {
    const nextNumber = Number(nextValue);
    commit(Number.isFinite(nextNumber) && nextNumber > 0
      ? { [attemptKey]: Math.floor(nextNumber) }
      : { max_attempts: undefined, max_retries: undefined });
  }

  function updateStrategy(nextValue?: string) {
    commit(nextValue ? { [strategyKey]: nextValue } : { on_failure: undefined, strategy: undefined });
  }

  function updateMessage(nextValue: string) {
    commit(nextValue.trim() ? { [messageKey]: nextValue } : { retry_message: undefined, message: undefined });
  }

  return (
    <div className={SOURCE_LINE_CLASS}>
      <span className={SOURCE_KEY_CLASS}>重试策略</span>
      <span className={SOURCE_VALUE_CLASS}>
        <EditableSourceField>
          <div className={RETRY_POLICY_EDITOR_CLASS}>
            <label className={RETRY_POLICY_FIELD_CLASS}>
              <span>最多重试</span>
              <SourceNumberInput
                min={0}
                value={maxAttempts}
                placeholder="不限制"
                onChange={updateAttempts}
              />
            </label>
            <label className={RETRY_POLICY_FIELD_CLASS}>
              <span>失败后</span>
              <SourceSelect
                value={strategy || undefined}
                options={strategyOptions}
                placeholder="选择处理方式"
                onChange={(nextValue) => updateStrategy(nextValue)}
              />
            </label>
            <label className={RETRY_POLICY_FIELD_CLASS}>
              <span>追问文案</span>
              <SourceInput
                value={retryMessage}
                placeholder="例如：请补充需要校验的报文内容。"
                onChange={(event) => updateMessage(event.target.value)}
              />
            </label>
          </div>
        </EditableSourceField>
      </span>
    </div>
  );
}

export function retryPolicyNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : null;
}

export function retryPolicyString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function retryStrategyLabel(value: string): string {
  return RETRY_STRATEGY_OPTIONS.find((item) => item.value === value)?.label || value;
}

export function hasReadableSourceObject(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.keys(value).length > 0;
}

export function EditableSourceActionLine({
  values,
  options,
  toolDescriptions,
  toolStatuses,
  onChange,
}: {
  values: string[];
  options: SelectOption[];
  toolDescriptions: ToolDescriptionMap;
  toolStatuses: ToolStatusMap;
  onChange: (value: string) => void;
}) {
  return (
    <div className={SOURCE_LINE_CLASS}>
      <span className={SOURCE_KEY_CLASS}>{fieldLabel('allowed_actions')}</span>
      <span className={SOURCE_VALUE_CLASS}>
        <EditableSourceField>
          <EditableActionList
            actions={values}
            options={options}
            toolDescriptions={toolDescriptions}
            toolStatuses={toolStatuses}
            onChange={onChange}
          />
        </EditableSourceField>
      </span>
    </div>
  );
}

export function EditableActionList({
  actions,
  options,
  toolDescriptions,
  toolStatuses,
  onChange,
}: {
  actions: string[];
  options: SelectOption[];
  toolDescriptions: ToolDescriptionMap;
  toolStatuses: ToolStatusMap;
  onChange: (value: string) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const mergedOptions = mergeSelectOptions(options, actions.map((action) => ({
    value: action,
    label: actionLabel(action),
  })));

  function writeActions(nextActions: string[]) {
    onChange(nextActions.filter(Boolean).join('\n'));
  }

  function commitAction(index: number, action: string) {
    const nextAction = action.trim();
    const next = [...actions];
    if (!nextAction) {
      if (index < next.length) next.splice(index, 1);
      writeActions(next);
      setEditingIndex(null);
      return;
    }
    const duplicateIndex = next.findIndex((item, itemIndex) => item === nextAction && itemIndex !== index);
    if (duplicateIndex >= 0) {
      notify.info('这个动作已经添加过了');
      setEditingIndex(null);
      return;
    }
    if (index >= next.length) {
      next.push(nextAction);
    } else {
      next[index] = nextAction;
    }
    writeActions(next);
    setEditingIndex(null);
  }

  function removeAction(index: number) {
    const next = [...actions];
    next.splice(index, 1);
    writeActions(next);
    if (editingIndex === index) setEditingIndex(null);
  }

  function actionSelect(index: number, value?: string) {
    return (
      <ActionCombobox
        value={value || undefined}
        options={mergedOptions}
        placeholder="选择一个动作"
        onSelect={(nextValue) => commitAction(index, String(nextValue || ''))}
      />
    );
  }

  return (
    <div className={cn(SOURCE_ACTION_EDITOR_CLASS, "group/action-editor")}>
      <div className={cn(SOURCE_ACTION_LIST_CLASS, SOURCE_ACTION_LIST_EDITABLE_CLASS)}>
        {actions.map((action, index) => (
          editingIndex === index ? (
            <span className={SOURCE_ACTION_PICKER_CLASS} key={`editing_${index}`}>
              {actionSelect(index, action)}
            </span>
          ) : (
            <span className={cn(SOURCE_ACTION_TOKEN_CLASS, "group/token")} key={`${action}_${index}`}>
              <button
                type="button"
                className={SOURCE_ACTION_EDIT_BUTTON_CLASS}
                onClick={() => setEditingIndex(index)}
              >
                <ActionChip action={action} toolDescriptions={toolDescriptions} toolStatuses={toolStatuses} />
              </button>
              <button type="button" className={SOURCE_ACTION_REMOVE_CLASS} onClick={() => removeAction(index)} aria-label={`移除 ${actionLabel(action)}`}>
                ×
              </button>
            </span>
          )
        ))}
        {editingIndex !== null && editingIndex >= actions.length && (
          <span className={SOURCE_ACTION_PICKER_CLASS}>
            {actionSelect(editingIndex)}
          </span>
        )}
        {editingIndex === null && (
          <button type="button" className={SOURCE_ACTION_ADD_CLASS} onClick={() => setEditingIndex(actions.length)}>
            <PlusOutlined />
            新增动作
          </button>
        )}
      </div>
      <span className={SOURCE_EDIT_HINT_CLASS}>每次新增一个动作；点击已有动作可重新选择。</span>
    </div>
  );
}

export function EditableFlowRulesLine({
  sourceNodeId,
  edges,
  nodes,
  nodeOptions,
  terminal,
  onAdd,
  onUpdate,
  onDelete,
}: {
  sourceNodeId: string;
  edges: Array<Record<string, unknown>>;
  nodes: Array<Record<string, unknown>>;
  nodeOptions: SelectOption[];
  terminal: boolean;
  onAdd: () => void;
  onUpdate: (edgeIndex: number, patch: Record<string, unknown>) => void;
  onDelete: (edgeIndex: number) => void;
}) {
  const orderedEdges = edges
    .map((edge, index) => ({ edge, index }))
    .sort((a, b) => edgePriority(a.edge, a.index) - edgePriority(b.edge, b.index));
  return (
    <div className={SOURCE_LINE_CLASS}>
      <span className={SOURCE_KEY_CLASS}>流转规则</span>
      <span className={SOURCE_VALUE_CLASS}>
        <EditableSourceField>
          <div className={FLOW_RULE_EDITOR_CLASS}>
            <div className={FLOW_RULE_HEAD_CLASS}>
              <span>从 {nodeDisplayNameById(nodes, sourceNodeId)} 出发</span>
              <UIButton variant="outline" size="sm" className={PILL_OUTLINE_BUTTON_CLASS} onClick={onAdd}>
                <PlusOutlined />
                新增规则
              </UIButton>
            </div>
            {orderedEdges.length === 0 ? (
              <div className={FLOW_RULE_EMPTY_CLASS}>{terminal ? '当前节点是终止节点，默认流程结束。' : '还没有后续节点，请新增流转规则。'}</div>
            ) : (
              <div className={FLOW_RULE_LIST_CLASS}>
                {orderedEdges.map(({ edge, index }) => (
                  <div className={FLOW_RULE_ITEM_CLASS} key={`${String(edge.next_node_id)}_${index}`}>
                    <label className={cn(FLOW_RULE_FIELD_CLASS, FLOW_RULE_FIELD_TARGET_CLASS)}>
                      <span>目标 Node</span>
                      <SourceSelect
                        className={FLOW_RULE_TARGET_CLASS}
                        value={String(edge.next_node_id || '') || undefined}
                        options={nodeOptions}
                        placeholder="选择目标 Node"
                        onChange={(value) => onUpdate(index, { next_node_id: value })}
                      />
                    </label>
                    <label className={cn(FLOW_RULE_FIELD_CLASS, FLOW_RULE_FIELD_LABEL_CLASS)}>
                      <span>规则名称</span>
                      <SourceInput
                        className={FLOW_RULE_LABEL_INPUT_CLASS}
                        value={String(edge.label || '')}
                        placeholder="例如：信息完整后继续"
                        onChange={(event) => onUpdate(index, { label: event.target.value })}
                      />
                    </label>
                    <div className={cn(FLOW_RULE_FIELD_CLASS, FLOW_RULE_FIELD_CONDITION_CLASS)}>
                      <span>进入条件</span>
                      <div className={FLOW_RULE_CONDITION_CONTROLS_CLASS}>
                        <SourceSelect
                          className={CONDITION_PRESET_CLASS}
                          value={conditionPresetValue(String(edge.condition || ''))}
                          options={CONDITION_PRESET_OPTIONS}
                          onChange={(nextValue) => {
                            if (nextValue === '__custom__') {
                              onUpdate(index, { condition: conditionNaturalText(String(edge.condition || '')) });
                              return;
                            }
                            onUpdate(index, { condition: conditionFromPreset(nextValue) });
                          }}
                        />
                        <AutoGrowTextarea
                          className={FLOW_RULE_CONDITION_INPUT_CLASS}
                          value={conditionNaturalText(String(edge.condition || ''))}
                          placeholder="用一句话描述，例如：报文已获取后进入"
                          minRows={1}
                          onChange={(event) => onUpdate(index, { condition: event.target.value })}
                        />
                      </div>
                      <em>{flowRuleConditionText(String(edge.condition || ''))}</em>
                    </div>
                    <label className={cn(FLOW_RULE_FIELD_CLASS, FLOW_RULE_FIELD_PRIORITY_CLASS)}>
                      <span>优先级</span>
                      <SourceNumberInput
                        className={FLOW_RULE_PRIORITY_CLASS}
                        min={0}
                        value={edgePriority(edge, index)}
                        onChange={(value) => onUpdate(index, { priority: Number(value ?? 0) })}
                      />
                    </label>
                    <UIButton variant="destructive" size="icon" className={FLOW_RULE_DELETE_CLASS} onClick={() => onDelete(index)}>
                      <DeleteOutlined />
                    </UIButton>
                  </div>
                ))}
              </div>
            )}
          </div>
        </EditableSourceField>
      </span>
    </div>
  );
}

export function EditableSourceField({ children }: { children: ReactNode }) {
  function stop(event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <div className={SOURCE_EDIT_FIELD_CLASS} onMouseDown={stop} onClick={stop} onDoubleClick={stop} onKeyDown={stop}>
      {children}
    </div>
  );
}

export function SelectableTarget({
  className,
  target,
  onToggle,
  children,
}: {
  className: string;
  target: TargetSelection;
  onToggle: (target: TargetSelection) => void;
  children: ReactNode;
}) {
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (hasSelectedText()) {
      event.preventDefault();
      return;
    }
    onToggle(target);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onToggle(target);
  }

  return (
    <div role="button" tabIndex={0} className={className} onClick={handleClick} onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
}

export function ActionDiffList({
  diff,
  currentActions,
  toolDescriptions,
  toolStatuses,
}: {
  diff: TextDiffAnimation;
  currentActions: string[];
  toolDescriptions: ToolDescriptionMap;
  toolStatuses: ToolStatusMap;
}) {
  const oldActions = actionsFromDiffText(diffFullOldValue(diff));
  const newActions = actionsFromDiffText(diffFullNewValue(diff));
  const visibleActions = currentActions.length > 0 ? currentActions : newActions;
  const inserted = new Set(newActions.filter((action) => !oldActions.includes(action)));
  const removed = oldActions.filter((action) => !newActions.includes(action));
  const phaseClass = diff.phase === 'mark' ? 'marked' : diff.phase === 'type' ? 'typing' : 'settled';
  if (visibleActions.length === 0 && removed.length === 0) return <span className={ACTION_EMPTY_CLASS}>-</span>;
  return (
    <div className={ACTION_LIST_CLASS}>
      {removed.map((action, index) => (
        <ActionChip
          action={action}
          toolDescriptions={toolDescriptions}
          toolStatuses={toolStatuses}
          className="removed"
          key={`removed_${action}_${index}`}
        />
      ))}
      {visibleActions.map((action, index) => (
        <ActionChip
          action={action}
          toolDescriptions={toolDescriptions}
          toolStatuses={toolStatuses}
          className={inserted.has(action) ? `added ${phaseClass}` : ''}
          key={`${action}_${index}`}
        />
      ))}
    </div>
  );
}

export function ActionList({
  actions,
  toolDescriptions,
  toolStatuses,
}: {
  actions: string[];
  toolDescriptions: ToolDescriptionMap;
  toolStatuses: ToolStatusMap;
}) {
  if (actions.length === 0) return <span className={ACTION_EMPTY_CLASS}>-</span>;
  return (
    <div className={ACTION_LIST_CLASS}>
      {actions.map((action, index) => (
        <ActionChip
          action={action}
          toolDescriptions={toolDescriptions}
          toolStatuses={toolStatuses}
          key={`${action}_${index}`}
        />
      ))}
    </div>
  );
}

export function ActionChip({
  action,
  toolDescriptions,
  toolStatuses,
  className = '',
}: {
  action: string;
  toolDescriptions: ToolDescriptionMap;
  toolStatuses: ToolStatusMap;
  className?: string;
}) {
  const toolName = toolNameFromAction(action);
  const description = toolName ? toolDescriptions[toolName] || '当前工具配置中暂无描述' : '';
  const status = toolName ? toolStatuses[toolName] || 'incomplete' : '';
  const variant = className.includes('removed')
    ? 'removed'
    : className.includes('added')
      ? className.includes('typing')
        ? 'typing'
        : className.includes('settled')
          ? 'settled'
          : 'added'
      : undefined;

  return (
    <span
      className={actionChipClass({ toolName: toolName || undefined, status, variant })}
      title={description || undefined}
    >
      {actionLabel(action)}
    </span>
  );
}

export function SaveReviewDiffValue({
  diff,
  toolDescriptions,
  toolStatuses,
}: {
  diff: TextDiffAnimation;
  toolDescriptions: ToolDescriptionMap;
  toolStatuses: ToolStatusMap;
}) {
  if (diff.field === 'allowed_actions') {
    const removedActions = actionsFromDiffText(diffFullOldValue(diff));
    const insertedActions = actionsFromDiffText(diffFullNewValue(diff));
    return (
      <>
        {diff.removed && (
          <div className={cn(SAVE_REVIEW_ACTION_DIFF_CLASS, SAVE_REVIEW_ACTION_DIFF_OLD_CLASS)}>
            <span className={cn(SAVE_REVIEW_DIFF_SIGN_CLASS, SAVE_REVIEW_DIFF_SIGN_OLD_CLASS)}>-</span>
            <ActionList actions={removedActions} toolDescriptions={toolDescriptions} toolStatuses={toolStatuses} />
          </div>
        )}
        {diff.inserted && (
          <div className={cn(SAVE_REVIEW_ACTION_DIFF_CLASS, SAVE_REVIEW_ACTION_DIFF_NEW_CLASS)}>
            <span className={cn(SAVE_REVIEW_DIFF_SIGN_CLASS, SAVE_REVIEW_DIFF_SIGN_NEW_CLASS)}>+</span>
            <ActionList actions={insertedActions} toolDescriptions={toolDescriptions} toolStatuses={toolStatuses} />
          </div>
        )}
      </>
    );
  }
  return (
    <>
      {diff.removed && <div><span className={DIFF_OLD_CLASS}>- {diff.removed}</span></div>}
      {diff.inserted && <div><span className={DIFF_NEW_CLASS}>+ {diff.inserted}</span></div>}
    </>
  );
}

export function InlineDiffText({
  path,
  field,
  value,
  diffs,
}: {
  path: string;
  field: string;
  value: string;
  diffs: TextDiffAnimation[];
}): ReactNode {
  const diff = diffs.find((item) => item.path === path && item.field === field);
  if (!diff) return value;
  if (diff.phase === 'mark') {
    return (
      <>
        {diff.prefix}
        {diff.removed ? <span className={INLINE_REMOVE_CLASS}>{diff.removed}</span> : null}
        {diff.suffix}
      </>
    );
  }
  const typedInsert = diff.inserted.slice(0, Math.ceil(diff.inserted.length * diff.progress));
  return (
    <>
      {diff.prefix}
      {typedInsert ? <span className={cn(INLINE_ADD_CLASS, diff.phase === 'settled' && INLINE_ADD_SETTLED_CLASS)}>{typedInsert}</span> : null}
      {diff.suffix}
    </>
  );
}

export function diffFullOldValue(diff: TextDiffAnimation): string {
  return `${diff.prefix}${diff.removed}${diff.suffix}`;
}

export function diffFullNewValue(diff: TextDiffAnimation): string {
  return `${diff.prefix}${diff.inserted}${diff.suffix}`;
}

export function actionsFromDiffText(value: string): string[] {
  const normalized = value.replace(/`/g, '').trim();
  if (!normalized || normalized === '-') return [];
  return normalized
    .split(/[、,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseInitialSkillPrompt(text: string): { title: string; raw_content: string } {
  return { title: '新SOP', raw_content: text.trim() };
}

export function createStreamingDraftSeed(payload: { title: string; raw_content: string }): SkillCard {
  return {
    skill_id: `skill_${slugSegment(payload.title) || 'preview'}`,
    name: payload.title || '新SOP',
    version: '1.0.0',
    business_domain: '',
    description: payload.raw_content.slice(0, 120),
    trigger_intents: [],
    user_utterance_examples: [],
    goal: [],
    required_info: [],
    response_rules: [],
    nodes: [],
    edges: [],
    start_node_id: '',
    terminal_node_ids: [],
    interruption_policy: {},
  };
}

export function previewSkillFromStream(
  streamText: string,
  previous: SkillCard,
  payload: { title: string; raw_content: string },
): SkillCard {
  const parsed = parseCompleteStreamSkill(streamText);
  if (parsed) return parsed;
  const source = extractDraftSkillSource(streamText);
  const next = cloneSkill(previous || createStreamingDraftSeed(payload));
  applyStringPreview(next, source, 'skill_id');
  applyStringPreview(next, source, 'name');
  applyStringPreview(next, source, 'version');
  applyStringPreview(next, source, 'business_domain');
  applyStringPreview(next, source, 'description');
  applyArrayPreview(next, source, 'trigger_intents');
  applyArrayPreview(next, source, 'user_utterance_examples');
  applyArrayPreview(next, source, 'goal');
  applyArrayPreview(next, source, 'required_info');
  applyArrayPreview(next, source, 'response_rules');
  const nodes = extractNodePreview(source);
  if (nodes.length > 0) {
    next.nodes = nodes;
    next.start_node_id = String(nodes[0]?.node_id || '');
    next.terminal_node_ids = nodes.length > 0 ? [String(nodes[nodes.length - 1]?.node_id || '')].filter(Boolean) : [];
    next.edges = nodes.slice(0, -1).map((node, index) => ({
      source_node_id: String(node.node_id || ''),
      next_node_id: String(nodes[index + 1]?.node_id || ''),
      condition: '',
      priority: index,
      label: '',
    })).filter((edge) => edge.source_node_id && edge.next_node_id);
  }
  return next;
}

export function parseCompleteStreamSkill(streamText: string): SkillCard | null {
  try {
    const parsed = JSON.parse(extractJsonCandidate(streamText)) as Record<string, unknown>;
    const draft = isRecord(parsed.draft_skill) ? parsed.draft_skill : parsed;
    if (!isRecord(draft)) return null;
    return {
      skill_id: stringValue(draft.skill_id, 'skill_preview'),
      name: stringValue(draft.name, '新SOP'),
      version: stringValue(draft.version, '1.0.0'),
      business_domain: stringValue(draft.business_domain, ''),
      description: stringValue(draft.description, ''),
      trigger_intents: asStringList(draft.trigger_intents),
      user_utterance_examples: asStringList(draft.user_utterance_examples),
      goal: asStringList(draft.goal),
      required_info: asStringList(draft.required_info),
      response_rules: asStringList(draft.response_rules),
      nodes: Array.isArray(draft.nodes) ? draft.nodes.filter(isRecord).map(normalizeNodePreview) : [],
      edges: Array.isArray(draft.edges) ? draft.edges.filter(isRecord).map(normalizeEdgePreview) : [],
      start_node_id: stringValue(draft.start_node_id, ''),
      terminal_node_ids: asStringList(draft.terminal_node_ids),
      interruption_policy: isRecord(draft.interruption_policy) ? stringRecord(draft.interruption_policy) : {},
    };
  } catch {
    return null;
  }
}

export function extractDraftSkillSource(streamText: string): string {
  const fieldIndex = streamText.indexOf('"draft_skill"');
  if (fieldIndex < 0) return streamText;
  const objectStart = streamText.indexOf('{', fieldIndex);
  if (objectStart < 0) return streamText.slice(fieldIndex);
  return streamText.slice(objectStart);
}

export function extractJsonCandidate(streamText: string): string {
  const stripped = streamText.trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  return start >= 0 && end >= start ? stripped.slice(start, end + 1) : stripped;
}

export function applyStringPreview(skill: SkillCard, source: string, field: keyof SkillCard): void {
  const value = extractJsonStringField(source, String(field));
  if (value !== null) {
    (skill as unknown as Record<string, unknown>)[field] = value;
  }
}

export function applyArrayPreview(skill: SkillCard, source: string, field: keyof SkillCard): void {
  const value = extractJsonStringArrayField(source, String(field));
  if (value !== null) {
    (skill as unknown as Record<string, unknown>)[field] = value;
  }
}

export function extractNodePreview(source: string): Array<Record<string, unknown>> {
  const fragments = extractObjectFragmentsFromArrayField(source, 'nodes');
  return fragments
    .map((fragment, index) => parseNodeFragment(fragment, index))
    .filter((node): node is Record<string, unknown> => Boolean(node));
}

export function parseNodeFragment(fragment: string, index: number): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(fragment) as unknown;
    if (isRecord(parsed)) return normalizeNodePreview(parsed, index);
  } catch {
    // Partial object: fall through to field extraction.
  }
  const nodeId = extractJsonStringField(fragment, 'node_id') || '';
  const type = extractJsonStringField(fragment, 'type') || 'collect_info';
  const name = extractJsonStringField(fragment, 'name') || '';
  const instruction = extractJsonStringField(fragment, 'instruction') || '';
  const condition = extractJsonStringField(fragment, 'condition') || '';
  const expectedUserInfo = extractJsonStringArrayField(fragment, 'expected_user_info') || [];
  const allowedActions = extractJsonStringArrayField(fragment, 'allowed_actions') || [];
  if (!nodeId && !name && !instruction && expectedUserInfo.length === 0 && allowedActions.length === 0) {
    return null;
  }
  return {
    node_id: nodeId || `node_${index + 1}`,
    type,
    name: name || nodeId || `节点 ${index + 1}`,
    instruction,
    optional: false,
    condition,
    expected_user_info: expectedUserInfo,
    allowed_actions: allowedActions,
    knowledge_scope: {},
    retry_policy: {},
    metadata: {},
  };
}

export function normalizeNodePreview(node: Record<string, unknown>, index = 0): Record<string, unknown> {
  const nodeId = stringValue(node.node_id, `node_${index + 1}`);
  return {
    node_id: nodeId,
    type: stringValue(node.type, 'collect_info'),
    name: stringValue(node.name, nodeId),
    instruction: stringValue(node.instruction, ''),
    optional: Boolean(node.optional),
    condition: stringValue(node.condition, ''),
    expected_user_info: asStringList(node.expected_user_info),
    allowed_actions: asStringList(node.allowed_actions),
    knowledge_scope: isRecord(node.knowledge_scope) ? node.knowledge_scope : {},
    retry_policy: isRecord(node.retry_policy) ? node.retry_policy : {},
    metadata: isRecord(node.metadata) ? node.metadata : {},
  };
}

export function normalizeEdgePreview(edge: Record<string, unknown>, index = 0): Record<string, unknown> {
  return {
    source_node_id: stringValue(edge.source_node_id, ''),
    next_node_id: stringValue(edge.next_node_id, ''),
    condition: stringValue(edge.condition, ''),
    priority: Number(edge.priority || index),
    label: stringValue(edge.label, ''),
  };
}

export function extractJsonStringField(source: string, field: string): string | null {
  const match = new RegExp(`"${escapeRegExp(field)}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`).exec(source);
  if (!match) return null;
  return decodeJsonString(match[1]);
}

export function extractJsonStringArrayField(source: string, field: string): string[] | null {
  const start = findFieldValueStart(source, field);
  if (start === null) return null;
  const arrayStart = skipWhitespace(source, start);
  if (source[arrayStart] !== '[') return null;
  const arrayEnd = findBalancedEnd(source, arrayStart, '[', ']');
  const arrayText = arrayEnd === null ? source.slice(arrayStart + 1) : source.slice(arrayStart, arrayEnd + 1);
  if (arrayEnd !== null) {
    try {
      const parsed = JSON.parse(arrayText) as unknown;
      return asStringList(parsed);
    } catch {
      return extractQuotedJsonStrings(arrayText);
    }
  }
  return extractQuotedJsonStrings(arrayText);
}

export function extractObjectFragmentsFromArrayField(source: string, field: string): string[] {
  const start = findFieldValueStart(source, field);
  if (start === null) return [];
  const arrayStart = skipWhitespace(source, start);
  if (source[arrayStart] !== '[') return [];
  const fragments: string[] = [];
  let objectStart = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = arrayStart + 1; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      if (depth === 0) objectStart = index;
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        fragments.push(source.slice(objectStart, index + 1));
        objectStart = -1;
      }
      continue;
    }
    if (char === ']' && depth === 0) break;
  }
  if (depth > 0 && objectStart >= 0) {
    fragments.push(source.slice(objectStart));
  }
  return fragments;
}

export function findFieldValueStart(source: string, field: string): number | null {
  const match = new RegExp(`"${escapeRegExp(field)}"\\s*:`).exec(source);
  return match ? match.index + match[0].length : null;
}

export function skipWhitespace(source: string, start: number): number {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

export function findBalancedEnd(source: string, start: number, openChar: string, closeChar: string): number | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return null;
}

export function extractQuotedJsonStrings(source: string): string[] {
  const values: string[] = [];
  const pattern = /"((?:\\.|[^"\\])*)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const value = decodeJsonString(match[1]);
    if (value) values.push(value);
  }
  return values;
}

export function decodeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}

export function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function stringRecord(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)]));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function slugSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function joinList(values: unknown): string {
  if (Array.isArray(values)) {
    const items = values.map(String).filter(Boolean);
    return items.length > 0 ? items.map((item) => `\`${item}\``).join(', ') : '-';
  }
  if (typeof values === 'string' && values.trim()) return values;
  return '-';
}

export function joinPlain(values: unknown): string {
  if (Array.isArray(values)) {
    const items = values.map(String).filter(Boolean);
    return items.length > 0 ? items.join('、') : '-';
  }
  if (typeof values === 'string' && values.trim()) return values;
  return '-';
}

export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

export function hasSelectedText(): boolean {
  return Boolean(window.getSelection()?.toString().trim());
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return window.btoa(binary);
}

export function filenameTitle(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').trim() || '新SOP';
}

export const uploadContentMarker = '上传文档内容：';

export function buildOutgoingText(input: string, attachments: UploadAttachment[]): string {
  const text = input.trim();
  const attachmentText = attachments
    .filter((item) => item.status === 'ready' && item.text?.trim())
    .map((item) => `文件：${item.name}\n${item.text?.trim() || ''}`)
    .join('\n\n');
  return [text, attachmentText ? `上传文档内容：\n${attachmentText}` : ''].filter(Boolean).join('\n\n');
}

export function visibleChatContent(item: ChatItem): string {
  if (item.role !== 'user') return item.content;
  return stripUploadContent(item.content || item.outgoingText || '');
}

export function buildEditedOutgoingText(item: ChatItem, displayText: string): string {
  const source = item.outgoingText || item.content;
  const markerIndex = source.indexOf(uploadContentMarker);
  if (markerIndex < 0) return displayText.trim();
  const uploadContent = source.slice(markerIndex).trim();
  return [displayText.trim(), uploadContent].filter(Boolean).join('\n\n');
}

export function stripUploadContent(text: string): string {
  const markerIndex = text.indexOf(uploadContentMarker);
  return (markerIndex >= 0 ? text.slice(0, markerIndex) : text).trim();
}

export function buildDisplayAttachments(attachments: UploadAttachment[]): ChatAttachment[] {
  return attachments
    .filter((item) => item.status === 'ready')
    .map((item) => ({
      id: item.id,
      name: item.name,
      type: attachmentTypeLabel(item.name),
    }));
}

export function attachmentTypeLabel(filename: string): string {
  const extension = filename.split('.').pop()?.trim().toUpperCase();
  return extension || 'FILE';
}

export function splitEditableList(value: string): string[] {
  return value
    .split(/\n|,|，|、/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatMessageTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function CopyGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="8" y="4" width="12" height="12" rx="3" />
      <rect x="4" y="8" width="12" height="12" rx="3" />
    </svg>
  );
}

export function PencilGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 19l4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L5 19z" />
      <path d="M14.8 5.2l4 4" />
    </svg>
  );
}

export function normalizeToolSuggestions(value: unknown): ToolSuggestionItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      name: String(item.name || '').trim(),
      display_name: typeof item.display_name === 'string' ? item.display_name : undefined,
      description: typeof item.description === 'string' ? item.description : undefined,
      bucket: typeof item.bucket === 'string' && item.bucket.trim() ? item.bucket.trim() : '技能自发现工具',
      tool_type: item.tool_type === 'mcp' ? 'mcp' : 'http',
      method: typeof item.method === 'string' ? item.method : 'POST',
      url: typeof item.url === 'string' ? item.url : '',
      mcp_config: isRecord(item.mcp_config) ? item.mcp_config : {},
      input_schema: isRecord(item.input_schema) ? item.input_schema : {},
      output_schema: isRecord(item.output_schema) ? item.output_schema : {},
      sample_arguments: isRecord(item.sample_arguments) ? item.sample_arguments : {},
      source_excerpt: typeof item.source_excerpt === 'string' ? item.source_excerpt : undefined,
      probe_result: isRecord(item.probe_result) ? item.probe_result as ToolProbeResponse : undefined,
      reason: typeof item.reason === 'string' ? item.reason : '',
      resolution_status: toolSuggestionResolutionValue(item.resolution_status),
      matched_tool_id: typeof item.matched_tool_id === 'string' ? item.matched_tool_id : undefined,
      matched_tool_name: typeof item.matched_tool_name === 'string' ? item.matched_tool_name : undefined,
      matched_tool_display_name: typeof item.matched_tool_display_name === 'string' ? item.matched_tool_display_name : undefined,
      missing_reason: typeof item.missing_reason === 'string' ? item.missing_reason : undefined,
      status: 'pending' as const,
      probeStatus: isRecord(item.probe_result)
        ? Boolean(item.probe_result.success)
          ? 'success' as const
          : 'error' as const
        : 'idle' as const,
    }))
    .filter((item) => item.name);
}

export function toolSuggestionResolutionValue(value: unknown): ToolSuggestion['resolution_status'] {
  return value === 'existing' || value === 'incomplete' || value === 'new_candidate' ? value : 'new_candidate';
}

export function toolSuggestionResolution(suggestion: ToolSuggestionItem): NonNullable<ToolSuggestion['resolution_status']> {
  return suggestion.resolution_status || 'new_candidate';
}

export function toolSuggestionTitle(suggestion: ToolSuggestionItem): string {
  const label = suggestion.display_name || suggestion.name;
  if (toolSuggestionResolution(suggestion) === 'existing') {
    return `已匹配工具：${suggestion.matched_tool_display_name || label}`;
  }
  return `建议新增工具：${label}`;
}

export function toolSuggestionResolutionLabel(suggestion: ToolSuggestionItem): string {
  const status = toolSuggestionResolution(suggestion);
  if (status === 'existing') return '已匹配现有工具';
  if (status === 'incomplete') return '工具信息不足';
  return '可新增候选';
}

export function toolSuggestionStatusText(suggestion: ToolSuggestionItem): string {
  if (suggestion.status === 'accepted') return '已确认';
  if (suggestion.status === 'created') return '已新增';
  if (suggestion.status === 'rejected') return '已拒绝';
  if (suggestion.probeStatus === 'probing') return '测试中';
  if (suggestion.probe_result?.success) return '测试通过';
  if (suggestion.probe_result && !suggestion.probe_result.success) return '测试失败';
  if (toolSuggestionResolution(suggestion) === 'existing') return '已存在';
  if (toolSuggestionResolution(suggestion) === 'incomplete') return '信息不足';
  return '待新增';
}

export function toolSuggestionStatusClass(suggestion: ToolSuggestionItem): ToolStatusBadgeVariant {
  if (suggestion.status === 'accepted' || suggestion.status === 'created' || suggestion.probe_result?.success || toolSuggestionResolution(suggestion) === 'existing') {
    return 'success';
  }
  if (suggestion.status === 'rejected' || (suggestion.probe_result && !suggestion.probe_result.success)) {
    return 'error';
  }
  if (suggestion.probeStatus === 'probing') return 'running';
  if (toolSuggestionResolution(suggestion) === 'incomplete') return 'muted';
  return 'pending';
}

export function toolSuggestionSelectionsComplete(suggestions: ToolSuggestionItem[]): boolean {
  const candidates = suggestions.filter((suggestion) => toolSuggestionResolution(suggestion) === 'new_candidate');
  return candidates.length > 0 && candidates.every((suggestion) =>
    suggestion.status === 'accepted' || suggestion.status === 'created' || suggestion.status === 'rejected',
  );
}

export function compactWarningItems(
  warnings: string[],
  _toolSuggestions: ToolSuggestionItem[] | undefined,
): Array<{ text: string; title: string }> {
  const items: Array<{ text: string; title: string }> = [];
  for (const warning of warnings) {
    const text = warning.trim();
    if (!text) continue;
    const existing = items.find((item) => item.text === text);
    if (existing) {
      existing.title = `${existing.title}\n${warning}`;
      continue;
    }
    items.push({ text, title: warning });
  }
  return items;
}

export function readDistillCache(key: string): DistillCacheSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DistillCacheSnapshot>;
    return {
      draft: parsed.draft || null,
      loadedSkill: parsed.loadedSkill || null,
      lastSavedDraft: parsed.lastSavedDraft || null,
      messages: Array.isArray(parsed.messages) ? parsed.messages : DEFAULT_DISTILL_MESSAGES,
      input: typeof parsed.input === 'string' ? parsed.input : '',
      selectedPaths: normalizeInitialSelectedPaths(
        Array.isArray(parsed.selectedPaths) ? parsed.selectedPaths.map(String) : DEFAULT_TARGET_PATHS,
      ),
      highlightedPaths: Array.isArray(parsed.highlightedPaths) ? parsed.highlightedPaths.map(String) : [],
      updatingPaths: Array.isArray(parsed.updatingPaths) ? parsed.updatingPaths.map(String) : [],
      dirtyPaths: Array.isArray(parsed.dirtyPaths) ? parsed.dirtyPaths.map(String) : [],
      textDiffs: Array.isArray(parsed.textDiffs) ? parsed.textDiffs : [],
      pendingChange: parsed.pendingChange || null,
      viewMode: parsed.viewMode === 'flow' ? 'flow' : 'source',
      attachments: Array.isArray(parsed.attachments)
        ? parsed.attachments.filter((item): item is UploadAttachment => isRecord(item)).map((item) => ({
            id: String(item.id || `file_${Date.now()}_${Math.random().toString(16).slice(2)}`),
            name: String(item.name || '未命名文件'),
            status: item.status === 'error' ? 'error' : 'ready',
            text: typeof item.text === 'string' ? item.text : undefined,
            error: typeof item.error === 'string' ? item.error : undefined,
          }))
        : [],
      streamStatus: typeof parsed.streamStatus === 'string' ? parsed.streamStatus : '',
      activeJob: isRecord(parsed.activeJob)
        ? {
            jobId: String(parsed.activeJob.jobId || ''),
            kind: parsed.activeJob.kind === 'rewrite' ? 'rewrite' : 'distill',
            assistantId: String(parsed.activeJob.assistantId || ''),
            lastSeq: Number(parsed.activeJob.lastSeq || 0),
            status: typeof parsed.activeJob.status === 'string' ? parsed.activeJob.status : undefined,
            createPayload: isRecord(parsed.activeJob.createPayload)
              ? {
                  title: String(parsed.activeJob.createPayload.title || ''),
                  raw_content: String(parsed.activeJob.createPayload.raw_content || ''),
                }
              : undefined,
            previousDraft: isRecord(parsed.activeJob.previousDraft)
              ? (parsed.activeJob.previousDraft as SkillCard)
              : undefined,
            targets: Array.isArray(parsed.activeJob.targets)
              ? parsed.activeJob.targets.map(String)
              : undefined,
          }
        : null,
    };
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

export function writeDistillCache(key: string, snapshot: DistillCacheSnapshot): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // Cache is best-effort. Large uploaded documents can exceed browser quota.
  }
}

export function removeDistillCache(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Cache cleanup is best-effort.
  }
}

export function isBlankDistillWorkspace(snapshot: DistillCacheSnapshot): boolean {
  return !snapshot.draft && !snapshot.loadedSkill && !snapshot.lastSavedDraft;
}

export function normalizeInitialSelectedPaths(paths: string[]): string[] {
  if (paths.length === 1 && paths[0] === 'basic') return [];
  return paths;
}

export function allTargetPaths(skill: SkillCard): string[] {
  return [
    'basic',
    ...skillGraphSteps(skill).map((_step, index) => stepTargetPath(index)),
  ];
}

export function reconcileSelectedPaths(paths: string[], skill: SkillCard): string[] {
  if (paths.length === 0) return [];
  const available = allTargetPaths(skill);
  const next = paths.filter((path) => available.includes(path));
  return next.length > 0 ? next : DEFAULT_TARGET_PATHS;
}


export function mergePaths(current: string[], next: string[]): string[] {
  return Array.from(new Set([...current, ...next]));
}

export function cloneSkill(skill: SkillCard): SkillCard {
  return JSON.parse(JSON.stringify(skill)) as SkillCard;
}

export function uniqueDraftSkillId(skillId: string): string {
  const normalized = (skillId || 'skill')
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'skill';
  return `${normalized}_${Date.now().toString(36)}`;
}

export function comparableSkillContent(skill: SkillCard): SkillCard {
  const next = cloneSkill(skill);
  next.version = '';
  return next;
}

export function hasSkillContentChanges(targetDraft: SkillCard | null, baseDraft: SkillCard | null): boolean {
  if (!targetDraft) return false;
  if (!baseDraft) return true;
  return JSON.stringify(comparableSkillContent(targetDraft)) !== JSON.stringify(comparableSkillContent(baseDraft));
}

export function removeToolActionFromSkill(skill: SkillCard, toolName: string): SkillCard {
  const next = cloneSkill(skill);
  const targetAction = `call_tool:${toolName}`;
  next.nodes = (Array.isArray(next.nodes) ? next.nodes : []).map((node) => ({
    ...node,
    allowed_actions: asStringList(node.allowed_actions).filter((action) => action !== targetAction),
  }));
  return next;
}

export function integrateToolSuggestionsIntoDraft(
  skill: SkillCard,
  suggestions: ToolSuggestionItem[],
  fallbackPaths: string[] = [],
): SkillCard {
  const next = cloneSkill(skill);
  const nodes = normalizeSkillNodes(next);
  const fallbackIndexes = fallbackPaths
    .map(stepIndexFromPath)
    .filter((index): index is number => index !== null && index >= 0 && index < nodes.length);

  suggestions.forEach((suggestion) => {
    const toolName = suggestion.name.trim();
    if (!toolName) return;
    const action = `call_tool:${toolName}`;
    const existingIndexes = nodes
      .map((node, index) => (asStringList(node.allowed_actions).includes(action) ? index : -1))
      .filter((index) => index >= 0);
    const targetIndexes = existingIndexes.length > 0
      ? existingIndexes
      : toolSuggestionTargetIndexes(nodes, suggestion, fallbackIndexes);

    targetIndexes.forEach((nodeIndex) => {
      const node = nodes[nodeIndex];
      const actions = asStringList(node.allowed_actions);
      if (actions.includes(action)) return;
      node.allowed_actions = [...actions, action];
    });
  });

  next.nodes = nodes;
  return next;
}

export function toolSuggestionTargetIndexes(
  nodes: Array<Record<string, unknown>>,
  _suggestion: ToolSuggestionItem,
  fallbackIndexes: number[],
): number[] {
  const uniqueFallbacks = Array.from(new Set(fallbackIndexes));
  if (uniqueFallbacks.length === 1) return uniqueFallbacks;
  const toolNodeIndexes = nodes
    .map((node, index) => (String(node.type || '') === 'tool_call' ? index : -1))
    .filter((index) => index >= 0);
  if (toolNodeIndexes.length === 1) return toolNodeIndexes;
  return [];
}

export function cloneSkillRead(skill: SkillRead): SkillRead {
  return JSON.parse(JSON.stringify(skill)) as SkillRead;
}

export function collectRollbackOperations(messages: ChatItem[]): DistillHistoryOperation[] {
  const operations = messages.flatMap((item) => item.operations || []);
  const relevant = operations.filter((operation) =>
    ['skill_change', 'version_save', 'tool_add'].includes(operation.kind),
  );
  const seen = new Set<string>();
  return relevant.filter((operation) => {
    const key = `${operation.kind}:${operation.skillId || ''}:${operation.version || ''}:${operation.toolId || operation.toolName || ''}:${operation.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function blankSkillForAnimation(skill: SkillCard): SkillCard {
  const blank = cloneSkill(skill);
  blank.skill_id = '';
  blank.name = '';
  blank.version = '';
  blank.business_domain = '';
  blank.description = '';
  blank.trigger_intents = [];
  blank.user_utterance_examples = [];
  blank.goal = [];
  blank.required_info = [];
  blank.response_rules = [];
  blank.nodes = skillGraphSteps(skill).map((step) => ({
    node_id: '',
    type: String(step.type || 'collect_info'),
    name: '',
    instruction: '',
    optional: Boolean(step.optional),
    condition: '',
    expected_user_info: [],
    allowed_actions: [],
    knowledge_scope: {},
    retry_policy: {},
    metadata: {},
  }));
  blank.edges = [];
  blank.start_node_id = '';
  blank.terminal_node_ids = [];
  return blank;
}

export function diffTargetPaths(previousDraft: SkillCard, nextDraft: SkillCard, targetPaths: string[]): string[] {
  const candidates = Array.from(new Set([...targetPaths, ...allTargetPaths(previousDraft), ...allTargetPaths(nextDraft)]));
  return candidates.filter((path) => sectionSignature(previousDraft, path) !== sectionSignature(nextDraft, path));
}

export function sectionSignature(skill: SkillCard, path: string): string {
  if (path === 'basic') {
    return JSON.stringify({
      skill_id: skill.skill_id,
      name: skill.name,
      version: skill.version,
      business_domain: skill.business_domain || '',
      description: skill.description,
      trigger_intents: skill.trigger_intents || [],
      user_utterance_examples: skill.user_utterance_examples || [],
      goal: skill.goal || [],
      required_info: skill.required_info || [],
      interruption_policy: skill.interruption_policy || {},
      response_rules: skill.response_rules || [],
    });
  }
  const stepIndex = stepIndexFromPath(path);
  if (stepIndex === null) return '';
  return JSON.stringify(skillGraphSteps(skill)[stepIndex] || null);
}

export function collectTextDiffs(previousDraft: SkillCard, nextDraft: SkillCard, changedPaths: string[]): TextDiffAnimation[] {
  const diffs: TextDiffAnimation[] = [];
  const paths = changedPaths.includes('all') ? allTargetPaths(nextDraft) : changedPaths;
  paths.forEach((path) => {
    if (path === 'basic') {
      [
        'skill_id',
        'name',
        'version',
        'business_domain',
        'description',
        'trigger_intents',
        'user_utterance_examples',
        'goal',
        'required_info',
        'response_rules',
      ].forEach((field) => {
        const diff = makeTextDiff(
          path,
          field,
          getDisplayField(previousDraft, path, field),
          getDisplayField(nextDraft, path, field),
        );
        if (diff) diffs.push(diff);
      });
      return;
    }
    const stepIndex = stepIndexFromPath(path);
    if (stepIndex === null) return;
    ['step_id', 'type', 'condition', 'name', 'instruction', 'expected_user_info', 'allowed_actions'].forEach((field) => {
      const diff = makeTextDiff(
        path,
        field,
        getDisplayField(previousDraft, path, field),
        getDisplayField(nextDraft, path, field),
      );
      if (diff) diffs.push(diff);
    });
  });
  return diffs;
}

export function makeTextDiff(path: string, field: string, oldText: string, newText: string): TextDiffAnimation | null {
  if (oldText === newText) return null;
  let prefixLength = 0;
  const maxPrefix = Math.min(oldText.length, newText.length);
  while (prefixLength < maxPrefix && oldText[prefixLength] === newText[prefixLength]) {
    prefixLength += 1;
  }
  let suffixLength = 0;
  const maxSuffix = Math.min(oldText.length - prefixLength, newText.length - prefixLength);
  while (
    suffixLength < maxSuffix &&
    oldText[oldText.length - 1 - suffixLength] === newText[newText.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }
  return {
    key: `${path}:${field}`,
    path,
    field,
    prefix: newText.slice(0, prefixLength),
    removed: oldText.slice(prefixLength, oldText.length - suffixLength),
    inserted: newText.slice(prefixLength, newText.length - suffixLength),
    suffix: newText.slice(newText.length - suffixLength),
    phase: 'mark',
    progress: 0,
  };
}

export function getDisplayField(skill: SkillCard, path: string, field: string): string {
  const value =
    path === 'basic'
      ? (skill as unknown as Record<string, unknown>)[field]
      : skillGraphSteps(skill)[stepIndexFromPath(path) ?? -1]?.[field];
  if (Array.isArray(value)) return joinList(value.map(String));
  if (typeof value === 'string') return value;
  return '';
}

export function setTextField(skill: SkillCard, path: string, field: string, value: string): void {
  if (isListField(field)) return;
  if (path === 'basic') {
    (skill as unknown as Record<string, unknown>)[field] = value;
    return;
  }
  const stepIndex = stepIndexFromPath(path);
  if (stepIndex === null) return;
  if (Array.isArray(skill.nodes) && skill.nodes[stepIndex]) {
    const nodeField = field === 'step_id' ? 'node_id' : field;
    skill.nodes[stepIndex][nodeField] = value;
  }
}

export function isListField(field: string): boolean {
  return [
    'trigger_intents',
    'user_utterance_examples',
    'goal',
    'required_info',
    'response_rules',
    'expected_user_info',
    'allowed_actions',
  ].includes(field);
}

export function typedDraft(previousDraft: SkillCard, nextDraft: SkillCard, diffs: TextDiffAnimation[], progress: number): SkillCard {
  const output = cloneSkill(previousDraft);
  diffs.forEach((diff) => {
    const typedInsert = diff.inserted.slice(0, Math.ceil(diff.inserted.length * progress));
    setTextField(output, diff.path, diff.field, `${diff.prefix}${typedInsert}${diff.suffix}`);
  });
  if (progress >= 1) return cloneSkill(nextDraft);
  return output;
}

export function bumpSkillVersion(version: string): string {
  const parts = version.split('.').map((item) => Number.parseInt(item, 10));
  const major = Number.isFinite(parts[0]) ? parts[0] : 1;
  const minor = Number.isFinite(parts[1]) ? parts[1] : 0;
  return `${major}.${minor + 1}.0`;
}

export function buildToolDescriptionMap(tools: ToolRead[], messages: ChatItem[] = []): ToolDescriptionMap {
  const descriptions = tools.reduce<ToolDescriptionMap>((acc, tool) => {
    acc[tool.name] = [tool.display_name, tool.description].filter(Boolean).join('：') || tool.name;
    return acc;
  }, {});
  messages.flatMap((item) => item.toolSuggestions || []).forEach((suggestion) => {
    const label = suggestion.display_name || suggestion.name;
    descriptions[suggestion.name] = [label, suggestion.description || suggestion.reason].filter(Boolean).join('：') || suggestion.name;
    if (suggestion.matched_tool_name) {
      descriptions[suggestion.matched_tool_name] = descriptions[suggestion.name];
    }
  });
  return descriptions;
}

export function buildToolStatusMap(tools: ToolRead[], messages: ChatItem[]): ToolStatusMap {
  const statuses = tools.reduce<ToolStatusMap>((acc, tool) => {
    acc[tool.name] = 'existing';
    return acc;
  }, {});
  messages.flatMap((item) => item.toolSuggestions || []).forEach((suggestion) => {
    const resolution = toolSuggestionResolution(suggestion);
    const status: ToolActionStatus =
      resolution === 'existing'
        ? 'existing'
        : resolution === 'incomplete'
          ? 'incomplete'
          : suggestion.status === 'accepted' || suggestion.status === 'created' || suggestion.status === 'rejected'
            ? suggestion.status
            : 'pending';
    statuses[suggestion.name] = status;
    if (suggestion.matched_tool_name) statuses[suggestion.matched_tool_name] = status;
  });
  return statuses;
}

export function toolPayloadFromSuggestion(suggestion: ToolSuggestionItem, skillId?: string): Record<string, unknown> {
  const outputSchema = suggestion.probe_result?.success && suggestion.probe_result.inferred_output_schema
    ? suggestion.probe_result.inferred_output_schema
    : suggestion.output_schema || {};
  return {
    tenant_id: TENANT_ID,
    name: suggestion.name,
    display_name: suggestion.display_name || suggestion.name,
    description: suggestion.description || suggestion.reason || '',
    bucket: suggestion.bucket || '技能自发现工具',
    tool_type: suggestion.tool_type || 'http',
    method: suggestion.method || 'POST',
    url: suggestion.url || `/api/mock/${suggestion.name.replace(/\./g, '/')}`,
    headers: {},
    auth: {},
    mcp_config: suggestion.tool_type === 'mcp' ? suggestion.mcp_config || {} : {},
    input_schema: suggestion.input_schema || {},
    output_schema: outputSchema,
    allowed_skills: skillId ? [skillId] : [],
    enabled: true,
  };
}

export function toolReadFromSuggestion(suggestion: ToolSuggestionItem, skillId?: string): ToolRead {
  const outputSchema = suggestion.probe_result?.success && suggestion.probe_result.inferred_output_schema
    ? suggestion.probe_result.inferred_output_schema
    : suggestion.output_schema || {};
  return {
    id: suggestion.name,
    tenant_id: TENANT_ID,
    name: suggestion.name,
    display_name: suggestion.display_name || suggestion.name,
    description: suggestion.description || suggestion.reason || '',
    bucket: suggestion.bucket || '技能自发现工具',
    tool_type: suggestion.tool_type || 'http',
    method: suggestion.method || 'POST',
    url: suggestion.url || `/api/mock/${suggestion.name.replace(/\./g, '/')}`,
    headers: {},
    auth: {},
    mcp_config: suggestion.tool_type === 'mcp' ? suggestion.mcp_config || {} : {},
    input_schema: suggestion.input_schema || {},
    output_schema: outputSchema,
    allowed_skills: skillId ? [skillId] : [],
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function upsertToolRead(current: ToolRead[], nextTool: ToolRead): ToolRead[] {
  const exists = current.some((tool) => tool.name === nextTool.name);
  return exists
    ? current.map((tool) => (tool.name === nextTool.name ? { ...tool, ...nextTool, id: nextTool.id || tool.id } : tool))
    : [...current, nextTool];
}

export function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    skill_id: '技能 ID',
    name: '名称',
    version: '版本',
    business_domain: '业务域',
    description: '描述',
    trigger_intents: '触发意图',
    user_utterance_examples: '示例话术',
    goal: '目标',
    required_info: '必填信息',
    response_rules: '回复规则',
    step_id: '节点 ID',
    type: '节点类型',
    condition: '条件',
    instruction: '节点说明',
    expected_user_info: '期望字段',
    allowed_actions: '允许动作',
  };
  return labels[field] || field;
}

export function toolNameFromAction(action: string): string {
  return action.startsWith('call_tool:') ? action.replace(/^call_tool:/, '').trim() : '';
}

export function actionLabel(action: string): string {
  const toolName = toolNameFromAction(action);
  if (toolName) return `调用工具：${toolName}`;
  return BASE_ACTION_OPTIONS.find((item) => item.value === action)?.label || action;
}

export function buildActionOptions(
  toolDescriptions: ToolDescriptionMap,
  toolStatuses: ToolStatusMap,
  steps: Array<Record<string, unknown>>,
): SelectOption[] {
  const toolNames = Array.from(new Set([
    ...Object.keys(toolDescriptions),
    ...Object.keys(toolStatuses),
  ])).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const toolOptions = toolNames.map((toolName) => ({
    value: `call_tool:${toolName}`,
    label: `调用工具：${toolName}`,
  }));
  const currentActionOptions = steps
    .flatMap((step) => asStringList(step.allowed_actions))
    .filter(Boolean)
    .map((action) => ({ value: action, label: actionLabel(action) }));
  return mergeSelectOptions(BASE_ACTION_OPTIONS, toolOptions, currentActionOptions);
}

export function mergeSelectOptions(...groups: SelectOption[][]): SelectOption[] {
  const seen = new Set<string>();
  const output: SelectOption[] = [];
  groups.flat().forEach((option) => {
    if (!option.value || seen.has(option.value)) return;
    seen.add(option.value);
    output.push(option);
  });
  return output;
}

export function conditionPresetValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'always' || trimmed === 'true') return '__always__';
  if (CONDITION_PRESET_OPTIONS.some((option) => option.value === trimmed)) return trimmed;
  const naturalMatch = Object.entries(CONDITION_PRESET_TEXT).find(([, text]) => text === trimmed);
  if (naturalMatch) return naturalMatch[0];
  return '__custom__';
}

export function conditionFromPreset(value: string): string {
  if (value === '__always__') return '';
  return CONDITION_PRESET_TEXT[value] || '';
}

export function conditionNaturalText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'always' || trimmed === 'true') return '';
  if (CONDITION_PRESET_TEXT[trimmed]) return CONDITION_PRESET_TEXT[trimmed];
  const presetMatch = Object.entries(CONDITION_PRESET_TEXT).find(([, text]) => text === trimmed);
  if (presetMatch) return presetMatch[1];
  return trimmed;
}

export function conditionReadableText(value: string): string {
  const natural = conditionNaturalText(value);
  return natural ? `模型理解：${natural}。` : '模型理解：没有额外限制，流程可以从这里继续。';
}

export function flowRuleConditionText(value: string): string {
  const natural = conditionNaturalText(value);
  return natural ? `进入条件：${natural}。` : '进入条件：总是进入。';
}

export function diffTargetLabel(path: string, skill: SkillCard | null): string {
  if (!skill) return path;
  return targetLabel([path], skill);
}

export function targetLabel(paths: string[], skill: SkillCard): string {
  const labels = paths.map((path) => {
    if (path === 'basic') return '基础信息';
    const stepIndex = stepIndexFromPath(path);
    if (stepIndex !== null) {
      const index = stepIndex;
      const step = index >= 0 ? skillGraphSteps(skill)[index] : null;
      return step ? `节点 ${index + 1}：${step.name || step.step_id || path}` : path;
    }
    return path;
  });
  return labels.join('、');
}

export function stepTargetPath(index: number): string {
  return `nodes[${index}]`;
}

export function stepIndexFromPath(path: string): number | null {
  const match = path.match(/^nodes\[(\d+)\]$/);
  return match ? Number(match[1]) : null;
}

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

import { ActiveDistillJob, BASE_ACTION_OPTIONS, CONDITION_PRESET_OPTIONS, CONDITION_PRESET_TEXT, ChatAttachment, ChatItem, DEFAULT_DISTILL_MESSAGES, DEFAULT_TARGET_PATHS, DISTILL_REWRITE_MODEL_STORAGE_KEY, DistillCacheSnapshot, DistillHistoryOperation, DistillHistoryOperationKind, DistillHistorySnapshot, DistillPageProps, ENTERPRISE_AGENT_STORAGE_KEY, EditingMessage, NODE_TYPE_OPTIONS, PendingChange, ProbeToolOptions, RETRY_STRATEGY_OPTIONS, SelectOption, TargetSelection, TextDiffAnimation, TextDiffPhase, ToolActionStatus, ToolDescriptionMap, ToolStatusMap, ToolSuggestionItem, UploadAttachment, ViewMode } from '../types';
import { ActionChip, ActionCombobox, ActionDiffList, ActionList, AutoGrowTextarea, CopyGlyph, DistillSectionCard, DistillTag, EditableActionList, EditableConditionLine, EditableFlowRulesLine, EditableRetryPolicyLine, EditableSourceActionLine, EditableSourceField, EditableSourceHeading, EditableSourceListLine, EditableSourceSelectLine, EditableSourceStepHeading, EditableSourceTextLine, EmptyState, FlowMetaRow, InlineDiffText, KDialog, PencilGlyph, PlainChipList, SaveReviewDiffValue, SelectableTarget, SimpleTooltip, SkillFlow, SkillFlowCanvasEdge, SkillFlowCanvasNode, SkillFlowNodeCard, SkillSource, SourceInput, SourceJsonLine, SourceNumberInput, SourceReadonlyLine, SourceSelect, actionLabel, actionsFromDiffText, allTargetPaths, applyArrayPreview, applyStringPreview, asStringList, attachmentTypeLabel, avoidFlowLabelOverlap, blankSkillForAnimation, buildActionOptions, buildDisplayAttachments, buildEditedOutgoingText, buildOutgoingText, buildSkillFlowCanvasLayout, buildSkillFlowLayout, buildToolDescriptionMap, buildToolStatusMap, bumpSkillVersion, clampNumber, cloneSkill, cloneSkillRead, collectRollbackOperations, collectTextDiffs, compactEdgeLabel, compactInputStyle, compactWarningItems, comparableSkillContent, conditionFromPreset, conditionNaturalText, conditionPresetValue, conditionReadableText, createStreamingDraftSeed, decodeJsonString, diffFullNewValue, diffFullOldValue, diffTargetLabel, diffTargetPaths, edgeDisplayLabel, edgeLaneY, edgePriority, edgeTargetName, escapeRegExp, extractDraftSkillSource, extractJsonCandidate, extractJsonStringArrayField, extractJsonStringField, extractNodePreview, extractObjectFragmentsFromArrayField, extractQuotedJsonStrings, fieldLabel, fileToBase64, filenameTitle, findBalancedEnd, findFieldValueStart, findSourceEdgeIndex, flowEdgeDisplayLabel, flowLabelOverlapsNode, flowRuleConditionText, formatMessageTime, forwardEdgeLabelPosition, forwardFlowPath, forwardRouteHitsNode, getDisplayField, hasDuplicateOutgoingEdgeLabel, hasDuplicateSiblingEdgeLabel, hasReadableSourceObject, hasSelectedText, hasSkillContentChanges, incomingEdgeLabel, integrateToolSuggestionsIntoDraft, isBlankDistillWorkspace, isListField, isRecord, joinList, joinPlain, knowledgeScopeLabels, lockNullableSkillIdForDraft, lockPendingChangeSkillId, lockSkillIdForDraft, makeTextDiff, mergePaths, mergeSelectOptions, nodeDisplayNameById, nodeIdAt, nodeTypeLabel, normalizeEdgePreview, normalizeInitialSelectedPaths, normalizeNodePreview, normalizeSkillEdges, normalizeSkillNodes, normalizeToolSuggestions, normalizedEdgeLabel, outgoingRouteCountLabel, parseCompleteStreamSkill, parseInitialSkillPrompt, parseJsonObject, parseNodeFragment, previewSkillFromStream, previewSourceText, readDistillCache, reconcileSelectedPaths, rectsOverlap, removeDistillCache, removeToolActionFromSkill, retryPolicyNumber, retryPolicyString, retryStrategyLabel, returnEdgeLabelPosition, sectionSignature, segmentHitsFlowNode, setTextField, sideForwardEdgeLabelPosition, sideForwardFlowPath, sideForwardLaneX, sideReturnFlowPath, skillGraphEdgeMap, skillGraphSteps, skipWhitespace, slugSegment, sourceEdgeSummary, sourceInputStyle, splitEditableList, stepIndexFromPath, stepTargetPath, stringRecord, stringValue, stripUploadContent, targetLabel, toolNameFromAction, toolPayloadFromSuggestion, toolReadFromSuggestion, toolSuggestionResolution, toolSuggestionResolutionLabel, toolSuggestionResolutionValue, toolSuggestionSelectionsComplete, toolSuggestionStatusClass, toolSuggestionStatusText, toolSuggestionTargetIndexes, toolSuggestionTitle, typedDraft, uniqueDraftSkillId, uniqueNodeId, uploadContentMarker, upsertToolRead, visibleChatContent, visualTextWidth, writeDistillCache } from '../parts';

export default function DistillPage({ active = true, searchParamsOverride, currentUser, onLogout }: DistillPageProps = {}) {
  const navigate = useNavigate();
  const [routerSearchParams] = useSearchParams();
  const searchParams = searchParamsOverride || routerSearchParams;
  const skillId = searchParams.get('skill_id');
  const mode = searchParams.get('mode') || '';
  const [selectedAgentId, setSelectedAgentId] = useState(() => window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '');
  const activeAgentId = searchParams.get('agent_id') || selectedAgentId;
  const agentQuery = activeAgentId ? `&agent_id=${encodeURIComponent(activeAgentId)}` : '';
  const agentSearchParam = activeAgentId ? `agent_id=${encodeURIComponent(activeAgentId)}` : '';
  const agentOnlyQuery = agentSearchParam ? `?${agentSearchParam}` : '';
  const cacheKey = `skill-distill:${TENANT_ID}:${activeAgentId || 'default'}:${skillId || mode || 'new'}`;
  const [draft, setDraft] = useState<SkillCard | null>(null);
  const [loadedSkill, setLoadedSkill] = useState<SkillRead | null>(null);
  const [lastSavedDraft, setLastSavedDraft] = useState<SkillCard | null>(null);
  const [messages, setMessages] = useState<ChatItem[]>(DEFAULT_DISTILL_MESSAGES);
  const [input, setInput] = useState('');
  const [selectedPaths, setSelectedPaths] = useState<string[]>(DEFAULT_TARGET_PATHS);
  const [highlightedPaths, setHighlightedPaths] = useState<string[]>([]);
  const [updatingPaths, setUpdatingPaths] = useState<string[]>([]);
  const [dirtyPaths, setDirtyPaths] = useState<string[]>([]);
  const [textDiffs, setTextDiffs] = useState<TextDiffAnimation[]>([]);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [saveReviewOpen, setSaveReviewOpen] = useState(false);
  const [saveDraftSnapshot, setSaveDraftSnapshot] = useState<SkillCard | null>(null);
  const [saveName, setSaveName] = useState('');
  const [saveDomain, setSaveDomain] = useState('');
  const [saveVersion, setSaveVersion] = useState('');
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearAfterSave, setClearAfterSave] = useState(false);
  const [clearNewConfirm, setClearNewConfirm] = useState<{ title: string; description: string } | null>(null);
  const [rerunConfirm, setRerunConfirm] = useState<{
    index: number;
    snapshot: DistillHistorySnapshot;
    rollbackOperations: DistillHistoryOperation[];
    text: string;
    outgoingText: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('source');
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<UploadAttachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [toolDetail, setToolDetail] = useState<ToolSuggestionItem | null>(null);
  const [toolDetailMessageId, setToolDetailMessageId] = useState<string | null>(null);
  const [probeArgsText, setProbeArgsText] = useState('');
  const [tools, setTools] = useState<ToolRead[]>([]);
  const [modelConfigs, setModelConfigs] = useState<ModelConfigRead[]>([]);
  const [selectedRewriteModelId, setSelectedRewriteModelId] = useState(
    () => window.localStorage.getItem(`${DISTILL_REWRITE_MODEL_STORAGE_KEY}:${TENANT_ID}`) || '',
  );
  const [streamStatus, setStreamStatus] = useState('');
  const [activeJob, setActiveJob] = useState<ActiveDistillJob | null>(null);
  const [editingMessage, setEditingMessage] = useState<EditingMessage | null>(null);
  const [sourceAutoScroll, setSourceAutoScroll] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const manualStopRef = useRef(false);
  const uploadControllersRef = useRef<Record<string, AbortController>>({});
  const dragDepthRef = useRef(0);
  const animationTimersRef = useRef<number[]>([]);
  const sourceScrollRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const [cacheReady, setCacheReady] = useState(false);
  const [hydratedCacheKey, setHydratedCacheKey] = useState('');

  useEffect(() => {
    const onScopeChange = (event: Event) => {
      const agentId = (event as CustomEvent<{ agentId?: string }>).detail?.agentId || '';
      setSelectedAgentId(agentId || window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '');
    };
    window.addEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
    return () => window.removeEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
  }, []);

  useEffect(() => {
    setCacheReady(false);
    setHydratedCacheKey('');
    const cached = readDistillCache(cacheKey);
    if (cached) {
      if (skillId && isBlankDistillWorkspace(cached)) {
        removeDistillCache(cacheKey);
      } else {
        const cachedLockedSkillId = cached.loadedSkill?.skill_id || skillId || '';
        setDraft(lockNullableSkillIdForDraft(cached.draft, cachedLockedSkillId));
        setLoadedSkill(cached.loadedSkill);
        setLastSavedDraft(lockNullableSkillIdForDraft(cached.lastSavedDraft, cachedLockedSkillId));
        setMessages(cached.messages.length > 0 ? cached.messages : DEFAULT_DISTILL_MESSAGES);
        setInput(cached.input);
        setSelectedPaths(normalizeInitialSelectedPaths(cached.selectedPaths));
        setHighlightedPaths(cached.highlightedPaths);
        setUpdatingPaths(cached.updatingPaths);
        setDirtyPaths(cached.dirtyPaths);
        setTextDiffs(cached.textDiffs);
        setPendingChange(lockPendingChangeSkillId(cached.pendingChange, cachedLockedSkillId));
        setViewMode(cached.viewMode || 'source');
        setAttachments(cached.attachments.filter((item) => item.status !== 'uploading'));
        setStreamStatus(cached.streamStatus);
        setActiveJob(cached.activeJob || null);
        if (cached.activeJob && cached.activeJob.status !== 'succeeded' && cached.activeJob.status !== 'failed') {
          setLoading(true);
        }
        setSaveDraftSnapshot(null);
        setHydratedCacheKey(cacheKey);
        setCacheReady(true);
        return;
      }
    }

    if (!skillId) {
      setDraft(null);
      setLoadedSkill(null);
      setLastSavedDraft(null);
      setMessages(DEFAULT_DISTILL_MESSAGES);
      setInput('');
      setSelectedPaths(DEFAULT_TARGET_PATHS);
      setPendingChange(null);
      setHighlightedPaths([]);
      setUpdatingPaths([]);
      setDirtyPaths([]);
      setTextDiffs([]);
      setAttachments([]);
      setStreamStatus('');
      setSaveDraftSnapshot(null);
      setHydratedCacheKey(cacheKey);
      setCacheReady(true);
      return;
    }

    api
      .get<SkillRead>(`/api/enterprise/skills/${encodeURIComponent(skillId)}?tenant_id=${TENANT_ID}${agentQuery}`)
      .then((result) => {
        const nextContent = lockSkillIdForDraft(result.content, result.skill_id || skillId || '');
        const nextResult = nextContent === result.content ? result : { ...result, content: nextContent };
        setDraft(nextContent);
        setLoadedSkill(nextResult);
        setLastSavedDraft(nextContent);
        setSelectedPaths(DEFAULT_TARGET_PATHS);
        setPendingChange(null);
        setHighlightedPaths([]);
        setUpdatingPaths([]);
        setDirtyPaths([]);
        setTextDiffs([]);
        setAttachments([]);
        setStreamStatus('');
        setSaveDraftSnapshot(null);
        setMessages([
          {
            id: 'loaded',
            role: 'assistant',
            content: `已加載「${result.name}」。你可以在右側選擇一個或多個區域，然後在這裡描述需要怎樣改寫。`,
          },
        ]);
        setHydratedCacheKey(cacheKey);
        setCacheReady(true);
      })
      .catch((error) => {
        notify.error(error instanceof Error ? error.message : '加載技能失敗');
        setHydratedCacheKey(cacheKey);
        setCacheReady(true);
      });
  }, [agentQuery, cacheKey, skillId]);

  useEffect(() => {
    if (!cacheReady || hydratedCacheKey !== cacheKey) return;
    writeDistillCache(cacheKey, {
      draft,
      loadedSkill,
      lastSavedDraft,
      messages,
      input,
      selectedPaths,
      highlightedPaths,
      updatingPaths,
      dirtyPaths,
      textDiffs,
      pendingChange,
      viewMode,
      attachments: attachments.filter((item) => item.status !== 'uploading'),
      streamStatus,
      activeJob,
    });
  }, [
    attachments,
    cacheKey,
    cacheReady,
    dirtyPaths,
    draft,
    highlightedPaths,
    hydratedCacheKey,
    input,
    lastSavedDraft,
    loadedSkill,
    loading,
    messages,
    pendingChange,
    selectedPaths,
    streamStatus,
    activeJob,
    textDiffs,
    updatingPaths,
    viewMode,
  ]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      Object.values(uploadControllersRef.current).forEach((controller) => controller.abort());
      clearAnimationTimers();
    };
  }, []);

  useEffect(() => {
    if (!cacheReady || hydratedCacheKey !== cacheKey || !activeJob) return;
    if (activeJob.status === 'succeeded' || activeJob.status === 'failed') return;
    if (abortRef.current) return;
    const controller = new AbortController();
    manualStopRef.current = false;
    abortRef.current = controller;
    setLoading(true);
    void streamGet(
      `/api/enterprise/skills/jobs/${encodeURIComponent(activeJob.jobId)}/stream?after_seq=${activeJob.lastSeq || 0}`,
      (item) => handleResumedJobEvent(activeJob, item),
      controller.signal,
    )
      .catch((error) => {
        if (controller.signal.aborted) return;
        updateMessage(activeJob.assistantId, '生成連接已斷開，後端任務仍可繼續。', { thinking: 'done' });
        notify.error(error instanceof Error ? error.message : '恢復生成失敗');
      })
      .finally(() => finishStream(controller));
  }, [activeJob, cacheKey, cacheReady, hydratedCacheKey]);

  useEffect(() => {
    if (!active) {
      document.body.classList.remove('skill-distill-fixed');
      return;
    }
    document.body.classList.add('skill-distill-fixed');
    return () => {
      document.body.classList.remove('skill-distill-fixed');
    };
  }, [active]);

  useEffect(() => {
    api
      .get<ToolRead[]>(`/api/enterprise/tools?tenant_id=${TENANT_ID}${agentQuery}`)
      .then(setTools)
      .catch(() => setTools([]));
  }, [agentQuery]);

  useEffect(() => {
    api
      .get<ModelConfigRead[]>(`/api/enterprise/model-configs?tenant_id=${TENANT_ID}`)
      .then((rows) => {
        const enabled = rows.filter((item) => item.enabled);
        setModelConfigs(enabled);
        setSelectedRewriteModelId((current) => {
          if (current && enabled.some((item) => item.id === current)) return current;
          const fallback = enabled.find((item) => item.is_default)?.id || enabled[0]?.id || '';
          if (fallback) {
            window.localStorage.setItem(`${DISTILL_REWRITE_MODEL_STORAGE_KEY}:${TENANT_ID}`, fallback);
          }
          return fallback;
        });
      })
      .catch(() => setModelConfigs([]));
  }, []);

  useEffect(() => {
    if (!chatMessagesRef.current) return;
    chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
  }, [attachments, loading, messages]);

  useEffect(() => {
    if (!loading || !sourceAutoScroll || !sourceScrollRef.current) return;
    sourceScrollRef.current.scrollTop = sourceScrollRef.current.scrollHeight;
  }, [draft, loading, sourceAutoScroll, textDiffs, viewMode]);

  const allPaths = useMemo(() => (draft ? allTargetPaths(draft) : DEFAULT_TARGET_PATHS), [draft]);
  const uploadingFile = attachments.some((item) => item.status === 'uploading');
  const readyAttachments = attachments.filter((item) => item.status === 'ready' && item.text?.trim());
  const allSelected = draft ? selectedPaths.length > 0 && allPaths.every((path) => selectedPaths.includes(path)) : false;
  const toolDescriptions = useMemo(() => buildToolDescriptionMap(tools, messages), [messages, tools]);
  const toolStatuses = useMemo(() => buildToolStatusMap(tools, messages), [messages, tools]);
  const lockedSkillId = loadedSkill?.skill_id || skillId || '';
  const saveReviewDraft = useMemo(() => {
    const sourceDraft = saveDraftSnapshot || draft;
    if (!sourceDraft) return null;
    const nextDraft = {
      ...cloneSkill(sourceDraft),
      name: saveName.trim() || sourceDraft.name,
      business_domain: saveDomain.trim() || undefined,
      version: saveVersion.trim() || sourceDraft.version,
    };
    return lockSkillIdForDraft(nextDraft, lockedSkillId);
  }, [draft, lockedSkillId, saveDomain, saveDraftSnapshot, saveName, saveVersion]);
  const saveReviewDiffs = useMemo(() => {
    if (!saveReviewDraft) return [];
    const baseDraft = lastSavedDraft || blankSkillForAnimation(saveReviewDraft);
    const changedPaths = diffTargetPaths(baseDraft, saveReviewDraft, allTargetPaths(saveReviewDraft));
    return collectTextDiffs(baseDraft, saveReviewDraft, changedPaths).filter((diff) => diff.field !== 'version');
  }, [lastSavedDraft, saveReviewDraft]);
  const hasSaveableDraftChanges = useMemo(
    () => hasSkillContentChanges(lockNullableSkillIdForDraft(pendingChange?.nextDraft || draft, lockedSkillId), lastSavedDraft),
    [draft, lastSavedDraft, lockedSkillId, pendingChange],
  );
  const saveReviewHasContentChanges = useMemo(
    () => hasSkillContentChanges(saveReviewDraft, lastSavedDraft),
    [lastSavedDraft, saveReviewDraft],
  );

  useEffect(() => {
    if (!lockedSkillId) return;
    setDraft((current) => lockNullableSkillIdForDraft(current, lockedSkillId));
    setLastSavedDraft((current) => lockNullableSkillIdForDraft(current, lockedSkillId));
    setSaveDraftSnapshot((current) => lockNullableSkillIdForDraft(current, lockedSkillId));
    setPendingChange((current) => lockPendingChangeSkillId(current, lockedSkillId));
  }, [lockedSkillId]);

  async function send() {
    const text = buildOutgoingText(input, readyAttachments);
    if (!text || loading || uploadingFile) return;
    const displayText = input.trim();
    const displayAttachments = buildDisplayAttachments(readyAttachments);
    const snapshotBefore = createHistorySnapshot();
    const confirmedDraft = lockNullableSkillIdForDraft(pendingChange?.nextDraft || draft, lockedSkillId);
    confirmPendingChange(false);
    setInput('');
    setAttachments([]);
    pushMessage('user', displayText, { attachments: displayAttachments, outgoingText: text, snapshotBefore });
    if (!confirmedDraft) {
      await createDraftFromText(text);
      return;
    }
    await rewriteSelectedTarget(text, confirmedDraft);
  }

  async function createDraftFromText(text: string) {
    const payload = parseInitialSkillPrompt(text);
    setLoading(true);
    setSourceAutoScroll(true);
    setStreamStatus('正在生成 SOP 草稿');
    let streamBuffer = '';
    let latestPreview = createStreamingDraftSeed(payload);
    let latestPreviewSignature = JSON.stringify(latestPreview);
    setDraft(latestPreview);
    setSelectedPaths(DEFAULT_TARGET_PATHS);
    setHighlightedPaths([]);
    setUpdatingPaths([]);
    setTextDiffs([]);
    const assistantId = pushMessage('assistant', '', {
      thinking: 'running',
      thinkingDetails: ['正在理解技能目標與輸入信息'],
      thinkingOpen: false,
    });
    const baseJob: ActiveDistillJob = {
      jobId: '',
      kind: 'distill',
      assistantId,
      lastSeq: 0,
      status: 'queued',
      createPayload: payload,
    };
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamPost(
        '/api/enterprise/skills/distill/stream',
        { tenant_id: TENANT_ID, ...payload, model_config_id: selectedRewriteModelId || undefined },
        (item) => {
          trackActiveJobEvent(item, baseJob);
          if (item.event === 'status') {
            appendThinkingDetail(assistantId, String(item.data.text || '正在處理'));
            return;
          }
          if (item.event === 'chunk_reset') {
            streamBuffer = '';
            latestPreview = createStreamingDraftSeed(payload);
            latestPreviewSignature = JSON.stringify(latestPreview);
            setDraft(latestPreview);
            return;
          }
          if (item.event === 'chunk') {
            const content = typeof item.data.content === 'string' ? item.data.content : '';
            if (!content) return;
            streamBuffer += content;
            const preview = previewSkillFromStream(streamBuffer, latestPreview, payload);
            const previewSignature = JSON.stringify(preview);
            if (previewSignature !== latestPreviewSignature) {
              latestPreview = preview;
              latestPreviewSignature = previewSignature;
              setDraft(preview);
              setStreamStatus('正在解碼技能結構');
            }
            return;
          }
          if (item.event === 'complete') {
            const draftSkill = lockSkillIdForDraft(item.data.draft_skill as SkillCard, lockedSkillId);
            const nextWarnings = Array.isArray(item.data.warnings) ? item.data.warnings.map(String) : [];
            const nextToolSuggestions = normalizeToolSuggestions(item.data.tool_suggestions);
            appendThinkingDetail(assistantId, `已生成 SOP 草稿：${draftSkill.name}`);
            clearAnimationTimers();
            setDraft(draftSkill);
            setHighlightedPaths([]);
            setUpdatingPaths([]);
            setTextDiffs([]);
            setSelectedPaths(DEFAULT_TARGET_PATHS);
            updateMessage(
              assistantId,
              `已生成「${draftSkill.name}」草稿。你可以在右側選擇一個或多個區域繼續改寫。`,
              {
                thinking: 'done',
                warnings: nextWarnings,
                toolSuggestions: nextToolSuggestions,
                operations: [{ kind: 'skill_change', label: `生成 SOP 草稿：${draftSkill.name}`, skillId: draftSkill.skill_id }],
              },
            );
            setStreamStatus('生成完成');
            if (nextToolSuggestions.length > 0) {
              void autoProbeToolSuggestions(assistantId, nextToolSuggestions);
            }
            setActiveJob(null);
            return;
          }
          if (item.event === 'error') {
            updateMessage(assistantId, String(item.data.message || '生成失敗，當前草稿未變更。'), { thinking: 'done' });
            setActiveJob(null);
          }
        },
        controller.signal,
      );
    } catch (error) {
      if (controller.signal.aborted && !manualStopRef.current) return;
      appendThinkingDetail(assistantId, '生成失敗，已保留當前草稿');
      updateMessage(assistantId, '生成失敗，當前草稿未變更。', { thinking: 'done' });
      if (controller.signal.aborted) {
        notify.info('已停止生成');
      } else {
        notify.error(error instanceof Error ? error.message : '生成失敗');
      }
    } finally {
      finishStream(controller);
    }
  }

  async function rewriteSelectedTarget(
    text: string,
    currentDraft: SkillCard | null = draft,
    targetPathsOverride?: string[],
    initialThinkingDetails?: string[],
    conversationOverride?: ChatItem[],
  ) {
    if (!currentDraft) return;
    setSourceAutoScroll(false);
    const editableDraft = lockSkillIdForDraft(currentDraft, lockedSkillId);
    const previousDraft = cloneSkill(editableDraft);
    const targets = targetPathsOverride?.length
      ? targetPathsOverride
      : selectedPaths.length > 0
        ? selectedPaths
        : allTargetPaths(editableDraft);
    const scopeLabel = targetLabel(targets, editableDraft);
    setLoading(true);
    setStreamStatus('正在改寫選中內容');
    const assistantId = pushMessage('assistant', '', {
      thinking: 'running',
      thinkingDetails: initialThinkingDetails || [`改寫範圍：${scopeLabel}`],
      thinkingOpen: false,
    });
    const baseJob: ActiveDistillJob = {
      jobId: '',
      kind: 'rewrite',
      assistantId,
      lastSeq: 0,
      status: 'queued',
      previousDraft,
      targets,
    };
    const controller = new AbortController();
    let receivedMessageChunk = false;
    manualStopRef.current = false;
    abortRef.current = controller;
    try {
      await streamPost(
        `/api/enterprise/skills/${encodeURIComponent(editableDraft.skill_id)}/rewrite/stream`,
        {
          tenant_id: TENANT_ID,
          current_skill: editableDraft,
          instruction: text,
          model_config_id: selectedRewriteModelId || undefined,
          target_path: targets[0],
          target_paths: targets,
          target_label: scopeLabel,
          conversation: (conversationOverride || messages).map((item) => ({ role: item.role, content: item.content })),
        },
        (item) => {
          trackActiveJobEvent(item, baseJob);
          if (item.event === 'status') {
            appendThinkingDetail(assistantId, String(item.data.text || '正在處理'));
            return;
          }
          if (item.event === 'message_chunk') {
            const content = typeof item.data.content === 'string' ? item.data.content : '';
            if (content) {
              receivedMessageChunk = true;
              appendMessage(assistantId, content);
            }
            return;
          }
          if (item.event === 'complete') {
            const nextDraft = lockSkillIdForDraft(item.data.draft_skill as SkillCard, lockedSkillId);
            const nextWarnings = Array.isArray(item.data.warnings) ? item.data.warnings.map(String) : [];
            const nextToolSuggestions = normalizeToolSuggestions(item.data.tool_suggestions);
            const changedPaths = diffTargetPaths(previousDraft, nextDraft, targets);
            const changedLabel = changedPaths.length > 0 ? targetLabel(changedPaths, nextDraft) : '未檢測到結構變化';
            appendThinkingDetail(assistantId, `模型返回改寫結果：${changedLabel}`);
            appendThinkingDetail(assistantId, '右側已更新預覽，等待確認或拒絕');
            animateDraftChange(previousDraft, nextDraft, changedPaths);
            setPendingChange({ assistantId, previousDraft, nextDraft, changedPaths });
            setSelectedPaths((current) => reconcileSelectedPaths(current, nextDraft));
            setStreamStatus('改寫完成');
            if (!receivedMessageChunk) {
              updateMessage(
                assistantId,
                String(item.data.assistant_message || '已完成局部改寫。'),
                {
                  thinking: 'done',
                  warnings: nextWarnings,
                  toolSuggestions: nextToolSuggestions,
                  actionState: 'pending',
                  operations: changedPaths.length
                    ? [{ kind: 'skill_change', label: `改寫：${changedLabel}`, skillId: nextDraft.skill_id }]
                    : [],
                },
              );
            } else {
              updateMessage(assistantId, undefined, {
                thinking: 'done',
                warnings: nextWarnings,
                toolSuggestions: nextToolSuggestions,
                actionState: 'pending',
                operations: changedPaths.length
                  ? [{ kind: 'skill_change', label: `改寫：${changedLabel}`, skillId: nextDraft.skill_id }]
                  : [],
              });
            }
            if (nextToolSuggestions.length > 0) {
              void autoProbeToolSuggestions(assistantId, nextToolSuggestions);
            }
            setActiveJob(null);
            return;
          }
          if (item.event === 'error') {
            updateMessage(assistantId, String(item.data.message || '改寫失敗，當前草稿未變更。'), { thinking: 'done' });
            setActiveJob(null);
          }
        },
        controller.signal,
      );
    } catch (error) {
      if (controller.signal.aborted && !manualStopRef.current) return;
      appendThinkingDetail(assistantId, '改寫失敗，已保留當前草稿');
      updateMessage(assistantId, '改寫失敗，當前草稿未變更。', { thinking: 'done' });
      if (controller.signal.aborted) {
        notify.info('已停止改寫');
      } else {
        notify.error(error instanceof Error ? error.message : '改寫失敗');
      }
    } finally {
      finishStream(controller);
    }
  }

  function openSaveReview(options: { clearAfterSave?: boolean } = {}) {
    const targetDraft = lockNullableSkillIdForDraft(pendingChange?.nextDraft || draft, lockedSkillId);
    if (!targetDraft) return;
    if (!hasSkillContentChanges(targetDraft, lastSavedDraft)) {
      notify.info('當前沒有內容變化，無需保存草稿。');
      return;
    }
    confirmPendingChange(false);
    setClearAfterSave(Boolean(options.clearAfterSave));
    setSaveDraftSnapshot(targetDraft);
    setSaveName(targetDraft.name);
    setSaveDomain(targetDraft.business_domain || '');
    setSaveVersion(loadedSkill ? bumpSkillVersion(loadedSkill.version || targetDraft.version) : '1.0.0');
    setSaveReviewOpen(true);
  }

  async function saveDraft() {
    if (!saveReviewDraft) return;
    if (!hasSkillContentChanges(saveReviewDraft, lastSavedDraft)) {
      notify.info('當前沒有內容變化，無需保存草稿。');
      return;
    }
    let finalDraft: SkillCard = lockSkillIdForDraft(saveReviewDraft, lockedSkillId);
    let renamedSkillId = '';
    try {
      let savedSkill: SkillRead;
      if (loadedSkill) {
        savedSkill = await api.put<SkillRead>(`/api/enterprise/skills/${loadedSkill.skill_id}${agentOnlyQuery}`, {
          tenant_id: TENANT_ID,
          content: finalDraft,
          status: loadedSkill.status,
        });
      } else {
        try {
          savedSkill = await api.post<SkillRead>(`/api/enterprise/skills${agentOnlyQuery}`, { tenant_id: TENANT_ID, content: finalDraft, status: 'published' });
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 409) throw error;
          finalDraft = {
            ...cloneSkill(finalDraft),
            skill_id: uniqueDraftSkillId(finalDraft.skill_id),
          };
          renamedSkillId = finalDraft.skill_id;
          savedSkill = await api.post<SkillRead>(`/api/enterprise/skills${agentOnlyQuery}`, { tenant_id: TENANT_ID, content: finalDraft, status: 'published' });
        }
      }
      const savedContent = lockSkillIdForDraft(savedSkill.content, savedSkill.skill_id || lockedSkillId);
      if (savedContent !== savedSkill.content) {
        savedSkill = { ...savedSkill, content: savedContent };
      }
      setLoadedSkill(savedSkill);
      setDraft(savedContent);
      setLastSavedDraft(savedContent);
      setSaveDraftSnapshot(null);
      setHighlightedPaths([]);
      setDirtyPaths([]);
      setSaveReviewOpen(false);
      appendOperationToLatestMessage({
        kind: 'version_save',
        label: `保存版本 ${savedSkill.version}`,
        skillId: savedSkill.skill_id,
        version: savedSkill.version,
      });
      if (clearAfterSave) {
        setClearAfterSave(false);
        clearDistillWorkspace();
        notify.success('SOP 已保存，當前改寫已清空');
      } else {
        notify.success(renamedSkillId ? `SOP ID 已存在，已另存為 ${renamedSkillId}` : 'SOP 已保存');
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '保存失敗');
    }
  }

  function stopStream() {
    const jobId = activeJob?.jobId;
    manualStopRef.current = true;
    if (jobId) {
      void api.post(`/api/enterprise/skills/jobs/${encodeURIComponent(jobId)}/cancel`);
    }
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setActiveJob(null);
    setStreamStatus('已停止');
  }

  function trackActiveJobEvent(item: { event: string; data: Record<string, unknown> }, baseJob: ActiveDistillJob) {
    const jobId = typeof item.data.job_id === 'string' ? item.data.job_id : baseJob.jobId;
    if (!jobId) return;
    const seq = typeof item.data.seq === 'number' ? item.data.seq : baseJob.lastSeq;
    const status = typeof item.data.status === 'string' ? item.data.status : baseJob.status;
    setActiveJob((current) => ({
      ...baseJob,
      ...(current?.jobId === jobId ? current : {}),
      jobId,
      lastSeq: Math.max(current?.jobId === jobId ? current.lastSeq : 0, seq || 0),
      status,
    }));
  }

  function handleResumedJobEvent(job: ActiveDistillJob, item: { event: string; data: Record<string, unknown> }) {
    trackActiveJobEvent(item, job);
    if (item.event === 'status') {
      appendThinkingDetail(job.assistantId, String(item.data.text || '正在處理'));
      return;
    }
    if (item.event === 'message_chunk') {
      const content = typeof item.data.content === 'string' ? item.data.content : '';
      if (content) appendMessage(job.assistantId, content);
      return;
    }
    if (item.event === 'complete') {
      if (job.kind === 'distill') {
        completeResumedDistillJob(job, item.data);
      } else {
        completeResumedRewriteJob(job, item.data);
      }
      setActiveJob(null);
      return;
    }
    if (item.event === 'error') {
      updateMessage(job.assistantId, String(item.data.message || '生成失敗'), { thinking: 'done' });
      setActiveJob(null);
      setLoading(false);
      return;
    }
    if (item.event === 'job_complete') {
      const status = String(item.data.status || '');
      if (status === 'failed') {
        updateMessage(job.assistantId, String(item.data.error || '生成失敗'), { thinking: 'done' });
        setActiveJob(null);
      }
    }
  }

  function completeResumedDistillJob(job: ActiveDistillJob, data: Record<string, unknown>) {
    const rawDraftSkill = data.draft_skill as SkillCard | undefined;
    if (!rawDraftSkill) return;
    const draftSkill = lockSkillIdForDraft(rawDraftSkill, lockedSkillId);
    const nextWarnings = Array.isArray(data.warnings) ? data.warnings.map(String) : [];
    const nextToolSuggestions = normalizeToolSuggestions(data.tool_suggestions);
    clearAnimationTimers();
    setDraft(draftSkill);
    setHighlightedPaths([]);
    setUpdatingPaths([]);
    setTextDiffs([]);
    setSelectedPaths(DEFAULT_TARGET_PATHS);
    appendThinkingDetail(job.assistantId, `已生成 SOP 草稿：${draftSkill.name}`);
    updateMessage(
      job.assistantId,
      `已生成「${draftSkill.name}」草稿。你可以在右側選擇一個或多個區域繼續改寫。`,
      {
        thinking: 'done',
        warnings: nextWarnings,
        toolSuggestions: nextToolSuggestions,
        operations: [{ kind: 'skill_change', label: `生成 SOP 草稿：${draftSkill.name}`, skillId: draftSkill.skill_id }],
      },
    );
    setStreamStatus('生成完成');
    if (nextToolSuggestions.length > 0) {
      void autoProbeToolSuggestions(job.assistantId, nextToolSuggestions);
    }
  }

  function completeResumedRewriteJob(job: ActiveDistillJob, data: Record<string, unknown>) {
    const rawNextDraft = data.draft_skill as SkillCard | undefined;
    if (!rawNextDraft) return;
    const nextDraft = lockSkillIdForDraft(rawNextDraft, lockedSkillId);
    const previousDraft = lockNullableSkillIdForDraft(job.previousDraft || draft, lockedSkillId);
    if (!previousDraft) {
      setDraft(nextDraft);
      updateMessage(job.assistantId, String(data.assistant_message || '已完成改寫。'), { thinking: 'done' });
      return;
    }
    const targets = job.targets?.length ? job.targets : allTargetPaths(previousDraft);
    const nextWarnings = Array.isArray(data.warnings) ? data.warnings.map(String) : [];
    const nextToolSuggestions = normalizeToolSuggestions(data.tool_suggestions);
    const changedPaths = diffTargetPaths(previousDraft, nextDraft, targets);
    const changedLabel = changedPaths.length > 0 ? targetLabel(changedPaths, nextDraft) : '未檢測到結構變化';
    appendThinkingDetail(job.assistantId, `模型返回改寫結果：${changedLabel}`);
    appendThinkingDetail(job.assistantId, '右側已更新預覽，等待確認或拒絕');
    animateDraftChange(previousDraft, nextDraft, changedPaths);
    setPendingChange({ assistantId: job.assistantId, previousDraft, nextDraft, changedPaths });
    setSelectedPaths((current) => reconcileSelectedPaths(current, nextDraft));
    setStreamStatus('改寫完成');
    updateMessage(job.assistantId, String(data.assistant_message || '已完成局部改寫。'), {
      thinking: 'done',
      warnings: nextWarnings,
      toolSuggestions: nextToolSuggestions,
      actionState: 'pending',
      operations: changedPaths.length
        ? [{ kind: 'skill_change', label: `改寫：${changedLabel}`, skillId: nextDraft.skill_id }]
        : [],
    });
    if (nextToolSuggestions.length > 0) {
      void autoProbeToolSuggestions(job.assistantId, nextToolSuggestions);
    }
  }

  async function stageFileUpload(file: File) {
    if (loading) return;
    const suffix = file.name.toLowerCase().split('.').pop() || '';
    if (!['md', 'txt', 'doc', 'docx'].includes(suffix)) {
      notify.error('僅支持 .md、.doc、.docx、.txt 文件');
      return;
    }
    const id = `file_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const controller = new AbortController();
    uploadControllersRef.current[id] = controller;
    setAttachments((current) => [...current, { id, name: file.name, status: 'uploading' }]);
    try {
      const contentBase64 = await fileToBase64(file);
      if (controller.signal.aborted) return;
      const result = await api.postWithSignal<{ filename: string; text: string }>(
        '/api/enterprise/skills/files/extract',
        {
          filename: file.name,
          content_base64: contentBase64,
        },
        controller.signal,
      );
      setAttachments((current) =>
        current.map((item) =>
          item.id === id ? { id, name: result.filename, status: 'ready', text: result.text } : item,
        ),
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      setAttachments((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, status: 'error', error: error instanceof Error ? error.message : '讀取文件失敗' }
            : item,
        ),
      );
    } finally {
      delete uploadControllersRef.current[id];
    }
  }

  function uploadFiles(files: File[]) {
    files.forEach((file) => {
      void stageFileUpload(file);
    });
  }

  function cancelAttachment(id: string) {
    uploadControllersRef.current[id]?.abort();
    delete uploadControllersRef.current[id];
    setAttachments((current) => current.filter((item) => item.id !== id));
  }

  function handleComposerPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files || []);
    if (files.length === 0) return;
    event.preventDefault();
    uploadFiles(files);
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current += 1;
    if (event.dataTransfer.types.includes('Files')) setDragActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    uploadFiles(Array.from(event.dataTransfer.files || []));
  }

  function openToolDetail(messageId: string, suggestion: ToolSuggestionItem) {
    setToolDetailMessageId(messageId);
    setToolDetail(suggestion);
    setProbeArgsText(JSON.stringify(suggestion.sample_arguments || {}, null, 2));
  }

  async function autoProbeToolSuggestions(messageId: string, suggestions: ToolSuggestionItem[]) {
    const extractedSuggestions = suggestions.filter((suggestion) => suggestion.resolution_status !== 'incomplete');
    const pendingSuggestions = suggestions.filter(
      (suggestion) => toolSuggestionResolution(suggestion) === 'new_candidate' && !suggestion.probe_result,
    );
    if (extractedSuggestions.length === 0) return;

    appendThinkingDetail(
      messageId,
      `正在抽取工具：${extractedSuggestions.map((item) => item.display_name || item.name).join('、')}`,
    );
    const existingSuggestions = suggestions.filter((suggestion) => toolSuggestionResolution(suggestion) === 'existing');
    existingSuggestions.forEach((suggestion) => {
      appendThinkingDetail(messageId, `已匹配現有工具：${suggestion.matched_tool_display_name || suggestion.display_name || suggestion.name}`);
    });
    if (pendingSuggestions.length === 0) return;
    appendThinkingDetail(messageId, '正在測試工具接口');
    setStreamStatus('正在測試工具接口');

    let successCount = 0;
    let failureCount = 0;
    for (const suggestion of pendingSuggestions) {
      const result = await probeToolSuggestion(messageId, suggestion, {
        silent: true,
        allowWhileLoading: true,
      });
      if (!result) {
        failureCount += 1;
        appendThinkingDetail(messageId, `工具測試失敗：${suggestion.display_name || suggestion.name}`);
        continue;
      }
      if (result.success) {
        successCount += 1;
        appendThinkingDetail(messageId, `工具測試成功：${suggestion.display_name || suggestion.name}`);
      } else {
        failureCount += 1;
        const reason = result.error?.message ? `，${result.error.message}` : '';
        appendThinkingDetail(messageId, `工具測試失敗：${suggestion.display_name || suggestion.name}${reason}`);
      }
    }

    appendThinkingDetail(messageId, `工具測試完成：${successCount} 個成功，${failureCount} 個失敗`);
    setStreamStatus('工具測試完成');
  }

  async function probeToolSuggestion(
    messageId: string,
    suggestion: ToolSuggestionItem,
    options: ProbeToolOptions = {},
  ): Promise<ToolProbeResponse | null> {
    if (toolSuggestionResolution(suggestion) !== 'new_candidate') return null;
    if ((!options.allowWhileLoading && loading) || suggestion.probeStatus === 'probing') return null;
    const args = options.sampleArguments || suggestion.sample_arguments || {};
    if (Object.keys(args).length === 0) {
      if (!options.silent) notify.warning('缺少樣例參數，無法測試接口');
      const result: ToolProbeResponse = {
        success: false,
        inferred_output_schema: {},
        error: { code: 'MISSING_SAMPLE_ARGUMENTS', message: '缺少樣例參數，無法測試接口' },
      };
      setToolSuggestionPatch(messageId, suggestion.name, { probeStatus: 'error', probe_result: result });
      return result;
    }
    setToolSuggestionPatch(messageId, suggestion.name, { probeStatus: 'probing' });
    try {
      const payload = {
        ...toolPayloadFromSuggestion(suggestion, lockNullableSkillIdForDraft(pendingChange?.nextDraft || draft, lockedSkillId)?.skill_id),
        sample_arguments: args,
      };
      const result = await api.post<ToolProbeResponse>('/api/enterprise/tools/probe', payload);
      const nextOutputSchema = result.success && result.inferred_output_schema
        ? result.inferred_output_schema
        : suggestion.output_schema;
      setToolSuggestionPatch(messageId, suggestion.name, {
        probeStatus: result.success ? 'success' : 'error',
        probe_result: result,
        sample_arguments: args,
        output_schema: nextOutputSchema || {},
      });
      if (result.success) {
        if (!options.silent) notify.success('接口測試成功');
      } else {
        if (!options.silent) notify.error(result.error?.message || '接口測試失敗');
      }
      return result;
    } catch (error) {
      const result: ToolProbeResponse = {
        success: false,
        inferred_output_schema: {},
        error: { code: 'CLIENT_ERROR', message: error instanceof Error ? error.message : '接口測試失敗' },
      };
      setToolSuggestionPatch(messageId, suggestion.name, {
        probeStatus: 'error',
        probe_result: result,
      });
      if (!options.silent) notify.error(result.error?.message || '接口測試失敗');
      return result;
    }
  }

  function applyProbeArgumentsFromDetail() {
    if (!toolDetail || !toolDetailMessageId) return;
    const parsed = parseJsonObject(probeArgsText);
    if (!parsed) {
      notify.error('樣例參數必須是 JSON 對象');
      return;
    }
    setToolSuggestionPatch(toolDetailMessageId, toolDetail.name, { sample_arguments: parsed });
    setToolDetail({ ...toolDetail, sample_arguments: parsed });
    notify.success('樣例參數已更新');
  }

  function probeToolDetail() {
    if (!toolDetail || !toolDetailMessageId) return;
    const parsed = parseJsonObject(probeArgsText);
    if (!parsed) {
      notify.error('樣例參數必須是 JSON 對象');
      return;
    }
    void probeToolSuggestion(toolDetailMessageId, { ...toolDetail, sample_arguments: parsed }, { sampleArguments: parsed });
  }

  async function confirmToolSuggestion(messageId: string, suggestion: ToolSuggestionItem) {
    if (loading) return;
    if (toolSuggestionResolution(suggestion) !== 'new_candidate') {
      notify.warning('該工具不是可新增候選');
      return;
    }
    if (!suggestion.probe_result?.success) {
      notify.warning('請先測試接口成功後再新增工具');
      return;
    }
    const nextSuggestions = nextToolSuggestionsWithPatch(messageId, suggestion.name, { status: 'accepted' });
    setToolSuggestionStatus(messageId, suggestion.name, 'accepted');
    const shouldCommit = toolSuggestionSelectionsComplete(nextSuggestions);
    if (!shouldCommit) {
      notify.success('已確認，等待其他工具建議處理完成後統一更新 SOP');
      return;
    }
    await commitToolSuggestionSelections(messageId, nextSuggestions);
  }

  async function commitToolSuggestionSelections(messageId: string, suggestions: ToolSuggestionItem[]) {
    const activeDraft = lockNullableSkillIdForDraft(pendingChange?.nextDraft || draft, lockedSkillId);
    const acceptedSuggestions = suggestions.filter(
      (item) => toolSuggestionResolution(item) === 'new_candidate' && item.status === 'accepted',
    );
    if (acceptedSuggestions.length === 0) {
      notify.info('所有工具建議已拒絕，SOP 草稿未變更');
      return;
    }
    try {
      const createdTools: ToolRead[] = [];
      const createdNewTools: ToolRead[] = [];
      for (const suggestion of acceptedSuggestions) {
        if (!suggestion.probe_result?.success) {
          throw new Error(`工具「${suggestion.display_name || suggestion.name}」尚未測試通過`);
        }
        const payload = toolPayloadFromSuggestion(suggestion, activeDraft?.skill_id);
        let createdTool: ToolRead;
        let createdNewTool = false;
        try {
          createdTool = await api.post<ToolRead>(`/api/enterprise/tools${agentQuery ? `?${agentQuery.slice(1)}` : ''}`, payload);
          createdNewTool = true;
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 409) throw error;
          createdTool = toolReadFromSuggestion(suggestion, activeDraft?.skill_id);
        }
        createdTools.push(createdTool);
        if (createdNewTool) createdNewTools.push(createdTool);
        setToolSuggestionStatus(messageId, suggestion.name, 'created');
      }
      setTools((current) => createdTools.reduce((nextTools, tool) => upsertToolRead(nextTools, tool), current));
      createdNewTools.forEach((createdTool) => {
        appendOperationToMessage(messageId, {
          kind: 'tool_add',
          label: `新增工具：${createdTool.display_name || createdTool.name}`,
          toolId: createdTool.id,
          toolName: createdTool.name,
        });
      });
      if (!activeDraft) return;
      const toolNames = acceptedSuggestions.map((item) => item.display_name || item.name).join('、');
      const nextDraft = lockSkillIdForDraft(
        integrateToolSuggestionsIntoDraft(
          activeDraft,
          acceptedSuggestions,
          pendingChange?.changedPaths?.length ? pendingChange.changedPaths : selectedPaths,
        ),
        lockedSkillId,
      );
      const changedPaths = diffTargetPaths(activeDraft, nextDraft, allTargetPaths(nextDraft));
      confirmPendingChange(false);
      clearAnimationTimers();
      setDraft(nextDraft);
      setPendingChange(null);
      setUpdatingPaths([]);
      setTextDiffs([]);
      if (changedPaths.length > 0) {
        setHighlightedPaths((current) => mergePaths(current, changedPaths));
        setDirtyPaths((current) => mergePaths(current, changedPaths));
        appendOperationToMessage(messageId, {
          kind: 'skill_change',
          label: `接入工具：${toolNames}`,
          skillId: nextDraft.skill_id,
        });
      }
      notify.success(`已確認 ${acceptedSuggestions.length} 個工具，當前草稿已局部更新`);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '新增工具或更新 SOP 失敗');
    }
  }

  function rejectToolSuggestion(messageId: string, toolName: string) {
    const nextSuggestions = nextToolSuggestionsWithPatch(messageId, toolName, { status: 'rejected' });
    setToolSuggestionStatus(messageId, toolName, 'rejected');
    removeToolActionFromDraft(toolName);
    if (toolSuggestionSelectionsComplete(nextSuggestions)) {
      void commitToolSuggestionSelections(messageId, nextSuggestions);
    }
  }

  function removeToolActionFromDraft(toolName: string) {
    setDraft((current) => (current ? lockSkillIdForDraft(removeToolActionFromSkill(current, toolName), lockedSkillId) : current));
    setPendingChange((current) =>
      current
        ? {
            ...current,
            nextDraft: lockSkillIdForDraft(removeToolActionFromSkill(current.nextDraft, toolName), lockedSkillId),
          }
        : current,
    );
  }

  function setToolSuggestionStatus(messageId: string, toolName: string, status: ToolSuggestionItem['status']) {
    setToolSuggestionPatch(messageId, toolName, { status });
  }

  function nextToolSuggestionsWithPatch(
    messageId: string,
    toolName: string,
    patch: Partial<ToolSuggestionItem>,
  ): ToolSuggestionItem[] {
    const targetMessage = messages.find((item) => item.id === messageId);
    return (targetMessage?.toolSuggestions || []).map((suggestion) =>
      suggestion.name === toolName ? { ...suggestion, ...patch } : suggestion,
    );
  }

  function setToolSuggestionPatch(messageId: string, toolName: string, patch: Partial<ToolSuggestionItem>) {
    setMessages((current) =>
      current.map((item) =>
        item.id === messageId
          ? {
              ...item,
              toolSuggestions: (item.toolSuggestions || []).map((suggestion) =>
                suggestion.name === toolName ? { ...suggestion, ...patch } : suggestion,
              ),
            }
          : item,
      ),
    );
    setToolDetail((current) => (current?.name === toolName ? { ...current, ...patch } : current));
  }

  function closeSaveReview() {
    setSaveReviewOpen(false);
    setSaveDraftSnapshot(null);
    setClearAfterSave(false);
  }

  function handleClearClick() {
    if (loading) return;
    if (!hasUnsavedSkillChanges()) {
      setClearNewConfirm({
        title: skillId ? '清空並新建 SOP？' : '清空當前改寫？',
        description: skillId
          ? '清空只會進入一個新的 SOP 草稿工作臺，不會刪除或替換當前正在編輯的 SOP。'
          : '當前技能沒有未保存變更，確認清空當前改寫內容和對話記錄？',
      });
      return;
    }
    setClearConfirmOpen(true);
  }

  function hasUnsavedSkillChanges() {
    const targetDraft = lockNullableSkillIdForDraft(pendingChange?.nextDraft || draft, lockedSkillId);
    if (!targetDraft) return false;
    return hasSkillContentChanges(targetDraft, lastSavedDraft);
  }

  function clearDistillWorkspace() {
    clearAnimationTimers();
    abortRef.current?.abort();
    Object.values(uploadControllersRef.current).forEach((controller) => controller.abort());
    uploadControllersRef.current = {};
    const nextRoute = `/enterprise/skills/distill?mode=create${activeAgentId ? `&agent_id=${encodeURIComponent(activeAgentId)}` : ''}`;
    const nextCacheKey = `skill-distill:${TENANT_ID}:${activeAgentId || 'default'}:create`;
    removeDistillCache(cacheKey);
    removeDistillCache(nextCacheKey);
    setCacheReady(false);
    setHydratedCacheKey('');
    setDraft(null);
    setLoadedSkill(null);
    setLastSavedDraft(null);
    setMessages(DEFAULT_DISTILL_MESSAGES);
    setInput('');
    setSelectedPaths(DEFAULT_TARGET_PATHS);
    setHighlightedPaths([]);
    setUpdatingPaths([]);
    setDirtyPaths([]);
    setTextDiffs([]);
    setPendingChange(null);
    setSaveDraftSnapshot(null);
    setSaveReviewOpen(false);
    setClearConfirmOpen(false);
    setClearAfterSave(false);
    setAttachments([]);
    setStreamStatus('');
    setActiveJob(null);
    if (skillId) {
      navigate(nextRoute, { replace: true });
    } else {
      setHydratedCacheKey(cacheKey);
      setCacheReady(true);
    }
  }

  function toggleTarget(target: TargetSelection) {
    setSelectedPaths((current) => {
      if (current.includes(target.path)) {
        return current.filter((path) => path !== target.path);
      }
      return [...current, target.path];
    });
  }

  function handleSourceEdit(nextDraft: SkillCard, path: string) {
    const lockedDraft = lockSkillIdForDraft(nextDraft, lockedSkillId);
    setDraft(lockedDraft);
    setDirtyPaths((current) => mergePaths(current, [path]));
    setHighlightedPaths((current) => mergePaths(current, [path]));
  }

  function toggleAllTargets() {
    setSelectedPaths(allSelected ? [] : allPaths);
  }

  function pushMessage(role: ChatItem['role'], content: string, extra: Partial<ChatItem> = {}) {
    const id = `${role}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setMessages((current) => [...current, { id, role, content, createdAt: new Date().toISOString(), ...extra }]);
    return id;
  }

  function updateMessage(id: string, content?: string, extra: Partial<ChatItem> = {}) {
    setMessages((current) =>
      current.map((item) => (item.id === id ? { ...item, ...(content === undefined ? {} : { content }), ...extra } : item)),
    );
  }

  function appendOperationToMessage(id: string, operation: DistillHistoryOperation) {
    setMessages((current) =>
      current.map((item) =>
        item.id === id ? { ...item, operations: [...(item.operations || []), operation] } : item,
      ),
    );
  }

  function appendOperationToLatestMessage(operation: DistillHistoryOperation) {
    setMessages((current) => {
      const index = [...current].reverse().findIndex((item) => item.role === 'assistant' || item.role === 'user');
      if (index < 0) return current;
      const targetIndex = current.length - 1 - index;
      return current.map((item, currentIndex) =>
        currentIndex === targetIndex ? { ...item, operations: [...(item.operations || []), operation] } : item,
      );
    });
  }

  function appendMessage(id: string, content: string) {
    setMessages((current) =>
      current.map((item) => (item.id === id ? { ...item, content: `${item.content}${content}` } : item)),
    );
  }

  function appendThinkingDetail(id: string, detail: string) {
    const nextDetail = detail.trim();
    if (!nextDetail) return;
    setMessages((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const previous = item.thinkingDetails || [];
        if (previous[previous.length - 1] === nextDetail) return item;
        return { ...item, thinkingDetails: [...previous, nextDetail] };
      }),
    );
  }

  function toggleThinking(id: string) {
    setMessages((current) =>
      current.map((item) => (item.id === id ? { ...item, thinkingOpen: !item.thinkingOpen } : item)),
    );
  }

  function finishStream(controller: AbortController) {
    if (abortRef.current === controller) abortRef.current = null;
    setLoading(false);
  }

  function createHistorySnapshot(): DistillHistorySnapshot {
    return {
      draft: draft ? cloneSkill(draft) : null,
      loadedSkill: loadedSkill ? cloneSkillRead(loadedSkill) : null,
      lastSavedDraft: lastSavedDraft ? cloneSkill(lastSavedDraft) : null,
      selectedPaths: [...selectedPaths],
      highlightedPaths: [...highlightedPaths],
      updatingPaths: [...updatingPaths],
      dirtyPaths: [...dirtyPaths],
      textDiffs: textDiffs.map((item) => ({ ...item })),
      pendingChange: pendingChange
        ? {
            assistantId: pendingChange.assistantId,
            previousDraft: cloneSkill(pendingChange.previousDraft),
            nextDraft: cloneSkill(pendingChange.nextDraft),
            changedPaths: [...pendingChange.changedPaths],
          }
        : null,
      viewMode,
      tools: tools.map((tool) => ({ ...tool })),
      attachments: attachments.map((item) => ({ ...item })),
      streamStatus,
    };
  }

  function restoreHistorySnapshot(snapshot: DistillHistorySnapshot) {
    clearAnimationTimers();
    abortRef.current?.abort();
    const snapshotLockedSkillId = snapshot.loadedSkill?.skill_id || lockedSkillId;
    setDraft(lockNullableSkillIdForDraft(snapshot.draft ? cloneSkill(snapshot.draft) : null, snapshotLockedSkillId));
    setLoadedSkill(snapshot.loadedSkill ? cloneSkillRead(snapshot.loadedSkill) : null);
    setLastSavedDraft(lockNullableSkillIdForDraft(snapshot.lastSavedDraft ? cloneSkill(snapshot.lastSavedDraft) : null, snapshotLockedSkillId));
    setSelectedPaths([...snapshot.selectedPaths]);
    setHighlightedPaths([...snapshot.highlightedPaths]);
    setUpdatingPaths([...snapshot.updatingPaths]);
    setDirtyPaths([...snapshot.dirtyPaths]);
    setTextDiffs(snapshot.textDiffs.map((item) => ({ ...item })));
    setPendingChange(lockPendingChangeSkillId(
      snapshot.pendingChange
        ? {
            assistantId: snapshot.pendingChange.assistantId,
            previousDraft: cloneSkill(snapshot.pendingChange.previousDraft),
            nextDraft: cloneSkill(snapshot.pendingChange.nextDraft),
            changedPaths: [...snapshot.pendingChange.changedPaths],
          }
        : null,
      snapshotLockedSkillId,
    ));
    setViewMode(snapshot.viewMode);
    setTools(snapshot.tools.map((tool) => ({ ...tool })));
    setAttachments(snapshot.attachments.filter((item) => item.status !== 'uploading').map((item) => ({ ...item })));
    setStreamStatus(snapshot.streamStatus);
    setActiveJob(null);
    setLoading(false);
  }

  function confirmPendingChange(showToast = true) {
    if (!pendingChange) return;
    clearAnimationTimers();
    setDraft(lockSkillIdForDraft(pendingChange.nextDraft, lockedSkillId));
    setUpdatingPaths([]);
    setTextDiffs([]);
    updateMessage(pendingChange.assistantId, undefined, { actionState: 'confirmed' });
    setPendingChange(null);
    if (showToast) notify.success('已確認改寫');
  }

  function rejectPendingChange() {
    if (!pendingChange) return;
    clearAnimationTimers();
    setDraft(lockSkillIdForDraft(pendingChange.previousDraft, lockedSkillId));
    setHighlightedPaths([]);
    setUpdatingPaths([]);
    setTextDiffs([]);
    updateMessage(pendingChange.assistantId, undefined, { actionState: 'rejected' });
    setPendingChange(null);
    notify.info('已拒絕改寫並還原');
  }

  function requestEditHistoryMessage(item: ChatItem, index: number) {
    if (loading || item.role !== 'user') return;
    setEditingMessage({ id: item.id, text: visibleChatContent(item) });
  }

  async function copyHistoryMessage(item: ChatItem) {
    const text = visibleChatContent(item);
    try {
      await navigator.clipboard.writeText(text);
      notify.success('已複製');
    } catch {
      notify.error('複製失敗');
    }
  }

  function cancelEditingMessage() {
    setEditingMessage(null);
  }

  function submitEditingMessage() {
    if (!editingMessage || loading) return;
    const text = editingMessage.text.trim();
    if (!text) return;
    const index = messages.findIndex((item) => item.id === editingMessage.id);
    const item = index >= 0 ? messages[index] : null;
    if (!item || item.role !== 'user') {
      setEditingMessage(null);
      return;
    }
    const outgoingText = buildEditedOutgoingText(item, text);
    const snapshot = item.snapshotBefore;
    if (!snapshot) {
      updateMessage(item.id, text, { outgoingText });
      setEditingMessage(null);
      return;
    }
    const rollbackOperations = collectRollbackOperations(messages.slice(index + 1));
    if (rollbackOperations.length === 0) {
      void rerunEditedMessage(index, snapshot, rollbackOperations, text, outgoingText);
      return;
    }
    setRerunConfirm({ index, snapshot, rollbackOperations, text, outgoingText });
  }

  async function rerunEditedMessage(
    index: number,
    snapshot: DistillHistorySnapshot,
    operations: DistillHistoryOperation[],
    displayText: string,
    outgoingText: string,
  ) {
    try {
      await rollbackPersistedOperations(snapshot, operations);
      const snapshotLockedSkillId = snapshot.loadedSkill?.skill_id || lockedSkillId;
      const confirmedDraft = lockNullableSkillIdForDraft(snapshot.pendingChange?.nextDraft || snapshot.draft, snapshotLockedSkillId);
      restoreHistorySnapshot({
        ...snapshot,
        draft: confirmedDraft ? cloneSkill(confirmedDraft) : null,
        pendingChange: null,
        updatingPaths: [],
        textDiffs: [],
      });
      const editedUser: ChatItem = {
        id: `user_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        role: 'user',
        content: displayText,
        outgoingText,
        createdAt: new Date().toISOString(),
        snapshotBefore: snapshot,
      };
      const previousMessages = messages.slice(0, index);
      const nextMessages = [...previousMessages, editedUser];
      setMessages(nextMessages);
      setEditingMessage(null);
      if (!confirmedDraft) {
        await createDraftFromText(outgoingText);
        return;
      }
      await rewriteSelectedTarget(outgoingText, confirmedDraft, undefined, undefined, nextMessages);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '回退失敗');
    }
  }

  async function rollbackPersistedOperations(
    snapshot: DistillHistorySnapshot,
    operations: DistillHistoryOperation[],
  ) {
    const toolOps = operations.filter((operation) => operation.kind === 'tool_add' && operation.toolId);
    for (const operation of toolOps) {
      try {
        await api.delete(`/api/enterprise/tools/${encodeURIComponent(String(operation.toolId))}?tenant_id=${TENANT_ID}${agentQuery}`);
      } catch {
        // Tool may already have been removed. Local state is restored from the snapshot below.
      }
    }

    const versionOps = operations.filter((operation) => operation.kind === 'version_save' && operation.skillId);
    for (const operation of versionOps) {
      const skillId = String(operation.skillId);
      if (snapshot.loadedSkill) {
        await api.put<SkillRead>(`/api/enterprise/skills/${encodeURIComponent(snapshot.loadedSkill.skill_id)}${agentOnlyQuery}`, {
          tenant_id: TENANT_ID,
          content: snapshot.loadedSkill.content,
          status: snapshot.loadedSkill.status,
        });
        if (operation.version && operation.version !== snapshot.loadedSkill.version) {
          try {
            await api.delete(
              `/api/enterprise/skills/${encodeURIComponent(skillId)}/versions/${encodeURIComponent(operation.version)}?tenant_id=${TENANT_ID}${agentQuery}`,
            );
          } catch {
            // A saved version may be shared with current state or already removed. The active draft has been restored.
          }
        }
      } else {
        try {
          await api.delete(`/api/enterprise/skills/${encodeURIComponent(skillId)}?tenant_id=${TENANT_ID}${agentQuery}`);
        } catch {
          // If the skill was not persisted, there is nothing else to roll back.
        }
      }
    }
  }

  function animateDraftChange(
    previousDraft: SkillCard,
    nextDraft: SkillCard,
    changedPaths: string[],
    markDelay = 520,
  ) {
    clearAnimationTimers();
    const lockedPreviousDraft = lockSkillIdForDraft(previousDraft, lockedSkillId);
    const lockedNextDraft = lockSkillIdForDraft(nextDraft, lockedSkillId);
    const paths = changedPaths;
    if (paths.length === 0) {
      setDraft(lockedNextDraft);
      setHighlightedPaths([]);
      setUpdatingPaths([]);
      setTextDiffs([]);
      return;
    }
    const nextTextDiffs = collectTextDiffs(lockedPreviousDraft, lockedNextDraft, paths);
    setHighlightedPaths(paths);
    setUpdatingPaths(paths);
    setTextDiffs(nextTextDiffs);
    setDraft(lockedPreviousDraft);
    const startTimer = window.setTimeout(() => {
      setTextDiffs((current) => current.map((diff) => ({ ...diff, phase: 'type', progress: 0 })));
      const steps = 24;
      let tick = 0;
      const interval = window.setInterval(() => {
        tick += 1;
        const progress = Math.min(tick / steps, 1);
        setTextDiffs((current) => current.map((diff) => ({ ...diff, phase: 'type', progress })));
        setDraft(typedDraft(lockedPreviousDraft, lockedNextDraft, nextTextDiffs, progress));
        if (progress >= 1) {
          window.clearInterval(interval);
          animationTimersRef.current = animationTimersRef.current.filter((timer) => timer !== interval);
          setTextDiffs((current) => current.map((diff) => ({ ...diff, phase: 'settled', progress: 1 })));
          setDraft(lockedNextDraft);
          setUpdatingPaths([]);
          setDirtyPaths((current) => mergePaths(current, paths));
        }
      }, 38);
      animationTimersRef.current.push(interval);
    }, markDelay);
    animationTimersRef.current.push(startTimer);
  }

  function clearAnimationTimers() {
    animationTimersRef.current.forEach((timer) => {
      window.clearTimeout(timer);
      window.clearInterval(timer);
    });
    animationTimersRef.current = [];
  }

  const pageTitle = mode === 'create' && !skillId ? '新建 SOP' : '編輯 SOP';

  return (
    <div className={DISTILL_PAGE_CLASS}>
      <AppHeader className="shrink-0" onLogout={onLogout} userName={currentUser?.username} title={pageTitle} />
      <div className={DISTILL_ACTIONS_CLASS}>
        <UIButton variant="outline" className={RETURN_BUTTON_CLASS} onClick={() => navigate('/enterprise/skills')}>
          <ArrowLeftOutlined />
          返回
        </UIButton>
      </div>
      <div className={WORKBENCH_CLASS}>
        <DistillSectionCard
          className={cn(CHAT_CARD_CLASS, 'h-full min-h-0', dragActive && CHAT_CARD_DRAGGING_CLASS)}
          bodyClassName={CHAT_CARD_BODY_CLASS}
          title="對話蒸餾"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={CHAT_PANEL_CLASS}>
            {dragActive && <div className={CHAT_UPLOAD_DROP_HINT_CLASS}>鬆開上傳文檔</div>}
            <div className={CHAT_MESSAGES_CLASS} ref={chatMessagesRef}>
              {messages.map((item, index) => (
                <div key={item.id} className={chatRowClass(item.role)}>
                  <div
                    className={chatBubbleClass({
                      role: item.role,
                      editing: editingMessage?.id === item.id,
                      hasAttachments: item.role === 'user' && Boolean(item.attachments?.length),
                    })}
                  >
                    {item.role === 'assistant' && item.thinking && (
                      <div className={CHAT_THINKING_BLOCK_CLASS}>
                        <button
                          type="button"
                          className={CHAT_THINKING_BUTTON_CLASS}
                          onClick={() => toggleThinking(item.id)}
                        >
                          {item.thinking === 'running' ? <LoadingOutlined /> : <CheckOutlined />}
                          <span>{item.thinking === 'running' ? '正在學習' : '學習記錄'}</span>
                          {item.thinkingOpen ? <DownOutlined /> : <RightOutlined />}
                        </button>
                        {item.thinkingOpen && (
                          <div className={CHAT_THINKING_DETAILS_CLASS}>
                            {(item.thinkingDetails || []).map((detail, index) => (
                              <div key={`${item.id}_detail_${index}`} className={CHAT_THINKING_DETAIL_CLASS}>
                                {detail}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {item.role === 'user' && item.attachments && item.attachments.length > 0 && (
                      <div className={cn(CHAT_ATTACHMENTS_CLASS, CHAT_ATTACHMENTS_USER_CLASS)}>
                        {item.attachments.map((attachment) => (
                          <div className={cn(CHAT_ATTACHMENT_CLASS, CHAT_ATTACHMENT_USER_CLASS)} key={attachment.id} title={attachment.name}>
                            <span className={CHAT_ATTACHMENT_ICON_CLASS}>
                              <FileTextOutlined />
                            </span>
                            <span className={CHAT_ATTACHMENT_MAIN_CLASS}>
                              <span className={CHAT_ATTACHMENT_NAME_CLASS}>{attachment.name}</span>
                              <span className={CHAT_ATTACHMENT_TYPE_CLASS}>{attachment.type}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {item.role === 'user' && editingMessage?.id === item.id ? (
                      <div
                        className={cn(
                          CHAT_EDIT_PANEL_CLASS,
                          item.attachments?.length ? CHAT_EDIT_PANEL_USER_ATTACHMENTS_CLASS : undefined,
                        )}
                      >
                        <Textarea
                          className={CHAT_EDIT_TEXTAREA_CLASS}
                          value={editingMessage.text}
                          rows={3}
                          autoFocus
                          onChange={(event) => setEditingMessage({ id: item.id, text: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                              event.preventDefault();
                              submitEditingMessage();
                            }
                          }}
                        />
                        <div className={CHAT_EDIT_ACTIONS_CLASS}>
                          <UIButton variant="outline" onClick={cancelEditingMessage}>取消</UIButton>
                          <UIButton onClick={submitEditingMessage} disabled={!(editingMessage?.text || '').trim()}>
                            發送
                          </UIButton>
                        </div>
                      </div>
                    ) : (
                      <>
                        {item.content ? (
                          <div
                            className={cn(
                              CHAT_CONTENT_CLASS,
                              item.role === 'user' && item.attachments?.length ? CHAT_CONTENT_USER_ATTACHMENTS_CLASS : undefined,
                            )}
                          >
                            {visibleChatContent(item)}
                          </div>
                        ) : item.role === 'assistant' && item.thinking === 'running' ? null : item.role === 'assistant' ? (
                          '正在處理...'
                        ) : null}
                        {item.role === 'user' && (
                          <div className={CHAT_HOVER_ACTIONS_CLASS}>
                            <span className={CHAT_TIME_CLASS}>{formatMessageTime(item.createdAt)}</span>
                            <button type="button" className={CHAT_HOVER_BUTTON_CLASS} title="複製" onClick={() => void copyHistoryMessage(item)}>
                              <CopyGlyph />
                            </button>
                            <button
                              type="button"
                              className={CHAT_HOVER_BUTTON_CLASS}
                              title="修改"
                              onClick={() => requestEditHistoryMessage(item, index)}
                              disabled={loading}
                            >
                              <PencilGlyph />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    {item.warnings && item.warnings.length > 0 && (() => {
                      const warnings = compactWarningItems(item.warnings || [], item.toolSuggestions);
                      if (warnings.length === 0) return null;
                      return (
                        <div className={CHAT_WARNING_CLASS}>
                          <div className={CHAT_WARNING_TITLE_CLASS}>
                            <WarningOutlined />
                            <span>提示</span>
                          </div>
                          {warnings.map((warning, index) => (
                            <div key={`${item.id}_warning_${index}`} className={CHAT_WARNING_ITEM_CLASS} title={warning.title}>
                              {warning.text}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    {item.toolSuggestions && item.toolSuggestions.length > 0 && (
                      <div className={TOOL_SUGGESTIONS_CLASS}>
                        {item.toolSuggestions.map((suggestion) => {
                          const canResolveSuggestion =
                            toolSuggestionResolution(suggestion) === 'new_candidate' &&
                            suggestion.status !== 'accepted' &&
                            suggestion.status !== 'created' &&
                            suggestion.status !== 'rejected';
                          return (
                            <div className={TOOL_SUGGESTION_CLASS} key={`${item.id}_${suggestion.name}`}>
                              <div className={TOOL_SUGGESTION_MAIN_CLASS}>
                                <div className={TOOL_SUGGESTION_HEAD_CLASS}>
                                  <div className={TOOL_SUGGESTION_TITLE_CLASS}>{toolSuggestionTitle(suggestion)}</div>
                                  <span className={toolStatusBadgeClass(toolSuggestionStatusClass(suggestion))}>
                                    {toolSuggestionStatusText(suggestion)}
                                  </span>
                                </div>
                                <div className={TOOL_SUGGESTION_DESC_CLASS}>
                                  {suggestion.reason || suggestion.description || suggestion.name}
                                </div>
                                <div className={TOOL_SUGGESTION_META_CLASS}>
                                  <span className={TOOL_METHOD_CLASS}>{suggestion.method || 'POST'}</span>
                                  <span>{suggestion.url || '-'}</span>
                                </div>
                              </div>
                              <div className={TOOL_SUGGESTION_ACTIONS_CLASS}>
                                <span className={cn(TOOL_ACTION_GROUP_CLASS, TOOL_ACTION_GROUP_DETAIL_CLASS)}>
                                  <SimpleTooltip title="查看詳情">
                                    <UIButton
                                      className={TOOL_ACTION_BUTTON_CLASS}
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openToolDetail(item.id, suggestion)}
                                    >
                                      <InfoCircleOutlined />
                                    </UIButton>
                                  </SimpleTooltip>
                                </span>
                                {canResolveSuggestion && (
                                  <span className={TOOL_ACTION_GROUP_CLASS}>
                                    <SimpleTooltip title="確認新增">
                                      <UIButton
                                        className={cn(TOOL_ACTION_BUTTON_CLASS, TOOL_ACTION_CONFIRM_CLASS)}
                                        variant="ghost"
                                        size="icon"
                                        disabled={!suggestion.probe_result?.success}
                                        onClick={() => void confirmToolSuggestion(item.id, suggestion)}
                                      >
                                        <CheckCircleOutlined />
                                      </UIButton>
                                    </SimpleTooltip>
                                    <SimpleTooltip title="拒絕">
                                      <UIButton
                                        className={cn(TOOL_ACTION_BUTTON_CLASS, TOOL_ACTION_REJECT_CLASS)}
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => rejectToolSuggestion(item.id, suggestion.name)}
                                      >
                                        <CloseCircleOutlined />
                                      </UIButton>
                                    </SimpleTooltip>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {item.actionState === 'pending' && (
                      <div className={CHAT_CONFIRM_CLASS}>
                        <UIButton size="sm" onClick={() => confirmPendingChange()}>
                          確認
                        </UIButton>
                        <UIButton size="sm" variant="outline" onClick={rejectPendingChange}>
                          拒絕
                        </UIButton>
                      </div>
                    )}
                    {item.actionState === 'confirmed' && <div className={CHAT_DECISION_CLASS}>已確認</div>}
                    {item.actionState === 'rejected' && <div className={CHAT_DECISION_CLASS}>已拒絕</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className={CHAT_COMPOSER_SHELL_CLASS}>
              <div className={CHAT_COMPOSER_CLASS}>
              {attachments.length > 0 && (
                <div className={UPLOAD_LIST_CLASS}>
                  {attachments.map((attachment) => (
                    <div className={uploadItemClass(attachment.status)} key={attachment.id}>
                      <FileTextOutlined />
                      <span className={UPLOAD_NAME_CLASS}>{attachment.name}</span>
                      <span className={UPLOAD_STATUS_CLASS}>
                        {attachment.status === 'uploading' && '讀取中'}
                        {attachment.status === 'ready' && '已讀取'}
                        {attachment.status === 'error' && (attachment.error || '讀取失敗')}
                      </span>
                      <UIButton
                        size="icon"
                        variant="ghost"
                        onClick={() => cancelAttachment(attachment.id)}
                      >
                        <CloseOutlined />
                      </UIButton>
                    </div>
                  ))}
                </div>
              )}
              <Textarea
                className={CHAT_TEXTAREA_CLASS}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onPaste={handleComposerPaste}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={4}
                placeholder={
                  draft
                    ? '說明你要如何改寫右側選中的部分'
                    : '輸入或粘貼需要整理的 SOP 流程說明'
                }
              />
              <div className={CHAT_ACTIONS_CLASS}>
                <span className="min-w-0 truncate text-[12px] text-[#858b9c]">{streamStatus}</span>
                <div className={CHAT_ACTIONS_GROUP_CLASS}>
                  <label>
                    <input
                      type="file"
                      accept=".md,.txt,.doc,.docx"
                      multiple
                      className="hidden"
                      disabled={loading}
                      onChange={(event) => {
                        const files = event.target.files ? Array.from(event.target.files) : [];
                        files.forEach((file) => void stageFileUpload(file));
                        event.target.value = '';
                      }}
                    />
                    <UIButton asChild variant="outline" disabled={uploadingFile || loading} className={CARD_OUTLINE_BUTTON_CLASS}>
                      <span>
                        <UploadOutlined />
                        上傳文件
                      </span>
                    </UIButton>
                  </label>
                  {loading && (
                    <UIButton variant="outline" className={CARD_OUTLINE_BUTTON_CLASS} onClick={stopStream}>
                      <StopOutlined />
                      停止
                    </UIButton>
                  )}
                  <ModelConfigDropdown
                    models={modelConfigs}
                    value={selectedRewriteModelId}
                    onChange={(modelId) => {
                      setSelectedRewriteModelId(modelId);
                      window.localStorage.setItem(`${DISTILL_REWRITE_MODEL_STORAGE_KEY}:${TENANT_ID}`, modelId);
                    }}
                    buttonClassName={REWRITE_MODEL_BUTTON_CLASS}
                  />
                  <UIButton
                    disabled={loading || uploadingFile || (!input.trim() && readyAttachments.length === 0)}
                    className={PRIMARY_BUTTON_CLASS}
                    onClick={() => void send()}
                  >
                    {loading ? <LoadingOutlined className="animate-spin" /> : <SendOutlined />}
                    發送
                  </UIButton>
                </div>
              </div>
              </div>
            </div>
          </div>
        </DistillSectionCard>
        <DistillSectionCard
          className={cn(SOURCE_CARD_CLASS, 'h-full min-h-0')}
          bodyClassName={DISTILL_CARD_BODY_CLASS}
          title={viewMode === 'source' ? '源碼' : '流程圖'}
          extra={
            <div className="flex flex-wrap justify-end gap-[8px]">
              <UIButton variant="outline" className={CARD_OUTLINE_BUTTON_CLASS} disabled={loading} onClick={handleClearClick}>
                清空
              </UIButton>
              <SimpleTooltip title={draft && !hasSaveableDraftChanges ? '當前沒有內容變化' : ''}>
                <UIButton
                  variant="outline"
                  className={CARD_OUTLINE_BUTTON_CLASS}
                  disabled={!draft || loading || !hasSaveableDraftChanges}
                  onClick={() => openSaveReview()}
                >
                  <SaveOutlined />
                  保存草稿
                </UIButton>
              </SimpleTooltip>
            </div>
          }
        >
          <div className={SOURCE_TOOLBAR_CLASS}>
            <div className="flex flex-wrap items-center gap-[8px]">
              <UIButton
                variant="outline"
                className={CARD_OUTLINE_BUTTON_CLASS}
                onClick={() => setViewMode(viewMode === 'source' ? 'flow' : 'source')}
              >
                {viewMode === 'source' ? <BranchesOutlined /> : <CodeOutlined />}
                {viewMode === 'source' ? '顯示流程' : '顯示源碼'}
              </UIButton>
              <UIButton variant="outline" className={CARD_OUTLINE_BUTTON_CLASS} disabled={!draft} onClick={toggleAllTargets}>
                {allSelected ? '清空選擇' : '全選'}
              </UIButton>
            </div>
          </div>
          {!draft ? (
            <div className={SOURCE_EMPTY_STATE_CLASS}>
              <FileTextOutlined className="text-[28px] text-[#c0c6d4]" />
              <p className={SOURCE_EMPTY_TEXT_CLASS}>暫無 SOP 草稿</p>
              <p className="text-[12px] leading-[18px] text-[#c0c6d4]">在左側輸入說明或上傳文檔後開始生成</p>
            </div>
          ) : viewMode === 'source' ? (
            <SkillSource
              skill={draft}
              selectedPaths={selectedPaths}
              highlightedPaths={highlightedPaths}
              updatingPaths={updatingPaths}
              dirtyPaths={dirtyPaths}
              textDiffs={textDiffs}
              toolDescriptions={toolDescriptions}
              toolStatuses={toolStatuses}
              containerRef={sourceScrollRef}
              lockSkillId={Boolean(lockedSkillId)}
              onToggle={toggleTarget}
              onEdit={handleSourceEdit}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <SkillFlow
                skill={draft}
                selectedPaths={selectedPaths}
                highlightedPaths={highlightedPaths}
                updatingPaths={updatingPaths}
                dirtyPaths={dirtyPaths}
                textDiffs={textDiffs}
                toolDescriptions={toolDescriptions}
                toolStatuses={toolStatuses}
                containerRef={sourceScrollRef}
                onToggle={toggleTarget}
              />
            </div>
          )}
        </DistillSectionCard>
      </div>
      <KDialog
        open={clearConfirmOpen}
        onOpenChange={(open) => !open && setClearConfirmOpen(false)}
        title="清空前是否保存？"
        width={520}
        footer={
          <div className="flex flex-wrap justify-end gap-[8px]">
            <UIButton variant="outline" onClick={() => setClearConfirmOpen(false)}>取消</UIButton>
            <UIButton
              variant="outline"
              onClick={() => {
                setClearConfirmOpen(false);
                clearDistillWorkspace();
              }}
            >
              不保存清空
            </UIButton>
            <UIButton
              onClick={() => {
                setClearConfirmOpen(false);
                openSaveReview({ clearAfterSave: true });
              }}
            >
              保存並清空
            </UIButton>
          </div>
        }
      >
        <p className="m-0 text-[14px] leading-[22px] text-foreground">
          檢測到當前 SOP 有未保存變更。你可以先保存當前內容；清空後會進入新的 SOP 草稿工作臺，不會把原 SOP 替換為空。
        </p>
      </KDialog>
      <KDialog
        open={saveReviewOpen}
        onOpenChange={(open) => !open && closeSaveReview()}
        title="保存SOP版本"
        width={820}
        footer={
          <div className="flex flex-wrap justify-end gap-[8px]">
            <UIButton variant="outline" onClick={closeSaveReview}>取消</UIButton>
            <UIButton disabled={!saveReviewHasContentChanges} onClick={() => void saveDraft()}>保存</UIButton>
          </div>
        }
      >
        <div className={SAVE_REVIEW_FORM_CLASS}>
          <label className={SAVE_REVIEW_FORM_LABEL_CLASS}>
            <span>SOP名稱</span>
            <Input value={saveName} onChange={(event) => setSaveName(event.target.value)} />
          </label>
          <label className={SAVE_REVIEW_FORM_LABEL_CLASS}>
            <span>業務域</span>
            <Input value={saveDomain} onChange={(event) => setSaveDomain(event.target.value)} />
          </label>
          <label className={SAVE_REVIEW_FORM_LABEL_CLASS}>
            <span>版本號</span>
            <Input value={saveVersion} disabled={!saveReviewHasContentChanges} onChange={(event) => setSaveVersion(event.target.value)} />
          </label>
        </div>
        <div className={SAVE_REVIEW_DIFF_CLASS}>
          <strong className="text-[13px] font-semibold text-foreground">本輪修改 diff</strong>
          {saveReviewDiffs.length === 0 ? (
            <EmptyState description="暫無結構差異" />
          ) : (
            saveReviewDiffs.map((diff) => (
              <div key={diff.key} className={SAVE_REVIEW_DIFF_ROW_CLASS}>
                <div className={SAVE_REVIEW_DIFF_PATH_CLASS}>{diffTargetLabel(diff.path, saveReviewDraft)} / {fieldLabel(diff.field)}</div>
                <SaveReviewDiffValue diff={diff} toolDescriptions={toolDescriptions} toolStatuses={toolStatuses} />
              </div>
            ))
          )}
        </div>
      </KDialog>
      <KDialog
        open={Boolean(toolDetail)}
        onOpenChange={(open) => !open && setToolDetail(null)}
        title="工具詳情"
        width={1040}
        footer={
          <div className={cn(TOOL_SUGGESTION_DETAIL_FOOTER_CLASS, "flex flex-wrap justify-end gap-[8px]")}>
            <UIButton variant="outline" onClick={() => setToolDetail(null)}>關閉</UIButton>
            {toolDetail && toolSuggestionResolution(toolDetail) === 'new_candidate' && (
              <>
                <UIButton variant="outline" onClick={applyProbeArgumentsFromDetail}>應用樣例參數</UIButton>
                <UIButton
                  disabled={toolDetail?.probeStatus === 'probing'}
                  onClick={probeToolDetail}
                >
                  {toolDetail?.probeStatus === 'probing' ? <LoadingOutlined className="animate-spin" /> : <ApiOutlined />}
                  {toolDetail?.probe_result ? '再次測試' : '測試接口'}
                </UIButton>
              </>
            )}
          </div>
        }
      >
        {toolDetail && (
          <div className={TOOL_SUGGESTION_DETAIL_CLASS}>
            <div><strong>解析狀態：</strong>{toolSuggestionResolutionLabel(toolDetail)}</div>
            {toolDetail.matched_tool_name && (
              <div><strong>匹配工具：</strong>{toolDetail.matched_tool_display_name || toolDetail.matched_tool_name}</div>
            )}
            <div><strong>工具名：</strong>{toolDetail.name}</div>
            <div><strong>顯示名：</strong>{toolDetail.display_name || '-'}</div>
            <div><strong>說明：</strong>{toolDetail.description || '-'}</div>
            <div><strong>方法：</strong>{toolDetail.method}</div>
            <div><strong>URL：</strong>{toolDetail.url}</div>
            {toolDetail.missing_reason && <div><strong>缺失原因：</strong>{toolDetail.missing_reason}</div>}
            <div><strong>原因：</strong>{toolDetail.reason || '-'}</div>
            <div><strong>來源：</strong>{toolDetail.source_excerpt || '-'}</div>
            <strong className="text-[13px] font-semibold text-foreground">樣例參數</strong>
            <Textarea
              value={probeArgsText}
              rows={5}
              onChange={(event) => setProbeArgsText(event.target.value)}
            />
            <strong className="text-[13px] font-semibold text-foreground">輸入 Schema</strong>
            <pre className={TOOL_SUGGESTION_DETAIL_PRE_CLASS}>{JSON.stringify(toolDetail.input_schema || {}, null, 2)}</pre>
            <strong className="text-[13px] font-semibold text-foreground">輸出 Schema</strong>
            <pre className={TOOL_SUGGESTION_DETAIL_PRE_CLASS}>{JSON.stringify(toolDetail.output_schema || {}, null, 2)}</pre>
            {toolDetail.probe_result && (
              <>
                <strong className="text-[13px] font-semibold text-foreground">測試結果</strong>
                <pre className={TOOL_SUGGESTION_DETAIL_PRE_CLASS}>{JSON.stringify(toolDetail.probe_result, null, 2)}</pre>
              </>
            )}
          </div>
        )}
      </KDialog>
      {clearNewConfirm && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setClearNewConfirm(null)}
          title={clearNewConfirm.title}
          description={clearNewConfirm.description}
          confirmText="清空"
          destructive={false}
          onConfirm={() => {
            setClearNewConfirm(null);
            clearDistillWorkspace();
          }}
        />
      )}
      {rerunConfirm && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRerunConfirm(null)}
          title="重新編輯這條消息？"
          confirmText="確認回退"
          destructive={false}
          description={
            <div>
              <p className="m-0 mb-[8px]">重新編輯會回到這條消息發送前的 SOP 草稿，並截斷之後的推理記錄。</p>
              <div className="rollback-operation-list flex flex-wrap gap-[6px]">
                {rerunConfirm.rollbackOperations.map((operation, operationIndex) => (
                  <DistillTag key={`${operation.kind}_${operationIndex}`}>{operation.label}</DistillTag>
                ))}
              </div>
            </div>
          }
          onConfirm={() => {
            const payload = rerunConfirm;
            setRerunConfirm(null);
            void rerunEditedMessage(
              payload.index,
              payload.snapshot,
              payload.rollbackOperations,
              payload.text,
              payload.outgoingText,
            );
          }}
        />
      )}
    </div>
  );
}

import { useAuth } from '@/app/AuthProvider';
import { useMemo, useRef, useState } from 'react';

import AppHeader from '@/components/AppHeader';
import { Field, SectionCard } from '@/components/form/SectionCard';
import { Button as UIButton } from '@/components/ui/button';
import { notify } from '@/components/ui/app-toast';
import { cn } from '@/lib/utils';
import { ENTERPRISE_AGENT_STORAGE_KEY } from '@/lib/agent-scope-storage';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { EnterpriseAuthUser } from '../auth';
import {
  knowledgeApi,
  type WikiBucketNode,
  type WikiCitation,
  type WikiOutline,
} from '../api/endpoints/knowledge';
import type { KnowledgeBaseRead, KnowledgeChunkRead } from '../types';

type WikiPageProps = {
  currentUser?: EnterpriseAuthUser;
  onLogout?: () => void;
};

function currentAgentId(): string {
  return window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '';
}

const CARD_CLASS = 'rounded-[14px] border border-[#eceef1] bg-white';
const CARD_TITLE_CLASS = 'text-[14px] font-medium text-[#18181a]';

/** Render answer text, turning [n] markers into subtle citation chips. */
function AnswerText({ text }: { text: string }) {
  const segments = text.split(/(\[\d+\])/g);
  return (
    <p className="whitespace-pre-wrap text-[13px] leading-[1.75] text-[#2b2f38]">
      {segments.map((seg, i) => {
        const match = /^\[(\d+)\]$/.exec(seg);
        if (match) {
          return (
            <sup
              key={i}
              className="mx-[1px] rounded-[4px] bg-[#eef2ff] px-[4px] py-[1px] text-[10px] font-medium text-[#4f46e5]"
            >
              {match[1]}
            </sup>
          );
        }
        return <span key={i}>{seg}</span>;
      })}
    </p>
  );
}

export default function WikiPage({}: WikiPageProps = {}) {
  const { user: currentUser, logout: onLogout } = useAuth();

  const agentId = currentAgentId();
  const [selectedKbId, setSelectedKbId] = useState<string>('');
  const [activeBucket, setActiveBucket] = useState<WikiBucketNode | null>(null);

  const { data: bases, loading: basesLoading } = useApiQuery<KnowledgeBaseRead[]>(
    () => knowledgeApi.listBases(agentId),
    [agentId],
    { onError: (error) => notify.error(error.message || '加載知識庫失敗') },
  );

  const effectiveKbId = selectedKbId || bases?.[0]?.id || '';

  const { data: outline, loading: outlineLoading } = useApiQuery<WikiOutline>(
    effectiveKbId ? () => knowledgeApi.wikiOutline(effectiveKbId, agentId) : null,
    [effectiveKbId, agentId],
    { onError: (error) => notify.error(error.message || '加載 Wiki 大綱失敗') },
  );

  const { data: chunks, loading: chunksLoading } = useApiQuery<KnowledgeChunkRead[]>(
    activeBucket ? () => knowledgeApi.bucketChunks(activeBucket.id, agentId) : null,
    [activeBucket?.id, agentId],
    { onError: (error) => notify.error(error.message || '加載章節內容失敗') },
  );

  // ---- ask panel ---------------------------------------------------------
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<WikiCitation[]>([]);
  const [asking, setAsking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function ask() {
    const query = question.trim();
    if (!query) {
      notify.warning('請輸入問題');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAsking(true);
    setAnswer('');
    setCitations([]);
    try {
      await knowledgeApi.askWiki(
        {
          tenant_id: bases?.[0]?.tenant_id || '',
          agent_id: agentId || undefined,
          knowledge_base_id: effectiveKbId || undefined,
          query,
          model_config_id: undefined,
        },
        (event) => {
          if (event.event === 'retrieval') {
            setCitations((event.data.citations as WikiCitation[]) || []);
          } else if (event.event === 'answer_delta') {
            setAnswer((prev) => prev + String(event.data.text || ''));
          } else if (event.event === 'complete') {
            if (Array.isArray(event.data.citations)) {
              setCitations(event.data.citations as WikiCitation[]);
            }
          } else if (event.event === 'error') {
            notify.error(String(event.data.message || '提問失敗'));
          }
        },
        controller.signal,
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        notify.error(error instanceof Error ? error.message : '提問失敗');
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setAsking(false);
    }
  }

  const kbOptions = useMemo(() => bases ?? [], [bases]);

  return (
    <div className="min-h-full box-border px-[48px] pt-[32px] pb-[43px] max-[900px]:px-[16px]">
      <AppHeader
        onLogout={onLogout}
        userName={currentUser?.username}
        title="知識 Wiki"
        description="像瀏覽百科一樣閱讀知識庫，並讓 AI 基於知識內容回答問題、給出引用。"
      />

      <div className="mt-[20px] mb-[16px] flex flex-wrap items-center gap-[12px]">
        <span className="text-[13px] text-[#858b9c]">知識庫</span>
        <select
          value={effectiveKbId}
          onChange={(e) => {
            setSelectedKbId(e.target.value);
            setActiveBucket(null);
          }}
          disabled={basesLoading || kbOptions.length === 0}
          className="h-[34px] min-w-[220px] rounded-[10px] border-[0.5px] border-[#e3e7f1] bg-white px-[12px] text-[13px] text-[#18181a]"
        >
          {kbOptions.length === 0 && <option value="">暫無知識庫</option>}
          {kbOptions.map((kb) => (
            <option key={kb.id} value={kb.id}>
              {kb.name}
            </option>
          ))}
        </select>
        {outline && (
          <span className="text-[12px] text-[#a4abbb]">
            {outline.document_count} 篇文檔 · {outline.bucket_count} 個章節 · {outline.chunk_count} 段內容
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-[16px] xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        {/* Outline tree */}
        <SectionCard
          title="目錄"
          loading={outlineLoading && !outline}
          className={cn(CARD_CLASS, 'overflow-hidden')}
          headerClassName="min-h-[48px] border-b border-[#eceef1] px-[16px] py-[10px]"
          titleClassName={CARD_TITLE_CLASS}
          bodyClassName="max-h-[calc(100vh-260px)] overflow-y-auto p-[10px]"
        >
          {outline && outline.documents.length === 0 && (
            <p className="px-[6px] py-[12px] text-[12px] text-[#a4abbb]">該知識庫還沒有已處理的文檔。</p>
          )}
          {outline?.documents.map((doc) => (
            <div key={doc.id} className="mb-[10px]">
              <p className="px-[6px] py-[4px] text-[12px] font-medium text-[#18181a]" title={doc.filename}>
                {doc.title}
              </p>
              <ul className="flex flex-col gap-[2px]">
                {doc.buckets.map((bucket) => (
                  <li key={bucket.id}>
                    <button
                      type="button"
                      onClick={() => setActiveBucket(bucket)}
                      className={cn(
                        'w-full truncate rounded-[8px] px-[8px] py-[6px] text-left text-[12px] transition-colors',
                        activeBucket?.id === bucket.id
                          ? 'bg-[#eef2ff] text-[#4f46e5]'
                          : 'text-[#5b6270] hover:bg-[#f5f6f9]',
                      )}
                      title={bucket.title}
                    >
                      {bucket.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </SectionCard>

        {/* Reading pane */}
        <SectionCard
          title={activeBucket ? activeBucket.title : '正文'}
          loading={chunksLoading}
          className={cn(CARD_CLASS, 'overflow-hidden')}
          headerClassName="min-h-[48px] border-b border-[#eceef1] px-[20px] py-[10px]"
          titleClassName={CARD_TITLE_CLASS}
          bodyClassName="max-h-[calc(100vh-260px)] overflow-y-auto p-[20px]"
        >
          {!activeBucket && (
            <p className="py-[40px] text-center text-[13px] text-[#a4abbb]">
              從左側目錄選擇一個章節開始閱讀。
            </p>
          )}
          {activeBucket && (
            <div className="flex flex-col gap-[16px]">
              <div className="rounded-[10px] bg-[#fafbfc] p-[14px] text-[13px] leading-[1.7] text-[#5b6270]">
                {activeBucket.summary || '（本章節暫無摘要）'}
              </div>
              {(chunks ?? []).map((chunk) => (
                <div key={chunk.id} className="border-l-[2px] border-[#eceef1] pl-[14px]">
                  <p className="whitespace-pre-wrap text-[13px] leading-[1.8] text-[#2b2f38]">
                    {chunk.content}
                  </p>
                  {chunk.source_ref && (
                    <p className="mt-[6px] font-mono text-[11px] text-[#a4abbb]">來源：{chunk.source_ref}</p>
                  )}
                </div>
              ))}
              {!chunksLoading && (chunks ?? []).length === 0 && (
                <p className="text-[12px] text-[#a4abbb]">該章節暫無正文內容。</p>
              )}
            </div>
          )}
        </SectionCard>

        {/* Ask panel */}
        <SectionCard
          title="問 Wiki"
          className={cn(CARD_CLASS, 'overflow-hidden xl:sticky xl:top-[18px]')}
          headerClassName="min-h-[48px] border-b border-[#eceef1] px-[16px] py-[10px]"
          titleClassName={CARD_TITLE_CLASS}
          bodyClassName="flex flex-col gap-[12px] p-[16px]"
        >
          <Field label="向當前知識庫提問">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void ask();
                }
              }}
              rows={3}
              placeholder="例如：退款需要幾天？（⌘/Ctrl + Enter 發送）"
              className="w-full resize-y rounded-[10px] border-[0.5px] border-[#e3e7f1] bg-white p-[10px] text-[13px] leading-[1.6] text-[#18181a] outline-none focus:border-[#cbd3e6]"
            />
          </Field>
          <div className="flex justify-end">
            <UIButton
              onClick={() => void ask()}
              disabled={asking || !effectiveKbId}
              className="h-[32px] gap-[4px] rounded-[10px] bg-[#18181a] px-[18px] text-[12px] font-normal text-white hover:bg-[#303030]"
            >
              {asking ? '思考中…' : '提問'}
            </UIButton>
          </div>

          {(answer || asking) && (
            <div className="rounded-[10px] bg-[#fafbfc] p-[12px]">
              {answer ? (
                <AnswerText text={answer} />
              ) : (
                <p className="text-[12px] text-[#a4abbb]">正在檢索知識並生成回答…</p>
              )}
            </div>
          )}

          {citations.length > 0 && (
            <div className="flex flex-col gap-[8px]">
              <p className="text-[12px] font-medium text-[#858b9c]">引用來源</p>
              {citations.map((c) => (
                <div key={c.index} className="rounded-[8px] border border-[#eceef1] p-[10px]">
                  <p className="text-[12px] font-medium text-[#18181a]">
                    <span className="mr-[6px] rounded-[4px] bg-[#eef2ff] px-[5px] py-[1px] text-[10px] text-[#4f46e5]">
                      {c.index}
                    </span>
                    {c.title}
                  </p>
                  <p className="mt-[4px] text-[12px] leading-[1.6] text-[#5b6270]">{c.snippet}</p>
                  {c.source_ref && (
                    <p className="mt-[4px] font-mono text-[10px] text-[#a4abbb]">{c.source_ref}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

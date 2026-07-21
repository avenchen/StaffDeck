import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { toolsApi } from '@/api/endpoints/tools';
import AppHeader from '@/components/AppHeader';
import { Button as UIButton } from '@/components/ui/button';
import { notify } from '@/components/ui/app-toast';
import { ExperimentOutlined } from '@/icons';
import IconArrowRight from '@/assets/icons/arrow-right.svg?react';
import { buildToolPayload, currentAgentId, loadBucketOptions, toolToFormValues } from '../lib/toolPayload';
import { SectionCard } from '../components/SectionCard';
import { ToolFormFields } from '../components/ToolFormFields';
import { ToolProbeCard } from '../components/ToolProbeCard';
import { ToolTypeSwitcher } from '../components/ToolTypeSwitcher';
import { SavedToolTestCard } from '../components/SavedToolTestCard';
import { PRIMARY_BUTTON_CLASS, RETURN_BUTTON_CLASS } from '../styles';
import { TOOL_FORM_INITIAL_VALUES, type ToolFormValues, type ToolPageProps } from '../types';
import type { ToolRead } from '@/types';

export function ToolNewPage(props: ToolPageProps = {}) {
  return <ToolEditorPage mode="new" {...props} />;
}

export function ToolEditPage(props: ToolPageProps = {}) {
  return <ToolEditorPage mode="edit" {...props} />;
}

function ToolEditorPage({ mode, currentUser, onLogout }: { mode: 'new' | 'edit' } & ToolPageProps) {
  const [values, setValues] = useState<ToolFormValues>({ ...TOOL_FORM_INITIAL_VALUES });
  const [tool, setTool] = useState<ToolRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [bucketOptions, setBucketOptions] = useState<{ value: string; label: string }[]>([{ value: '未分桶', label: '未分桶' }]);
  const navigate = useNavigate();
  const { toolId } = useParams();
  const isEdit = mode === 'edit';

  const setField = <K extends keyof ToolFormValues>(name: K, value: ToolFormValues[K]) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  useEffect(() => {
    void loadBucketOptions().then(setBucketOptions);
  }, []);

  useEffect(() => {
    if (!isEdit) {
      setValues({ ...TOOL_FORM_INITIAL_VALUES });
      setTool(null);
      return;
    }
    if (!toolId) return;
    setLoading(true);
    toolsApi
      .get(toolId, currentAgentId())
      .then((row) => {
        setTool(row);
        setValues(toolToFormValues(row));
      })
      .catch((error) => notify.error(error instanceof Error ? error.message : '加載工具失敗'))
      .finally(() => setLoading(false));
  }, [isEdit, toolId]);

  async function save() {
    if (!String(values.name || '').trim()) {
      notify.error('請填寫工具名稱');
      return;
    }
    if (!String(values.url || '').trim()) {
      notify.error('請填寫 URL');
      return;
    }
    const payload = buildToolPayload(values);
    if (!payload) return;
    setLoading(true);
    try {
      const saved = isEdit && toolId
        ? await toolsApi.update(toolId, payload, currentAgentId())
        : await toolsApi.create(payload, currentAgentId());
      notify.success('已保存');
      setTool(saved);
      setValues(toolToFormValues(saved));
      if (!isEdit) {
        navigate(`/enterprise/tools/${saved.id}/edit`, { replace: true });
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '保存失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full box-border px-[48px] pt-[32px] pb-[43px] max-[900px]:px-[16px]" aria-busy={loading}>
      <AppHeader
        onLogout={onLogout}
        userName={currentUser?.username}
        title={isEdit ? '編輯工具' : '新建工具'}
        description={
          isEdit
            ? '修改工具定義，並在右側驗證當前配置或已保存版本。'
            : '選擇工具類型並填寫定義，可先用右側探測區測試請求與返回結構。'
        }
      />
      <div className="mt-[20px] mb-[16px] flex flex-wrap justify-end gap-[16px]">
        <UIButton variant="outline" onClick={() => navigate('/enterprise/tools')} className={RETURN_BUTTON_CLASS}>
          <IconArrowRight className="size-3.5 rotate-180" />
          返回工具
        </UIButton>
        {isEdit && tool && (
          <UIButton
            variant="outline"
            onClick={() => navigate(`/enterprise/tools/${tool.id}/test`)}
            className={RETURN_BUTTON_CLASS}
          >
            <ExperimentOutlined />
            打開測試頁
          </UIButton>
        )}
        <UIButton disabled={loading} onClick={() => void save()} className={PRIMARY_BUTTON_CLASS}>
          保存
        </UIButton>
      </div>
      {!isEdit && <ToolTypeSwitcher active="http" />}
      <div className="grid grid-cols-1 items-start gap-[20px] xl:grid-cols-2">
        <SectionCard title="工具定義" loading={loading && isEdit && !tool}>
          <ToolFormFields values={values} setField={setField} bucketOptions={bucketOptions} lockName={isEdit} />
        </SectionCard>
        <div className="flex w-full flex-col gap-[20px]">
          <ToolProbeCard values={values} />
          {isEdit && tool && <SavedToolTestCard tool={tool} />}
        </div>
      </div>
    </div>
  );
}

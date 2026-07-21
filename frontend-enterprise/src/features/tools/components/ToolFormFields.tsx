import { Field } from '@/components/form/SectionCard';
import {
  Input,
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@/components/ui';
import { ToolOutlined } from '@/icons';
import { cn } from '@/lib/utils';
import { SELECT_TRIGGER_CLASS } from '@/lib/enterprise-ui';
import { FIELD_LABEL_CLASS, HINT_CLASS, MONO_INPUT_CLASS } from '../styles';
import type { ToolFormValues } from '../types';

export function ToolFormFields({
  values,
  setField,
  bucketOptions,
  lockName = false,
}: {
  values: ToolFormValues;
  setField: <K extends keyof ToolFormValues>(name: K, value: ToolFormValues[K]) => void;
  bucketOptions: { value: string; label: string }[];
  lockName?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[16px]">
      <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
        <Field label="工具名称" htmlFor="tool-name">
          <div className="relative">
            <ToolOutlined className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-[#858b9c]" />
            <Input
              id="tool-name"
              className="pl-[30px]"
              placeholder="order_query"
              value={values.name || ''}
              disabled={lockName}
              onChange={(event) => {
                if (lockName) return;
                setField('name', event.target.value);
              }}
            />
          </div>
        </Field>
        <Field label="展示名称" htmlFor="tool-display-name">
          <Input
            id="tool-display-name"
            placeholder="订单查询"
            value={values.display_name || ''}
            onChange={(event) => setField('display_name', event.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
        <Field label="工具分桶" htmlFor="tool-bucket">
          <Input
            id="tool-bucket"
            list="tool-bucket-options"
            placeholder="选择或输入分桶"
            value={values.bucket || ''}
            onChange={(event) => setField('bucket', event.target.value)}
          />
          <datalist id="tool-bucket-options">
            {bucketOptions.map((item) => (
              <option key={item.value} value={item.value} />
            ))}
          </datalist>
        </Field>
      </div>

      <Field label="描述" htmlFor="tool-description">
        <Textarea
          id="tool-description"
          rows={2}
          placeholder="简单说明这个工具的用途"
          value={values.description || ''}
          onChange={(event) => setField('description', event.target.value)}
        />
      </Field>

      <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-[140px_minmax(0,1fr)]">
        <Field label="HTTP Method">
          <UISelect value={values.method} onValueChange={(value) => setField('method', value)}>
            <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, 'w-full')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => (
                <SelectItem key={value} value={value}>{value}</SelectItem>
              ))}
            </SelectContent>
          </UISelect>
        </Field>
        <Field label="URL" htmlFor="tool-url">
          <Input
            id="tool-url"
            placeholder="/api/mock/order/query"
            value={values.url || ''}
            onChange={(event) => setField('url', event.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
        <Field label="Headers JSON" htmlFor="tool-headers">
          <Textarea
            id="tool-headers"
            rows={4}
            className={MONO_INPUT_CLASS}
            value={values.headers}
            onChange={(event) => setField('headers', event.target.value)}
          />
        </Field>
        <Field label="Auth JSON" htmlFor="tool-auth">
          <Textarea
            id="tool-auth"
            rows={4}
            className={MONO_INPUT_CLASS}
            value={values.auth}
            onChange={(event) => setField('auth', event.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
        <Field label="Input Schema" htmlFor="tool-input-schema">
          <Textarea
            id="tool-input-schema"
            rows={5}
            className={MONO_INPUT_CLASS}
            value={values.input_schema}
            onChange={(event) => setField('input_schema', event.target.value)}
          />
        </Field>
        <Field label="Output Schema" htmlFor="tool-output-schema">
          <Textarea
            id="tool-output-schema"
            rows={5}
            className={MONO_INPUT_CLASS}
            value={values.output_schema}
            onChange={(event) => setField('output_schema', event.target.value)}
          />
        </Field>
      </div>

      <Field label="Allowed Skills" htmlFor="tool-allowed-skills" hint="留空表示所有技能可调用，多个技能用英文逗号分隔。">
        <Input
          id="tool-allowed-skills"
          placeholder="skill_id_1,skill_id_2"
          value={values.allowed_skills || ''}
          onChange={(event) => setField('allowed_skills', event.target.value)}
        />
      </Field>

      <div className="flex items-center justify-between rounded-[12px] border border-[#eceef1] bg-[#fafbfc] px-[14px] py-[12px]">
        <div className="flex flex-col gap-[2px]">
          <span className={FIELD_LABEL_CLASS}>启用工具</span>
          <span className={HINT_CLASS}>停用后员工将无法调用该工具。</span>
        </div>
        <Switch checked={values.enabled} onCheckedChange={(next) => setField('enabled', next)} />
      </div>
    </div>
  );
}

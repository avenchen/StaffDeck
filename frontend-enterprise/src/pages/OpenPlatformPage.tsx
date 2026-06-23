import {
  AppstoreOutlined,
  FileSearchOutlined,
  ProfileOutlined,
  RightOutlined,
  RobotOutlined,
  SolutionOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { Button, Card, Empty, Space, Tag, Typography, message } from 'antd';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, TENANT_ID } from '../api/client';
import { isEmployeeOwnedBy, isGalleryEmployee, type EnterpriseAuthUser } from '../auth';
import EmployeeAvatar from '../components/EmployeeAvatar';
import { employeeDisplayName, employeeProfile } from '../employee';
import type { AgentProfileRead, GeneralSkillRead, KnowledgeBaseRead, SkillRead, ToolRead } from '../types';

const ENTERPRISE_AGENT_STORAGE_KEY = 'ultrarag_enterprise_agent_scope';

type PlatformKind = 'agents' | 'knowledge' | 'general-skills' | 'skills' | 'tools';

type PlatformConfig = {
  kind: PlatformKind;
  title: string;
  subtitle: string;
  detail: string;
  useLabel: string;
  icon: ReactNode;
};

type PlatformItem = {
  id: string;
  title: string;
  description: string;
  meta: string;
  tags: string[];
  agent?: AgentProfileRead;
};

const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    kind: 'agents',
    title: '数字员工广场',
    subtitle: '已发布给任务派发台选择的数字员工。',
    detail: '选择一个开放员工查看能力、岗位和服务范围。',
    useLabel: '使用员工',
    icon: <RobotOutlined />,
  },
  {
    kind: 'knowledge',
    title: '业务知识广场',
    subtitle: '可学习到当前员工的业务资料和 LLM Wiki。',
    detail: '从广场资料学习到当前员工的业务资料库。',
    useLabel: '新增到员工资料',
    icon: <FileSearchOutlined />,
  },
  {
    kind: 'general-skills',
    title: '通用技能广场',
    subtitle: '浏览器、MCP、查询工具等可复用通用能力。',
    detail: '从广场技能学习到当前员工的已掌握技能。',
    useLabel: '新增到已掌握技能',
    icon: <SolutionOutlined />,
  },
  {
    kind: 'skills',
    title: 'SOP 广场',
    subtitle: '可学习和复用的业务流程与执行规范。',
    detail: '从广场 SOP 学习到当前员工的 SOP 管理。',
    useLabel: '新增到 SOP 管理',
    icon: <ProfileOutlined />,
  },
  {
    kind: 'tools',
    title: '工具广场',
    subtitle: '可开放给员工调用和测试的工具能力。',
    detail: '进入工具箱按现有新增流程配置和测试工具。',
    useLabel: '进入工具新增',
    icon: <ToolOutlined />,
  },
];

const PLATFORM_BY_KIND = new Map(PLATFORM_CONFIGS.map((item) => [item.kind, item]));

export default function OpenPlatformPage({
  currentUser,
  isAdmin = false,
}: {
  currentUser?: EnterpriseAuthUser;
  isAdmin?: boolean;
}) {
  const navigate = useNavigate();
  const { kind } = useParams<{ kind?: PlatformKind }>();
  const selectedKind = kind && PLATFORM_BY_KIND.has(kind) ? kind : undefined;
  const [agents, setAgents] = useState<AgentProfileRead[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseRead[]>([]);
  const [generalSkills, setGeneralSkills] = useState<GeneralSkillRead[]>([]);
  const [skills, setSkills] = useState<SkillRead[]>([]);
  const [tools, setTools] = useState<ToolRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [agentId, setAgentId] = useState(() => window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY) || '');

  useEffect(() => {
    const onScopeChange = (event: Event) => {
      const nextAgentId = (event as CustomEvent<{ agentId?: string }>).detail?.agentId
        || window.localStorage.getItem(ENTERPRISE_AGENT_STORAGE_KEY)
        || '';
      setAgentId(nextAgentId);
    };
    window.addEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
    return () => window.removeEventListener('ultrarag-enterprise-agent-scope-change', onScopeChange);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const agentRows = await api.get<AgentProfileRead[]>(`/api/enterprise/agents?tenant_id=${TENANT_ID}`);
        const overall = agentRows.find((item) => item.is_overall);
        const overallSuffix = overall ? `&agent_id=${encodeURIComponent(overall.id)}` : '';
        const [kbRows, generalRows, skillRows, toolRows] = await Promise.all([
          api.get<KnowledgeBaseRead[]>(`/api/enterprise/knowledge-bases?tenant_id=${TENANT_ID}${overallSuffix}`),
          api.get<GeneralSkillRead[]>(`/api/enterprise/general-skills?tenant_id=${TENANT_ID}${overallSuffix}`),
          overall
            ? api.get<SkillRead[]>(`/api/enterprise/agents/${overall.id}/skills?tenant_id=${TENANT_ID}`)
            : Promise.resolve([]),
          api.get<ToolRead[]>(`/api/enterprise/tools?tenant_id=${TENANT_ID}`),
        ]);
        setAgents(agentRows);
        setKnowledgeBases(kbRows);
        setGeneralSkills(generalRows);
        setSkills(skillRows);
        setTools(toolRows);
      } catch (error) {
        message.error(error instanceof Error ? error.message : '加载开放平台失败');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const visibleAgents = useMemo(
    () => agents.filter((item) => !item.is_overall && item.status === 'active' && isGalleryEmployee(item)),
    [agents],
  );
  const currentAgent = agents.find((item) => item.id === agentId);
  const targetEmployee = !currentAgent?.is_overall && currentAgent
    ? currentAgent
    : agents.find((item) => !item.is_overall && (isAdmin || isEmployeeOwnedBy(item, currentUser) || isGalleryEmployee(item)));

  const platformItems = useMemo<Record<PlatformKind, PlatformItem[]>>(() => ({
    agents: visibleAgents.map((item) => {
      const profile = employeeProfile(item);
      return {
        id: item.id,
        title: employeeDisplayName(item),
        description: item.description || '开放给任务派发台选择的数字员工。',
        meta: profile.roleName,
        tags: [
          item.status === 'active' ? '在线' : '下线',
          `SOP ${resourceCount(item, 'skill')}`,
          `技能 ${resourceCount(item, 'general_skill')}`,
        ],
        agent: item,
      };
    }),
    knowledge: knowledgeBases
      .filter((item) => item.status === 'active' && !isEmptyDefaultKnowledgeBase(item))
      .map((item) => ({
        id: item.id,
        title: item.name,
        description: item.description || '开放平台沉淀的业务资料。',
        meta: `${item.document_count} 文档 / ${item.bucket_count} 桶 / ${item.chunk_count} 片段`,
        tags: [item.version || 'v1.0.0', item.branch_sync_state || '广场版'],
      })),
    'general-skills': generalSkills
      .filter((item) => item.status === 'published')
      .map((item) => ({
        id: item.id,
        title: item.name,
        description: item.description || '可被员工学习的通用技能。',
        meta: item.slug,
        tags: [item.homepage ? '外部能力' : '内置能力', '已启用'],
      })),
    skills: skills
      .filter((item) => item.status === 'published')
      .map((item) => ({
        id: item.id,
        title: item.name,
        description: item.description || '可被员工学习的业务 SOP。',
        meta: `${item.skill_id} / ${item.version}`,
        tags: [item.business_domain || '业务流程', `${item.total_call_count || item.call_count || 0} 次调用`],
      })),
    tools: tools
      .filter((item) => item.enabled)
      .map((item) => ({
        id: item.id,
        title: item.display_name || item.name,
        description: item.description || '可配置到员工工具箱的工具。',
        meta: `${item.bucket || '工具箱'} / ${item.tool_type.toUpperCase()}`,
        tags: [item.method, item.enabled ? '已启用' : '已停用'],
      })),
  }), [generalSkills, knowledgeBases, skills, tools, visibleAgents]);

  const platformStats = PLATFORM_CONFIGS.map((config) => ({
    ...config,
    count: platformItems[config.kind].length,
  }));

  function ensureTargetEmployee(): boolean {
    if (!targetEmployee) {
      message.warning('请先选择一个具体数字员工，再从开放平台新增能力');
      return false;
    }
    if (targetEmployee.id !== agentId) {
      window.localStorage.setItem(ENTERPRISE_AGENT_STORAGE_KEY, targetEmployee.id);
      window.dispatchEvent(new CustomEvent('ultrarag-enterprise-agent-scope-change', { detail: { agentId: targetEmployee.id } }));
      setAgentId(targetEmployee.id);
    }
    return true;
  }

  function usePlatformItem(platformKind: PlatformKind, itemId?: string) {
    if (platformKind === 'agents') {
      const agent = visibleAgents.find((item) => item.id === itemId) || visibleAgents[0];
      if (!agent) {
        message.warning('员工广场暂无可用员工');
        return;
      }
      window.localStorage.setItem(ENTERPRISE_AGENT_STORAGE_KEY, agent.id);
      window.dispatchEvent(new CustomEvent('ultrarag-enterprise-agent-scope-change', { detail: { agentId: agent.id } }));
      navigate('/enterprise/dashboard');
      return;
    }
    if (!ensureTargetEmployee()) return;
    const resourceParam = itemId ? `&resourceId=${encodeURIComponent(itemId)}` : '';
    if (platformKind === 'knowledge') navigate(`/enterprise/knowledge?add=plaza${resourceParam}`);
    if (platformKind === 'general-skills') navigate(`/enterprise/general-skills?add=plaza${resourceParam}`);
    if (platformKind === 'skills') navigate(`/enterprise/skills?add=plaza${resourceParam}`);
    if (platformKind === 'tools') navigate('/enterprise/tools?add=plaza');
  }

  if (selectedKind) {
    const config = PLATFORM_BY_KIND.get(selectedKind) || PLATFORM_CONFIGS[0];
    const items = platformItems[selectedKind];
    return (
      <div className="page open-platform-page">
        <div className="page-title open-platform-title">
          <div>
            <Typography.Text type="secondary">开放广场平台 / {config.title}</Typography.Text>
            <Typography.Title level={2}>{config.title}</Typography.Title>
            <Typography.Paragraph type="secondary">{config.detail}</Typography.Paragraph>
          </div>
          <Space wrap>
            <Button onClick={() => navigate('/enterprise/platform')}>返回平台</Button>
            <Button type="primary" onClick={() => usePlatformItem(selectedKind)}>
              {config.useLabel}
            </Button>
          </Space>
        </div>
        <Card className="open-platform-detail-card" loading={loading}>
          {items.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无开放内容" />
          ) : (
            <div className="open-platform-resource-grid">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="open-platform-resource-card"
                  onClick={() => usePlatformItem(selectedKind, item.id)}
                >
                  {item.agent && <EmployeeAvatar agent={item.agent} size={48} />}
                  {!item.agent && <span className="open-platform-resource-icon">{config.icon}</span>}
                  <span className="open-platform-resource-copy">
                    <strong>{item.title}</strong>
                    <em>{item.meta}</em>
                    <span>{item.description}</span>
                    <span className="open-platform-tags">
                      {item.tags.slice(0, 3).map((tag) => <Tag key={tag}>{tag}</Tag>)}
                    </span>
                  </span>
                  <span className="open-platform-use">{config.useLabel}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="page open-platform-page">
      <div className="page-title open-platform-title">
        <div>
          <Typography.Text type="secondary">开放广场平台</Typography.Text>
          <Typography.Title level={2}>开放广场平台</Typography.Title>
          <Typography.Paragraph type="secondary">
            汇总数字员工、业务资料、通用技能、SOP 和工具五个广场。先查看详情，再把需要的能力新增到当前员工。
          </Typography.Paragraph>
        </div>
        <Tag className="open-platform-target" icon={<AppstoreOutlined />}>
          目标员工：{targetEmployee ? employeeDisplayName(targetEmployee) : '未选择'}
        </Tag>
      </div>
      <div className="open-platform-grid">
        {platformStats.map((item) => (
          <Card key={item.kind} className="open-platform-card" hoverable loading={loading}>
            <div className="open-platform-card-head">
              <span>{item.icon}</span>
              <strong>{item.count}</strong>
            </div>
            <Typography.Title level={4}>{item.title}</Typography.Title>
            <Typography.Paragraph type="secondary">{item.subtitle}</Typography.Paragraph>
            <div className="open-platform-card-actions">
              <Button onClick={() => navigate(`/enterprise/platform/${item.kind}`)}>
                查看详情 <RightOutlined />
              </Button>
              <Button type="primary" onClick={() => usePlatformItem(item.kind)}>
                {item.useLabel}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function resourceCount(agent: AgentProfileRead, resourceType: string): number {
  return (agent.resources || []).filter((item) => item.resource_type === resourceType && item.status !== 'inactive').length;
}

function isEmptyDefaultKnowledgeBase(item: KnowledgeBaseRead): boolean {
  return item.name === '默认知识库' && item.document_count === 0 && item.bucket_count === 0 && item.chunk_count === 0;
}

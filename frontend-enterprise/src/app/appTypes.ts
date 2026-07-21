export const ENTERPRISE_SIDEBAR_STORAGE_KEY = 'ultrarag_enterprise_sidebar_expanded';
export const MODEL_CONFIGS_UPDATED_EVENT = 'ultrarag-enterprise-model-configs-updated';

export type AgentCreateMode = 'copy' | 'blank';

export type AgentCreateFormState = {
  name: string;
  roleName: string;
  description: string;
  sourceMode: AgentCreateMode;
  copyFromAgentId: string;
};

export const EMPTY_AGENT_FORM: AgentCreateFormState = {
  name: '',
  roleName: '',
  description: '',
  sourceMode: 'copy',
  copyFromAgentId: '',
};

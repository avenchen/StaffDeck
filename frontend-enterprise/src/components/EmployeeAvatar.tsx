import type { EmployeeProfile } from '../employee';
import { employeeProfile } from '../employee';
import type { AgentProfileRead } from '../types';

type AvatarProfile = Pick<EmployeeProfile, 'avatarKind' | 'avatarImage' | 'avatarPreset' | 'avatarText' | 'avatarTone'>;

import avatarAfterSales from '../assets/staffdeck/staffdeck-avatar-after-sales.png';
import avatarCommerce from '../assets/staffdeck/staffdeck-avatar-commerce.png';
import avatarKnowledge from '../assets/staffdeck/staffdeck-avatar-knowledge.png';
import avatarOps from '../assets/staffdeck/staffdeck-avatar-ops.png';
import avatarOverall from '../assets/staffdeck/staffdeck-avatar-overall.png';
import avatarQuality from '../assets/staffdeck/staffdeck-avatar-quality.png';
import avatarService from '../assets/staffdeck/staffdeck-avatar-service.png';

const PRESET_AVATARS: Record<string, string> = {
  'service-orbit': avatarService,
  'after-sales-seal': avatarAfterSales,
  'knowledge-node': avatarKnowledge,
  'commerce-compass': avatarCommerce,
  'ops-grid': avatarOps,
  'quality-star': avatarQuality,
  overall: avatarOverall,
};

export default function EmployeeAvatar({
  agent,
  profile: profileOverride,
  size = 54,
  className = '',
}: {
  agent?: AgentProfileRead | null;
  profile?: AvatarProfile;
  size?: number;
  className?: string;
}) {
  const profile = profileOverride || employeeProfile(agent);
  const classes = [
    'employee-avatar',
    `tone-${profile.avatarTone || 'teal'}`,
    `avatar-preset-${profile.avatarPreset || 'service-orbit'}`,
    profile.avatarKind === 'upload' && profile.avatarImage ? 'is-uploaded-avatar' : '',
    className,
  ].filter(Boolean).join(' ');

  if (profile.avatarKind === 'upload' && profile.avatarImage) {
    return (
      <span className={classes} style={{ width: size, height: size }} aria-label="员工自定义头像">
        <img src={profile.avatarImage} alt="" />
      </span>
    );
  }

  return (
    <span className={classes} style={{ width: size, height: size }} aria-label={`${profile.avatarText || '员'}员工头像`}>
      <img src={PRESET_AVATARS[profile.avatarPreset || 'service-orbit'] || avatarService} alt="" />
    </span>
  );
}

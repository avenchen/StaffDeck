import type { EmployeeProfile } from '../employee';

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

export default function EmployeeAvatarMark({
  profile,
  fallback = '员',
  className = 'new-session-agent-logo',
}: {
  profile?: EmployeeProfile | null;
  fallback?: string;
  className?: string;
}) {
  const classes = [
    'employee-avatar-mark',
    className,
    `tone-${profile?.avatarTone || 'teal'}`,
    `avatar-preset-${profile?.avatarPreset || 'service-orbit'}`,
    profile?.avatarKind === 'upload' && profile.avatarImage ? 'is-uploaded-avatar' : '',
  ].filter(Boolean).join(' ');

  if (profile?.avatarKind === 'upload' && profile.avatarImage) {
    return (
      <span className={classes}>
        <img src={profile.avatarImage} alt="" />
      </span>
    );
  }

  return (
    <span className={classes} aria-label={`${profile?.avatarText || fallback}员工头像`}>
      <img src={PRESET_AVATARS[profile?.avatarPreset || 'service-orbit'] || avatarService} alt="" />
    </span>
  );
}

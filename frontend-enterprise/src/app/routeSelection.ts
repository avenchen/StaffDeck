/**
 * Map the current pathname to the sidebar's "selected" nav key.
 *
 * Extracted verbatim from the previous inline logic in App.tsx's Shell so the
 * shell stays a thin composition root. Pure function of the pathname.
 */
export function deriveSelectedRoute(pathname: string): string {
  const isDistillRoute = pathname === '/enterprise/skills/distill';
  return pathname === '/enterprise'
    ? '/enterprise/dashboard'
    : pathname.startsWith('/enterprise/platform')
      ? '/enterprise/platform'
      : pathname.startsWith('/enterprise/knowledge')
        ? '/enterprise/knowledge'
        : pathname.startsWith('/enterprise/general-skills')
          ? '/enterprise/general-skills'
          : pathname.startsWith('/enterprise/tools')
            ? '/enterprise/tools'
            : pathname.startsWith('/enterprise/scheduled-tasks')
              ? '/enterprise/scheduled-tasks'
              : isDistillRoute
                ? '/enterprise/skills'
                : pathname;
}

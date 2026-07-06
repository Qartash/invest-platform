import { colors } from '../theme';

export type ProjectPriority = 'low' | 'medium' | 'high';

export const PRIORITY_LEVELS: ProjectPriority[] = ['low', 'medium', 'high'];

export const PRIORITY_COLORS: Record<ProjectPriority, string> = {
  low: colors.success,
  medium: colors.warning,
  high: colors.danger,
};

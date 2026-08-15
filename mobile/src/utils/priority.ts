import { ThemeColors } from '../theme';

export type ProjectPriority = 'low' | 'medium' | 'high';

export const PRIORITY_LEVELS: ProjectPriority[] = ['low', 'medium', 'high'];

// A function of the palette rather than a constant: read at module load it would freeze the
// light theme's colours into every screen that shows a priority badge.
export const priorityColors = (c: ThemeColors): Record<ProjectPriority, string> => ({
  low: c.success,
  medium: c.warning,
  high: c.danger,
});

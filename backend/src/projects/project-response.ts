import { Project } from './entities/project.entity';
import { computeTicketPricing } from './pricing';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function computeDaysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / MS_PER_DAY));
}

export function toProjectResponse(project: Project) {
  const { founder, ...rest } = project;
  return {
    ...rest,
    founderName: founder?.fullName || founder?.username || founder?.email,
    pricing: computeTicketPricing(project),
    daysLeft: computeDaysLeft(project.deadline),
  };
}

import { ProjectsService } from './projects.service';
import { Project } from './entities/project.entity';
import { ProjectStatus } from '../common/enums';

// A project waiting on a moderator is in one of two situations, and the old code
// flattened them into one status. A draft waiting to go live is *gated* by the
// review. A funded project waiting on a typo fix is not gated by anything — the
// raise is over — and sending it to PENDING_REVIEW moved a finished project two
// rungs backwards and dropped it in the queue beside unreviewed drafts.
//
// These tests hold the two apart across the whole loop: propose, withdraw,
// approve, reject.

const FOUNDER_ID = 'founder-1';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    founderId: FOUNDER_ID,
    status: ProjectStatus.FUNDED,
    title: { en: 'Coffee roastery' },
    description: { en: 'Beans' },
    category: 'food',
    targetAmount: '5000000.00',
    collectedAmount: '5000000.00',
    ticketPrice: '43094.16',
    totalTickets: 100,
    ticketsSold: 100,
    priceTierCount: 4,
    priceTierIncrementPercent: '10.00',
    equityOfferedPercent: '40.00',
    pendingChanges: null,
    pendingChangeReason: null,
    deletedAt: null,
    deletionRequestedAt: null,
    ...overrides,
  } as unknown as Project;
}

function makeService(project: Project) {
  const projectsRepository = {
    findOne: jest.fn().mockResolvedValue(project),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (p: Project) => p),
  };
  const logsRepository = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => v),
  };
  // Notifications are a side effect of every review step; stubbed so the status
  // assertions below stay about statuses.
  const notifications = {
    notify: jest.fn(async () => undefined),
    notifyMany: jest.fn(async () => undefined),
    notifyAdmins: jest.fn(async () => undefined),
  };
  const ticketsService = { holderIds: jest.fn(async () => []) };
  const service = new ProjectsService(
    projectsRepository as never,
    logsRepository as never,
    {} as never,
    {} as never,
    {} as never,
    ticketsService as never,
    notifications as never,
  );
  return { service, projectsRepository, notifications };
}

describe('a live project with an edit awaiting review', () => {
  // The defect itself: 5 000 000 ֏ of finished project, and a reworded blurb sent
  // it back to "on moderation".
  it('keeps FUNDED while the edit waits', async () => {
    const project = makeProject();
    const { service } = makeService(project);

    const saved = await service.update('project-1', FOUNDER_ID, { title: { en: 'Roastery' } } as never);

    expect(saved.status).toBe(ProjectStatus.FUNDED);
    expect(saved.pendingChanges).toEqual({ title: { en: 'Roastery' } });
  });

  it('keeps ACTIVE while the edit waits, so the raise is not interrupted', async () => {
    const project = makeProject({ status: ProjectStatus.ACTIVE, ticketsSold: 40, collectedAmount: '2000000.00' });
    const { service } = makeService(project);

    const saved = await service.update('project-1', FOUNDER_ID, { title: { en: 'Roastery' } } as never);

    expect(saved.status).toBe(ProjectStatus.ACTIVE);
  });

  it('still reaches the moderation queue, on pendingChanges rather than status', async () => {
    const { service, projectsRepository } = makeService(makeProject());

    await service.findPendingReview();

    const [{ where }] = projectsRepository.find.mock.calls[0];
    expect(where).toEqual([
      expect.objectContaining({ status: ProjectStatus.PENDING_REVIEW }),
      expect.objectContaining({ pendingChanges: expect.anything() }),
    ]);
  });

  it('comes out of approval still FUNDED, not ACTIVE', async () => {
    const project = makeProject({ pendingChanges: { title: { en: 'Roastery' } } });
    const { service } = makeService(project);

    const saved = await service.approve('project-1', 'ok', 'mod-1', 'Moder');

    expect(saved.status).toBe(ProjectStatus.FUNDED);
    expect(saved.pendingChanges).toBeNull();
  });

  // Rejecting the edit is a verdict on the edit. The project is still funded and
  // still owes its holders a return; REJECTED would say otherwise.
  it('stays FUNDED when the edit is rejected', async () => {
    const project = makeProject({ pendingChanges: { title: { en: 'Roastery' } } });
    const { service } = makeService(project);

    const saved = await service.reject('project-1', 'no', 'mod-1', 'Moder');

    expect(saved.status).toBe(ProjectStatus.FUNDED);
    expect(saved.pendingChanges).toBeNull();
    expect(saved.title).toEqual({ en: 'Coffee roastery' });
  });

  it('lets the founder withdraw the edit without touching the status', async () => {
    const project = makeProject({ pendingChanges: { title: { en: 'Roastery' } } });
    const { service } = makeService(project);

    const saved = await service.cancelReview('project-1', FOUNDER_ID);

    expect(saved.status).toBe(ProjectStatus.FUNDED);
    expect(saved.pendingChanges).toBeNull();
  });

  // Without the status to lean on, "one edit at a time" has to be read off
  // pendingChanges — otherwise a second edit would overwrite the first while the
  // moderator was still looking at it.
  it('refuses a second edit while the first is waiting', async () => {
    const project = makeProject({ pendingChanges: { title: { en: 'Roastery' } } });
    const { service } = makeService(project);

    await expect(
      service.update('project-1', FOUNDER_ID, { description: { en: 'Arabica' } } as never),
    ).rejects.toThrow(/pending review/i);
  });
});

describe('a project that has never been live', () => {
  // Here the review really is the gate, and the status is the honest description.
  // None of the above may soften it.
  it('goes to PENDING_REVIEW when submitted from draft', async () => {
    const project = makeProject({ status: ProjectStatus.DRAFT, ticketsSold: 0, collectedAmount: '0.00' });
    const { service } = makeService(project);

    const saved = await service.update('project-1', FOUNDER_ID, { title: { en: 'Roastery' } } as never);

    expect(saved.status).toBe(ProjectStatus.PENDING_REVIEW);
  });

  it('becomes ACTIVE on approval', async () => {
    const project = makeProject({
      status: ProjectStatus.PENDING_REVIEW,
      ticketsSold: 0,
      collectedAmount: '0.00',
      pendingChanges: { title: { en: 'Roastery' } },
    });
    const { service } = makeService(project);

    const saved = await service.approve('project-1', 'ok', 'mod-1', 'Moder');

    expect(saved.status).toBe(ProjectStatus.ACTIVE);
  });

  it('becomes REJECTED on refusal', async () => {
    const project = makeProject({ status: ProjectStatus.PENDING_REVIEW, ticketsSold: 0, collectedAmount: '0.00' });
    const { service } = makeService(project);

    const saved = await service.reject('project-1', 'no', 'mod-1', 'Moder');

    expect(saved.status).toBe(ProjectStatus.REJECTED);
  });

  it('falls back to draft when the founder withdraws', async () => {
    const project = makeProject({ status: ProjectStatus.PENDING_REVIEW, ticketsSold: 0, collectedAmount: '0.00' });
    const { service } = makeService(project);

    const saved = await service.cancelReview('project-1', FOUNDER_ID);

    expect(saved.status).toBe(ProjectStatus.DRAFT);
  });
});

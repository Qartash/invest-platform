import { BadRequestException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { Project } from './entities/project.entity';
import { ProjectStatus } from '../common/enums';

// The three write paths that can reach a project's pricing — the founder's edit
// queue, the moderator's approval of that queue, and the moderator's direct edit.
// Each is exercised against a project that has already sold tickets, which is the
// only state where any of this matters.
//
// The repositories are stubs rather than a database: what is under test is the
// decision to refuse, and every refusal happens before anything is written. The
// save stub records what it was handed so a test can also assert that nothing was.

const FOUNDER_ID = 'founder-1';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    founderId: FOUNDER_ID,
    status: ProjectStatus.FUNDED,
    title: 'Coffee roastery',
    description: 'Beans',
    category: 'food',
    targetAmount: '5000000.00',
    collectedAmount: '5000000.00',
    // What deriveBaseTicketPrice yields for this goal, ticket count and round
    // layout. It has to agree, or normalizeEdit re-deriving over an untouched
    // field would look like a price change to every test below.
    ticketPrice: '43094.16',
    totalTickets: 100,
    ticketsSold: 100,
    priceTierCount: 4,
    priceTierIncrementPercent: '10.00',
    equityOfferedPercent: '40.00',
    expectedAnnualReturnPercent: '20.00',
    payoutStartDays: 90,
    resaleEnabled: false,
    youtubeUrl: null,
    deadline: null,
    pendingChanges: null,
    pendingChangeReason: null,
    statusBeforeReview: null,
    deletedAt: null,
    deletionRequestedAt: null,
    ...overrides,
  } as unknown as Project;
}

function makeService(project: Project) {
  const saved: Project[] = [];
  const projectsRepository = {
    findOne: jest.fn().mockResolvedValue(project),
    save: jest.fn(async (p: Project) => {
      saved.push(p);
      return p;
    }),
  };
  const logsRepository = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => v),
  };
  const service = new ProjectsService(
    projectsRepository as never,
    logsRepository as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, saved, projectsRepository };
}

describe('editing a project that has sold tickets', () => {
  // 1.1 from the 27.07 run, reproduced exactly: the founder proposes half the
  // tickets on a sold-out project. Before the guard this returned 200 and parked
  // the change in pendingChanges, where a moderator could apply it.
  it('refuses a founder edit dropping totalTickets below ticketsSold', async () => {
    const project = makeProject();
    const { service, saved } = makeService(project);

    await expect(service.update('project-1', FOUNDER_ID, { totalTickets: 50 } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(project.pendingChanges).toBeNull();
    expect(saved).toHaveLength(0);
  });

  // The other three price inputs reach the same harm by a different route, and
  // none of them had a check at all. Raising the ticket count is refused too: the
  // strict reading is that price is part of what the investor bought.
  it.each([
    ['totalTickets', { totalTickets: 200 }],
    ['targetAmount', { targetAmount: 9_000_000 }],
    ['priceTierCount', { priceTierCount: 6 }],
    ['priceTierIncrementPercent', { priceTierIncrementPercent: 25 }],
    ['equityOfferedPercent', { equityOfferedPercent: 60 }],
  ])('refuses a founder edit to %s', async (_field, dto) => {
    const project = makeProject();
    const { service, saved } = makeService(project);

    await expect(service.update('project-1', FOUNDER_ID, dto as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(saved).toHaveLength(0);
  });

  // The policy is about changing the promise, not about mentioning it. A form that
  // submits every field must not be refused for the ones it left alone.
  it('allows an edit that re-sends pricing at its current value', async () => {
    const project = makeProject();
    const { service } = makeService(project);

    const result = await service.update('project-1', FOUNDER_ID, {
      totalTickets: 100,
      targetAmount: 5_000_000,
      title: 'Coffee roastery, Yerevan',
    } as never);

    expect(result.pendingChanges).toEqual({ title: 'Coffee roastery, Yerevan' });
  });

  // The stored price is allowed to disagree with the derived one — repair-ticket-prices.ts
  // exists because it has. When it does, re-sending an untouched totalTickets makes
  // normalizeEdit re-derive, and the reprice arrives as a bare `ticketPrice` change
  // with none of the inputs alongside it. A guard watching only the inputs would
  // wave it through and silently move the price of a sold-out project.
  it('refuses a reprice that arrives only as a re-derived ticketPrice', async () => {
    const project = makeProject({ ticketPrice: '37691.47' });
    const { service, saved } = makeService(project);

    await expect(
      service.update('project-1', FOUNDER_ID, { totalTickets: 100, title: 'Same tickets' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(saved).toHaveLength(0);
  });

  // Text, cover and category were never the problem and must stay editable — the
  // strict policy would be useless if it froze the whole project.
  it('allows an edit to fields that carry no price', async () => {
    const project = makeProject();
    const { service } = makeService(project);

    const result = await service.update('project-1', FOUNDER_ID, {
      title: 'Coffee roastery, Yerevan',
      description: 'Arabica',
    } as never);

    expect(result.pendingChanges).toEqual({
      title: 'Coffee roastery, Yerevan',
      description: 'Arabica',
    });
  });

  // 1.2: the same numbers were legal when they were proposed. 90 tickets against
  // 80 sold is a fine edit; by the time the moderator got to it 15 more had gone.
  // The check has to run at the moment of applying, not only at the moment of
  // proposing, or approve writes a project with fewer tickets than it has sold.
  it('refuses to approve a change that went stale while it waited', async () => {
    const project = makeProject({
      ticketsSold: 95,
      totalTickets: 100,
      pendingChanges: { totalTickets: 90 },
      status: ProjectStatus.PENDING_REVIEW,
      statusBeforeReview: ProjectStatus.ACTIVE,
    });
    const { service, saved } = makeService(project);

    await expect(service.approve('project-1', 'looks fine', 'mod-1', 'Moder')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(project.totalTickets).toBe(100);
    expect(saved).toHaveLength(0);
  });

  // A change that is still valid must still go through, or the guard has broken
  // the queue rather than protected it.
  it('approves a change that is still valid', async () => {
    const project = makeProject({
      status: ProjectStatus.PENDING_REVIEW,
      statusBeforeReview: ProjectStatus.FUNDED,
      pendingChanges: { title: 'Coffee roastery, Yerevan' },
    });
    const { service } = makeService(project);

    const result = await service.approve('project-1', 'ok', 'mod-1', 'Moder');

    expect(result.title).toBe('Coffee roastery, Yerevan');
    expect(result.pendingChanges).toBeNull();
    expect(result.status).toBe(ProjectStatus.FUNDED);
  });

  // adminUpdate applied pendingChanges' cousin — a raw Object.assign — with no
  // check whatsoever, so the moderator could write by hand the state the founder
  // was just refused.
  it('refuses a moderator edit dropping totalTickets below ticketsSold', async () => {
    const project = makeProject();
    const { service, saved } = makeService(project);

    await expect(
      service.adminUpdate('project-1', { totalTickets: 50 } as never, 'mod-1', 'Moder'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(project.totalTickets).toBe(100);
    expect(saved).toHaveLength(0);
  });

  it('refuses a moderator edit dropping targetAmount below collectedAmount', async () => {
    const project = makeProject({ collectedAmount: '5000000.00' });
    const { service, saved } = makeService(project);

    await expect(
      service.adminUpdate('project-1', { targetAmount: 1_000_000 } as never, 'mod-1', 'Moder'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(saved).toHaveLength(0);
  });

  // The moderator keeps the override this path exists for: a genuinely mispriced
  // project still has to be repairable, and raising the ticket count breaks no
  // arithmetic. Only the impossible states are closed to them.
  it('allows a moderator to reprice within the invariants', async () => {
    const project = makeProject();
    const { service } = makeService(project);

    const result = await service.adminUpdate('project-1', { totalTickets: 200 } as never, 'mod-1', 'Moder');

    expect(result.totalTickets).toBe(200);
  });
});

describe('editing a project with nothing sold', () => {
  // Before the first sale there is no promise to keep, and the founder is still
  // designing the round. None of this may apply there.
  it('allows any pricing change', async () => {
    const project = makeProject({
      ticketsSold: 0,
      collectedAmount: '0.00',
      status: ProjectStatus.ACTIVE,
    });
    const { service } = makeService(project);

    const result = await service.update('project-1', FOUNDER_ID, {
      totalTickets: 50,
      targetAmount: 1_000_000,
      equityOfferedPercent: 60,
    } as never);

    expect(result.pendingChanges).toMatchObject({ totalTickets: 50, equityOfferedPercent: '60.00' });
  });
});

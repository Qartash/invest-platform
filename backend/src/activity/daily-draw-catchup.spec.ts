import { DataSource } from 'typeorm';
import { DailyDrawService } from './daily-draw.service';
import { ymd } from './streak';

/**
 * The catch-up run, which is the part of the draw that is not testable from `draw` itself:
 * which days it decides to settle, and whether it defers to another instance already doing it.
 *
 * Built by hand rather than through Nest's testing module — the repositories are never
 * reached, because `draw` is stubbed. What is under test is the loop around it.
 */
function serviceWith(locked: boolean) {
  const queryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([{ locked }]),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const dataSource = { createQueryRunner: () => queryRunner } as unknown as DataSource;

  const service = new DailyDrawService(
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    dataSource,
  );
  const draw = jest
    .spyOn(service, 'draw')
    .mockResolvedValue({ winners: 0, amount: 0, organicArrivals: 0 });

  return { service, draw, queryRunner };
}

describe('DailyDrawService catch-up', () => {
  it('draws every completed day in the window', async () => {
    const { service, draw } = serviceWith(true);
    await service.catchUpMissedDraws(5);
    expect(draw).toHaveBeenCalledTimes(5);
  });

  // The bug this exists for: `runTodaysDraw` only ever asked about today, so a day the
  // process slept through was never drawn and never could be — the next run's "today" was
  // a different date. Waking up has to settle the days that were missed.
  it('settles yesterday, which the schedule alone would have lost', async () => {
    const { service, draw } = serviceWith(true);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await service.catchUpMissedDraws(3);

    expect(draw).toHaveBeenCalledWith(ymd(yesterday));
  });

  // A day still in progress must not be settled: the winners are picked from who checked in,
  // so drawing at breakfast pays out the early risers and shuts out everybody after.
  it('never draws today', async () => {
    const { service, draw } = serviceWith(true);
    await service.catchUpMissedDraws(7);
    expect(draw).not.toHaveBeenCalledWith(ymd(new Date()));
  });

  it('does nothing when another instance holds the lock', async () => {
    const { service, draw } = serviceWith(false);
    await service.catchUpMissedDraws(7);
    expect(draw).not.toHaveBeenCalled();
  });

  // A connection kept per job, so a run that finds the lock taken must still give it back.
  it('always releases its connection', async () => {
    const { service, queryRunner } = serviceWith(false);
    await service.catchUpMissedDraws(7);
    expect(queryRunner.release).toHaveBeenCalled();
  });
});

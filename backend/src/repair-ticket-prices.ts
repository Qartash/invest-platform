import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from './app.module';
import { Project } from './projects/entities/project.entity';
import { computeTicketPricing, deriveBaseTicketPrice } from './projects/pricing';

/**
 * One-off repair for projects stored before the round-1 ticket price was derived
 * server-side. A price picked as `targetAmount / totalTickets` ignores the per-round
 * increase, so selling every ticket raises more than the goal — 34% more at the default
 * 4 rounds and +20%, which is what made the funding numbers disagree with the goal.
 *
 * Run with no flags to see what it would change:
 *   npm run repair:prices
 *   npm run repair:prices -- --apply
 *   npm run repair:prices -- --apply --include-sold
 *
 * Projects that already sold tickets are held back behind --include-sold on purpose:
 * repricing them fixes the goal arithmetic but leaves collectedAmount and the unitPrice
 * on each past purchase quoted in the old prices, so the project trades one
 * inconsistency for another. Re-seeding a dev database is usually the cleaner fix.
 */
async function main() {
  const apply = process.argv.includes('--apply');
  const includeSold = process.argv.includes('--include-sold');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const projectsRepo = app.get<Repository<Project>>(getRepositoryToken(Project));

  const projects = await projectsRepo.find();
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

  let repaired = 0;
  let held = 0;
  let alreadyCorrect = 0;

  for (const project of projects) {
    const target = parseFloat(project.targetAmount);
    const currentBase = parseFloat(project.ticketPrice);
    const correctBase = deriveBaseTicketPrice({
      targetAmount: target,
      totalTickets: project.totalTickets,
      priceTierCount: project.priceTierCount,
      incrementPercent: parseFloat(project.priceTierIncrementPercent),
    });

    if (correctBase <= 0 || correctBase.toFixed(2) === currentBase.toFixed(2)) {
      alreadyCorrect++;
      continue;
    }

    const raiseAt = (base: number) =>
      computeTicketPricing({
        ticketPrice: base.toFixed(2),
        targetAmount: project.targetAmount,
        totalTickets: project.totalTickets,
        ticketsSold: 0,
        priceTierCount: project.priceTierCount,
        priceTierIncrementPercent: project.priceTierIncrementPercent,
      }).tiers.reduce((sum, tier) => sum + tier.price * (tier.ticketsTo - tier.ticketsFrom), 0);

    const title = project.title?.en ?? project.title?.ru ?? project.id;
    const before = raiseAt(currentBase);
    const after = raiseAt(correctBase);

    console.log(`\n${title}`);
    console.log(`  goal            ${fmt(target)}`);
    console.log(`  base price      ${fmt(currentBase)} -> ${fmt(correctBase)}`);
    console.log(`  full sell-out   ${fmt(before)} (${((before / target - 1) * 100).toFixed(1)}% off goal) -> ${fmt(after)}`);

    if (project.ticketsSold > 0 && !includeSold) {
      held++;
      console.log(`  HELD BACK: ${project.ticketsSold} ticket(s) already sold at the old prices.`);
      console.log('             Repricing would leave collectedAmount and past purchase');
      console.log('             history quoted in prices this project no longer has.');
      console.log('             Pass --include-sold to reprice anyway.');
      continue;
    }

    if (project.ticketsSold > 0) {
      console.log(`  WARNING: repriced despite ${project.ticketsSold} sold ticket(s) — collectedAmount`);
      console.log(`           (${fmt(parseFloat(project.collectedAmount))}) still reflects the old prices.`);
    }

    if (apply) {
      await projectsRepo.update(project.id, { ticketPrice: correctBase.toFixed(2) });
      console.log('  APPLIED');
    }
    repaired++;
  }

  console.log(
    `\n${alreadyCorrect} already consistent, ${repaired} ${apply ? 'repaired' : 'to repair'}, ${held} held back.`,
  );
  if (!apply && repaired > 0) console.log('Dry run — nothing written. Re-run with --apply.');

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

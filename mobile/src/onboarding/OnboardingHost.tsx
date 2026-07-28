import React, { useCallback, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { navigationRef } from '../navigation/navigationRef';
import { peekQuery } from '../api/useCachedQuery';
import { Project } from '../types';
import { IntroSlides } from './IntroSlides';
import { TourOverlay } from './TourOverlay';
import { TOURS } from './steps';
import { useTourStore } from './tourStore';
import { StepRoute, TourStep } from './types';

/**
 * Drives whatever piece of onboarding is currently owed: the welcome slides for an account
 * that has never seen them, then whichever tour a screen has asked for.
 *
 * It sits beside the navigator rather than inside a screen, for the same reason `AlertHost`
 * does — a tour walks between screens, so it cannot belong to any one of them.
 */
export function OnboardingHost() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useTourStore((s) => s.hydrated);
  const seenIntro = useTourStore((s) => s.seenIntro);
  const active = useTourStore((s) => s.active);
  const markIntroSeen = useTourStore((s) => s.markIntroSeen);
  const skipIntro = useTourStore((s) => s.skipIntro);
  const startTour = useTourStore((s) => s.startTour);
  const next = useTourStore((s) => s.next);
  const prev = useTourStore((s) => s.prev);
  const end = useTourStore((s) => s.end);

  const tour = active ? TOURS[active.tour] : null;
  const step = tour && active ? tour.steps[active.index] : null;
  const stepId = step?.id;

  // Walk to the step's screen. Keyed on the step id rather than the object so a re-render
  // that produces an equal step does not re-navigate (and reset the screen's own state).
  useEffect(() => {
    if (!step) return;
    const route = routeForStep(step);
    if (route) navigateTo(route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId]);

  const handleIntroDone = useCallback(() => {
    markIntroSeen();
    // The slides say what the platform is; the investor tour is what it looks like. Running
    // them back to back is the whole first-run experience, and the tour is skippable from
    // its first step.
    startTour('investor');
  }, [markIntroSeen, startTour]);

  if (!user || !hydrated) return null;

  if (!seenIntro) return <IntroSlides onDone={handleIntroDone} onSkip={skipIntro} />;

  if (!tour || !step || !active) return null;

  return (
    <TourOverlay
      key={step.id}
      stepId={step.id}
      target={step.target}
      index={active.index}
      total={tour.steps.length}
      onNext={() => next(tour.steps.length)}
      onPrev={prev}
      onSkip={end}
    />
  );
}

/**
 * Where a step wants to be shown.
 *
 * Project steps carry no route of their own because the project they describe is whatever
 * this person's feed happens to hold. With an empty feed there is nothing to open, and the
 * step stays where the user is — centred, still readable.
 */
function routeForStep(step: TourStep): StepRoute | null {
  if (step.route) return step.route;
  if (!step.id.startsWith('project.')) return null;

  const projects = peekQuery<Project[]>('projects:active');
  const projectId = projects?.[0]?.id;
  if (!projectId) return null;

  return { tab: 'HomeTab', screen: 'ProjectDetail', params: { projectId } };
}

function navigateTo(route: StepRoute): void {
  if (!navigationRef.isReady()) return;
  const params = route.screen ? { screen: route.screen, params: route.params } : undefined;
  // The container ref is typed against a root param list this app never declares, so every
  // route name reduces to `never`. The names come from `steps.ts`, which is checked against
  // the navigators by hand — this cast is where that hand-checking is admitted.
  (navigationRef.navigate as (name: string, params?: unknown) => void)(route.tab, params);
}

// Repeats what global-setup.ts already did, in the worker process that actually
// boots the app. Jest forks workers, so the environment they inherit depends on
// when the fork happened; doing it here as well means the guarantee does not
// rest on that timing. The check is cheap and opening a connection to the wrong
// database is not recoverable.
import { assertLocalTarget, loadTestEnv } from './local-database';

loadTestEnv();
assertLocalTarget();

/// <reference types="node" />
// Endpoints of the test environment started by scripts/test-env.sh (its
// default ports); CONDUCTOR_URL / JOBWORKERP_URL point elsewhere, e.g. in CI.
export const TEST_CONDUCTOR_URL = process.env.CONDUCTOR_URL ?? "http://127.0.0.1:19090"
export const TEST_JOBWORKERP_URL = process.env.JOBWORKERP_URL ?? "http://127.0.0.1:19000"
/** A second, separate jobworkerp, for moving managed workers between servers. */
export const TEST_JOBWORKERP2_URL = process.env.JOBWORKERP2_URL ?? "http://127.0.0.1:19001"
/** A conductor of its own, for tests that clear or overwrite every setting. */
export const TEST_CLEAR_CONDUCTOR_URL = process.env.CLEAR_CONDUCTOR_URL ?? "http://127.0.0.1:19190"
export const TEST_CLEAR_JOBWORKERP_URL =
  process.env.CLEAR_JOBWORKERP_URL ?? "http://127.0.0.1:19100"

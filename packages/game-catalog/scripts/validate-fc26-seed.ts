import { FC26_CATALOG_FIXTURE, validateFc26Fixture } from '../src';

/* eslint-disable no-console -- CLI validation summary is intentionally written to stdout. */
validateFc26Fixture();
console.log(
  `FC 26 fixture valid: ${String(FC26_CATALOG_FIXTURE.platforms.length)} platforms, ` +
    `${String(FC26_CATALOG_FIXTURE.modes.length)} modes, ${String(FC26_CATALOG_FIXTURE.rulesets.length)} rulesets.`,
);

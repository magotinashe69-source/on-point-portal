// Making a check script tidy up after itself even when it falls over.
//
// The check scripts run against a LIVE database. Each one creates pupils,
// assignments, parent accounts and saved questions, and each one deleted them
// again at the end of a successful run — which is exactly the wrong place for
// it, because a run that ends successfully is the run that least needs saving.
//
// A crash partway through left its fixtures on the register for ever. That is
// how "Certificate Child 332988" ended up on a real school's roll: the dev
// server restarted mid-run (it watches for changes now), a fetch failed, the
// script threw, and the tidy-up at the bottom of main() never ran.
//
// So a fixture registers its own removal AT THE MOMENT IT IS CREATED, and the
// removals run in a `finally`. Whatever happens — pass, fail, throw, or the
// server disappearing halfway — what was made gets unmade.

type Cleanup = () => Promise<unknown>;

const registered: { what: string; run: Cleanup }[] = [];

/**
 * Register something to be removed when the run ends.
 *
 * Call it as soon as the thing exists, not at the end of the script — the
 * whole point is to survive never reaching the end.
 */
export function onCleanup(what: string, run: Cleanup): void {
  registered.push({ what, run });
}

/**
 * Run every registered removal, newest first.
 *
 * Newest first because fixtures are often built on each other — a submission
 * belongs to an assignment, a parent account to a pupil — so unwinding in
 * reverse order is the one that does not trip over its own dependencies.
 *
 * Every failure is swallowed and counted rather than thrown. This runs in a
 * `finally`, and a cleanup that throws there would replace the real error with
 * a misleading one — the script would report a tidy-up problem instead of the
 * failure that actually caused it.
 */
export async function runCleanups(): Promise<void> {
  if (registered.length === 0) return;

  let removed = 0;
  const failures: string[] = [];

  for (const item of [...registered].reverse()) {
    try {
      await item.run();
      removed++;
    } catch (error) {
      failures.push(`${item.what}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  registered.length = 0;

  console.log(`\nCleaned up ${removed} of ${removed + failures.length} things this check created.`);
  if (failures.length > 0) {
    // Said loudly: something this script made is still on the register, and
    // somebody has to know which.
    console.log("COULD NOT REMOVE:");
    for (const f of failures) console.log(`   ${f}`);
  }
}

/**
 * Run a check script's body, then tidy up and report — whatever happened.
 *
 * `summary` prints the pass/fail line and returns true when the run was clean.
 * The exit code is set here rather than inside the script, so a crash cannot
 * end up reported as a pass: a thrown error is a failed run even if every
 * check that managed to execute passed.
 */
export async function runCheck(
  body: () => Promise<void>,
  summary: () => boolean,
): Promise<void> {
  let crashed: unknown = null;
  try {
    await body();
  } catch (error) {
    crashed = error;
  }

  await runCleanups();

  const clean = summary();

  if (crashed) {
    console.error("\nThe check did not finish:");
    console.error(crashed instanceof Error ? (crashed.stack ?? crashed.message) : crashed);
    console.error("\nEvery check that ran before this point still counted, but the run is a FAILURE.");
  }

  // Never process.exit(): it tears down fetch's keep-alive sockets and, on Node
  // 24 for Windows, trips a libuv assertion that reports a green run as 127.
  process.exitCode = clean && !crashed ? 0 : 1;
}

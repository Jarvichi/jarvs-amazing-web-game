import type { Reporter, SerializedError, TestModule, TestRunEndReason } from 'vitest/node';

// In a Claude Code cloud session, PLAYWRIGHT_BROWSERS_PATH points at a
// container image whose pre-installed chromium/chrome-headless-shell
// revision doesn't always match the `playwright` version pinned in
// package.json (#2344). When that happens, the 'storybook' project's
// browser-mode tests fail to even launch: vitest reports it as a single
// background "Unhandled Error" at teardown while the `Test Files`/`Tests`
// summary line still reads "N passed" for whatever *did* collect — so a
// run with zero visual coverage looks identical to a full green one.
// Surface that gap loudly instead of letting it hide in the noise.
export function browserSkipBanner(): Reporter {
  return {
    onTestRunEnd(
      testModules: readonly TestModule[],
      unhandledErrors: readonly SerializedError[],
      _reason: TestRunEndReason,
    ) {
      const storybookModules = testModules.filter(m => m.project.name === 'storybook');
      const launchFailure = unhandledErrors.find(e => /browserType\.launch/.test(e.message ?? ''));
      if (storybookModules.length === 0 && launchFailure) {
        console.error(
          '\n' + '═'.repeat(70) + '\n' +
          '⚠  BROWSER-MODE TESTS DID NOT RUN — 0 "storybook" project files collected\n' +
          '   Playwright could not launch its browser (see the error above).\n' +
          '   This is expected in a Claude Code cloud session (see AGENTS.md) —\n' +
          '   visual/story coverage only actually runs on CI there. Do not read\n' +
          '   the "Test Files"/"Tests" summary above as full coverage.\n' +
          '═'.repeat(70) + '\n',
        );
      }
    },
  };
}

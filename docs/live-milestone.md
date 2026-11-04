# First live incident

Verified November 4, 2026. Public workflow repository: https://github.com/greyw0rks/chainroom. Controlled fixture: https://github.com/greyw0rks/chainroom-demo. Reviewed fix: https://github.com/greyw0rks/chainroom-demo/pull/1.

| Step | Actual result |
| --- | --- |
| Human report | A builder posted the controlled USDC regression through Mattermost. |
| Triage | Assigned CR-001 and delegated to Engineer through Switch in the original thread. |
| Native Retry | Retried the original failed Engineer handoff without posting another report; execution completed. |
| Reproduction | 75000000 atomic USDC units at 6 decimals produced 0.000000000075; two tests failed. |
| Engineer proposal | Commit `4972a245fefdb72792c42eb833b813136b8e3cfa` changes only `src/balance.ts`; all six tests pass. |
| Sentinel review | Independent detached clone passed six tests, whitespace checks, 666 balance cases, 83 invalid-input rejection cases and four explicit regression/boundary assertions. |
| Human decision | Builder approved the full reviewed SHA in the dashboard; authenticated approval was recorded in the incident thread. |
| Publication | Fresh live approval and snapshot checks passed; exact commit was pushed and PR #1 opened. |

The demo's main branch stays at baseline `c719c0f5d7c56140dd7891f9a1ba63ad6b84d096`. The PR is open; no merge or deployment was performed. The fixture is an intentionally introduced regression, and this evidence does not establish production integration. Sentinel's additional boundary probes are outside the committed demo suite.

Private Switch history is the full coordination record. Runtime exports, credentials, native sessions and browser captures are excluded from the public repository. The publication gate reads authenticated Switch history instead of treating an export as approval authority.

Local dashboard: http://127.0.0.1:3018. Native Retry supports the current model or the three builder-confirmed choices: `gpt-6.1-sol`, `gpt-6-astra`, `gpt-5.6-sol`. The selected credential remains private and the existing provider configuration is preserved.

Verification: 59 automated checks; live desktop/mobile dashboard checks; unauthorized reads, decisions and retries without origin/CSRF verification refused; GitHub PR head and baseline rechecked after publication.

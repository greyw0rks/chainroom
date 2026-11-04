# Resume Chainroom

Project root: /home/greyw0rks/chainroom. The first live workflow completed on November 4, 2026: human Mattermost report → Triage delegation → Engineer native Retry and tested commit → Sentinel independent review → human exact-SHA approval → GitHub PR.

Public project: https://github.com/greyw0rks/chainroom.
Controlled demo: https://github.com/greyw0rks/chainroom-demo.
Reviewed fix: https://github.com/greyw0rks/chainroom-demo/pull/1.

## Current state

- PR #1 is OPEN at commit 4972a245fefdb72792c42eb833b813136b8e3cfa; only src/balance.ts changed.
- Demo main preserves baseline c719c0f5d7c56140dd7891f9a1ba63ad6b84d096.
- Human approval message: sw_929c44e4c3564a1c9481650f144462df.
- Sentinel PASS review: sw_2aea55b06e194e17a3336d7b0f2e236b.
- Verified publication record in the original thread: sw_755fb8cf650b4ad8bb14f02338191820.
- Switch room: 04784c53-cbba-42c3-8d14-33a8b6978c9f.
- Original human report/thread: sw_c7eef0cc7bc1315a011120a29f3a032c.

Both roles independently passed all six tests and whitespace checks. Sentinel also passed 666 balance cases across decimals 0..36, 83 invalid-input rejection cases and four explicit boundary/regression assertions. Additional boundary probes are outside the committed demo suite; production integration was not tested. No merge or deployment was performed.

Earlier provider and shell PATH failures remain visible in the thread. Engineer's native Retry command 837ce8fa-182f-41c1-839e-48eb74735960 reused handoff sw_a1e7e56673034659b3651156bf8443e5 and completed without another report.

## Local access

Use numeric addresses from Windows:

- Mattermost: http://127.0.0.1:8066
- Gateway: http://127.0.0.1:8082
- Live evidence dashboard: http://127.0.0.1:3018

The browser proxy runs scripts/browser-access.mjs. Container services remain on loopback ports 8065, 8080 and 8000. Builder credentials are in ignored .env. The dashboard now displays the actual reviewed source diff and the recorded PR publication link.

## Controller and Retry

Prefix shell commands with /home/greyw0rks/ubuntu-to-debian-migration/bin/rtk proxy on this machine.

```sh
node scripts/run-controller.mjs
npm run dashboard
npm run retry
npm run retry -- engineer
npm run retry -- engineer gpt-6-astra
```

Keep the controller running. Do not start another copy of an existing listener. Retry is available only for the latest failed or interrupted incident turn while the session is idle. It sends native message.retry with an idempotency ID and preserves the original message/thread. Optional model selection sends native session.model.set first. Choices are gpt-6.1-sol, gpt-6-astra, and gpt-5.6-sol; keeping the current model is the default.

The signed controller package is unchanged. Its private local adapter uses mode-0600 Unix sockets with shortened hashes to fit Linux's pathname limit. Cold sessions are warmed through Switch.

The selected credential is read from /home/greyw0rks/keys.txt through ignored .runtime/provider-key-source.json (index 1). The existing AgentRouter URL and Responses API configuration are retained in the separate .runtime/codex-provider home. Global Codex configuration and history are preserved. Diagnostic-relay and fresh-conversation recovery flags are absent.

## Verification and follow-up

All 59 automated checks pass. Live desktop/mobile checks verify the SHA, source diff, PR link and local request protections without posting decisions. The publisher rereads authenticated Switch history and rechecks clean physical snapshots at publication boundaries. It supports Engineer's isolated clone and the Mattermost channel-history API. Runtime exports do not authorize publication.

Current long-running tool sessions: controller 12629, dashboard 75330. The preceding browser proxy is still running.

The authorized repositories and PR are published. The later demo-video/submission milestone is still pending; do not report it as complete. See [live milestone](live-milestone.md) and [build status](build-status.md).

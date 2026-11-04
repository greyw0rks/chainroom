# Chainroom submission

## Project title

Chainroom

## Tracks

Best Business Workflow

## Project description

Chainroom helps small engineering teams turn bug reports in chat into tested, independently reviewed pull requests. A builder reports an issue in a private Mattermost channel. Three Codex agents connected through Switch handle triage, investigation and review, with separate workspaces and all handoffs kept in the original incident thread. A human approves the exact reviewed commit before a deterministic publication gate can open a GitHub PR.

The working demo fixes an intentionally introduced USDC-decimals regression: 75 USDC displayed as 0.000000000075. Engineer reproduced the failure and proposed a source-only fix. Sentinel independently reran the tests and checked decimal boundaries and large balances. The builder approved the reviewed SHA, and Chainroom opened the real PR. Native Retry resumes a failed agent turn in its original session and thread when a provider request fails.

## GitHub repository

https://github.com/greyw0rks/chainroom

## Demo video

Pending the builder's render/export and a public or unlisted YouTube or Loom URL. Keep the final video under three minutes. The editable demo will include ElevenLabs narration using Jack John – Conversational and Upbeat.

## Live demo or deployment

Leave blank. The Switch stack and evidence dashboard run locally in Debian/WSL; localhost is not a public deployment.

## How did you use Switch?

I connected three Codex agents to a self-hosted Switch instance and a private Mattermost channel: Triage classifies the incident and delegates; Engineer reproduces the bug, creates an isolated Git worktree, fixes the source and commits passing tests; Sentinel checks that exact commit from its own detached snapshot and posts an independent verdict.

Switch is the shared coordination record. Agents use its room tools to read context, send targeted handoffs and post test evidence in the original report's thread. The human builder reports the issue in Mattermost, follows the evidence in chat or the local dashboard, and approves or rejects the full reviewed SHA. The publisher reads authenticated Switch history again before each publication step, checks the unchanged source patch and separate clean snapshots, then opens the GitHub PR. Agent approvals, failed reviews, stale commits and later human rejections cannot authorize publication.

For the actual CR-001 demo, both Engineer and Sentinel independently passed all six tests. Sentinel also checked 666 balance cases across decimals 0–36, 83 invalid-input rejection cases and four explicit boundary/regression assertions. The approved PR is https://github.com/greyw0rks/chainroom-demo/pull/1.

## What did you like, and what would you improve?

Switch gave the agents and the human one place to coordinate: channel history, targeted messages, room instructions and threaded evidence. I could connect my existing Codex provider, give each agent a distinct role and workspace, and keep the review and human decision attached to the exact source commit. Having the workflow visible in ordinary chat made it easier to see who was responsible for the next step.

The main friction was recovering from provider failures. I added a local dashboard that sends Switch's native Retry command for the original failed turn, with optional model selection, instead of reposting the incident. I would like the same thread-preserving recovery control in the standard chat interface, clearer provider errors and simpler credential forwarding for custom Codex providers. I also had to adapt history inspection because Switch 0.31's dedicated thread endpoint is gated to group chats; a consistent thread-history API for channel rooms would make evidence integrations easier.

## Optional track fields

- Pull requests: leave blank for Best Core Contribution; the demo PR is a fixture fix, not a Switch core contribution.
- Blog post: leave blank unless a build blog is published.
- Wispr usage card: leave blank unless a real Insights usage card is supplied. Do not claim Code with Wispr evidence without it.
- #HowISwitch post: leave blank unless a public post is published.

The final form has not been submitted. The required hosted demo URL is still pending.

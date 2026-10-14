# Frontend Kanban workflow

The [vstore-frontend GitHub Project](https://github.com/orgs/vstore-ex/projects/2) uses its linked GitHub Issue as the durable record of scope, acceptance criteria, dependencies, and evidence. Project Status shows the workflow stage. Use only the existing statuses: `Backlog`, `Ready`, `In progress`, `In review`, and `Done`.

## Status rules

| Status | Use when | Move forward when |
| --- | --- | --- |
| `Backlog` | The request is recorded but not selected, lacks an owner or required detail, or has an unresolved blocker. | It meets every `Ready` criterion and an owner is assigned. |
| `Ready` | The outcome and scope are clear; acceptance criteria are verifiable; an owner is assigned; dependencies are recorded and none prevents starting. State required tests where applicable. | The assignee actively starts work. |
| `In progress` | An assignee is actively working. Keep to the team's existing one-or-two active tasks per developer guideline. | Implementation is ready for review and a linked pull request is open. |
| `In review` | A linked pull request is open and awaiting review. | Review is complete and the pull request is merged; if changes are requested, return to `In progress`. |
| `Done` | Acceptance criteria are met, applicable tests and CI pass, independent review is complete, and the linked pull request is merged. | No further transition is defined. |

If a blocker is discovered during active work, leave the issue `In progress`. Add GitHub's native blocking relationship and record the blocker, its reason, and the next action in the issue. A blocked dependency must be resolved before the dependent issue can be `Ready`.

Deployment is part of `Done` only when the issue itself is a release or deployment task. Otherwise track deployment separately.

## Issue requirements

Before moving an issue to `Ready`, ensure it states:

- the problem and intended outcome;
- affected component and in-scope work (and important exclusions, if needed);
- verifiable acceptance criteria;
- an assigned owner;
- dependencies, including native blocking links where applicable;
- required tests or checks, when applicable.

Priority is optional while the Project has no configured Priority options. Size and Estimate are optional. Do not invent values, assignments, or dates to fill fields. The `ready-for-agent` triage label means sufficiently specified for agent execution; it does not replace Project Status. Do not mark `wontfix` work as `Ready` or active—reconcile a conflict with the issue owner. Use the workspace's canonical triage labels.

## Pull requests

Link each implementation pull request to its issue and move the Project item to `In review` while it is open. Use an auto-closing reference only when merging that pull request will satisfy the issue's `Done` criteria. A merged pull request alone is not enough to mark an issue `Done`; confirm acceptance evidence, applicable checks, and independent review.

## Dependencies and duplicates

Record dependencies with GitHub's native issue blocking relationship; do not invent a `Blocked` status or label. Keep the issue's description current with the blocker, reason, and next action.

Before creating an issue, search both open and closed issues for the same requested outcome, not just a matching title. If an existing issue covers the outcome, keep it canonical and extend it only with its owner's agreement. If a duplicate was created, link it to the canonical issue and ask the maintainer to decide disposition. Do not automatically overwrite, close, or migrate either issue.

This workflow does not change Project fields, statuses, labels, existing issues, or add automated status/WIP enforcement.

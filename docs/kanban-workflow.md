# Frontend Kanban workflow

This contract applies to GitHub Issues and their linked items in the [vstore-frontend Project](https://github.com/orgs/vstore-ex/projects/2). The issue holds durable requirements and acceptance criteria; the Project Status records workflow state. Keep the issue, pull request and Project item consistent.

Source: [issue #63](https://github.com/vstore-ex/vstore-front/issues/63), which draws on the workspace engineering plan's PM-01 and QA-03. Publishing these rules does not migrate existing cards or prove team adoption.

## Status contract

Use the five existing statuses:

| Status | Entry criteria | Exit criteria |
| --- | --- | --- |
| Backlog | Recorded work that is incomplete, not selected, lacks an owner, or has unresolved blockers to starting. | Move to Ready when all Ready criteria below are met. |
| Ready | Selected work meets the Ready checklist and can start. | Move to In progress when the assignee starts. If readiness is lost before work starts, return to Backlog and record what is missing. |
| In progress | An assignee is actively working on the issue. Follow the team's guideline of one or two active tasks per developer. | Move to In review with an open, linked PR. Newly discovered blockers stay In progress and follow the blocker rule below. |
| In review | An implementation PR is open and linked to the issue. | Return to In progress for requested changes requiring work. Move to Done only with all completion evidence below. A closed, unmerged PR is not completion. |
| Done | Acceptance criteria are met, applicable tests and CI pass, independent review is complete, and the linked PR is merged. | Production deployment is required only for an issue whose own scope is release or deployment; otherwise track deployment separately. |

## Ready checklist

Before selecting Ready, confirm the issue has:

- A clear problem and intended outcome.
- The affected component and scope, including relevant exclusions.
- Verifiable acceptance criteria and required tests where applicable.
- An agreed owner recorded as the assignee.
- Explicit dependencies (or a statement that there are none), with no unresolved issue blocking the start.

Do not invent assignments, priorities, dates or estimates to complete this checklist. Priority is optional while the Project has no configured options; Size and Estimate remain optional. The field configuration described in #63 is a drafting snapshot, not a requirement to create options.

Use the workspace's canonical triage labels. `ready-for-agent` means fully specified for agent execution and does not replace Project Status. Do not present `wontfix` work as Ready or active: reconcile the contradiction with the issue owner rather than silently changing labels or status.

## Blockers

Use GitHub's native **blocked by** relationship to the blocking issue. A plain issue mention does not replace the native dependency. Do not add a status or a `Blocked` label.

A blocker found before starting prevents Ready. A blocker discovered during active work keeps the item In progress. Record the reason and concrete next action in the issue, for example:

> Blocked by: [blocking issue link] (also set the native dependency).
> Reason: [what prevents progress].
> Next action: [what must happen to unblock the work].

When resolved, check the dependency and update the next action so the record reflects the current situation.

## Pull requests and Done evidence

Link every implementation PR to its issue. Use an automatic closing reference only if merging that PR satisfies the whole issue's completion criteria; otherwise use a non-closing reference such as `Refs #123`.

Before Done, verify evidence for every acceptance criterion, passing applicable tests and CI, completed independent review, and the merged PR. Self-review or an issue's closed state alone is insufficient. For release or deployment issues, also verify the deployment outcome required by their scope.

## Duplicate handling

Before creating an issue, search both open and closed issues by the requested outcome, not just title wording:

- `repo:vstore-ex/vstore-front is:issue is:open <outcome keywords>`
- `repo:vstore-ex/vstore-front is:issue is:closed <outcome keywords>`

Read likely matches, their acceptance criteria and linked PRs. Keep an existing issue canonical when it covers the outcome, preserving its discussion, history, dependencies and PR links. Extend its scope only with its owner's agreement.

For an accidental duplicate, link to the canonical issue and ask its maintainer to decide disposition. Do not automatically overwrite, close or reopen either record.

## Adoption checks

Validate observable behavior at the issue and its Project item together, using existing examples during adoption. This process specification introduces no application modules or code-level test suite.

| Example | Evidence to inspect |
| --- | --- |
| Ready work | Problem, outcome, component, scope, acceptance criteria, owner, dependencies and applicable test expectations are recorded. |
| Blocked before starting | A native blocking relationship is visible and the item is not Ready. |
| Blocked during active work | The item stays In progress, with a native dependency, reason and next action. |
| Review and changes requested | In review links an open PR; requested changes requiring work return the item to In progress. |
| Completed work | Done has acceptance evidence, passing applicable checks, independent review and a merged PR; deployment evidence is required only for release/deployment scope. |
| Equivalent or duplicate request | Open and closed issues were considered, canonical history is retained, and an accidental duplicate links to the canonical issue without automatic closure. |

Record the inspected issue, Project item and PR links, observed evidence and unresolved gaps. Missing access is an unperformed check, not a pass. Report contradictions to the owner for a separately authorized follow-up. The Ready/`wontfix` inconsistency noted in #63 is historical context, not permission to modify that issue or evidence of its current state.

## Scope limits

Adoption does not authorize reassigning, relabeling, closing or otherwise migrating existing issues; those changes require a separate task. Do not add or rename statuses, fields, labels or Priority options. Do not add bots or workflows for automatic transitions, WIP enforcement or label synchronization. Frontend architecture and feature requirements are outside this contract.

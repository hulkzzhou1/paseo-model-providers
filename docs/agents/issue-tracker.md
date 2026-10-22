# Issue tracker: GitHub

Issues, specifications, and implementation tickets live in GitHub Issues for `hulkzzhou1/paseo-model-providers`. Use `gh`; run commands from this clone, or pass `--repo hulkzzhou1/paseo-model-providers` explicitly.

## Issue operations

- Create: `gh issue create --title "..." --body-file /path/to/body.md`.
- Read: `gh issue view <number> --json number,title,body,labels,comments,assignees,state`.
- List: `gh issue list --state open --json number,title,labels,assignees`; add label filters as needed.
- Update a body: `gh issue edit <number> --body-file /path/to/body.md`.
- Comment: `gh issue comment <number> --body-file /path/to/comment.md`.
- Apply or remove labels: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- Claim: `gh issue edit <number> --add-assignee @me`.
- Close: `gh issue close <number>` after recording the outcome.

For multiline bodies and comments, write the exact Markdown to a temporary file and pass `--body-file`.

When a skill says “publish to the issue tracker”, create an issue. When it says “fetch the relevant ticket”, read that issue and its comments.

## Relationships and dependencies

Create child issues with `gh issue create --parent <parent> --title "..." --body-file /path/to/body.md`, or attach an existing child with `gh issue edit <parent> --add-sub-issue <child>`. If sub-issues are unavailable, use a task list in the parent and a `Part of #<parent>` line in each child.

Use native GitHub issue dependencies for blockers:

```sh
gh api repos/hulkzzhou1/paseo-model-providers/issues/<blocker-number> --jq .id
gh api --method POST repos/hulkzzhou1/paseo-model-providers/issues/<child-number>/dependencies/blocked_by -F issue_id=<blocker-database-id>
```

The dependency ID is the numeric database ID, not the issue number or node ID. Use `issue_dependencies_summary.blocked_by` to check for open blockers. If native dependencies are unavailable, record `Blocked by: #<number>` in the child and check each blocker's state.

For `/wayfinder`, the map is an issue labelled `wayfinder:map`; child tickets use `wayfinder:<type>` (`research`, `prototype`, `grilling`, or `task`). Create those labels when that workflow is invoked. Choose the first open, unassigned, unblocked child in map order, assign it to the driving developer, and record its resolution with a link in the map's Decisions-so-far.

## Pull requests as a triage surface

**PRs as a request surface: no.**

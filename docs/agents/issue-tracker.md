# Issue tracker: GitHub

Issues and PRDs for this repository live as GitHub issues in `datashaman/morrow`. Use the `gh` CLI for all operations.

## Conventions

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,body,labels,comments`
- Comment: `gh issue comment <number> --body "..."`
- Apply or remove labels: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

The `gh` CLI infers the repository from the Git remote when run inside this clone.

When a skill says to publish to the issue tracker, create a GitHub issue. When it says to fetch the relevant ticket, use `gh issue view <number> --comments`.

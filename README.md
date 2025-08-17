# JIRA PR Link Action

Automatically adds, updates, or removes JIRA ticket links in GitHub pull requests based on the PR title.

## Inputs

| Name             | Required | Description                                                                         |
| ---------------- | -------- | ----------------------------------------------------------------------------------- |
| `token`          | ✅       | GitHub token, usually `${{ secrets.GITHUB_TOKEN }}`                                 |
| `repository`     | ✅       | Full Repository Name (owner/repo_name) (e.g., `${{ github.repository }}`)           |
| `pr-number`      | ✅       | Pull request number (e.g., `${{ github.event.pull_request.number }}`)               |
| `jira-base-url`  | ✅       | Base JIRA URL (e.g., `https://yourcompany.atlassian.net`)                           |
| `jira-link-mode` | ❌       | Where to add the JIRA link in the PR body: `"body-start"` (default) or `"body-end"` |

## JIRA Ticket Format

This action detects JIRA tickets based on standard JIRA issue key formatting:  
`<PROJECTKEY>-<NUMBER>` (e.g., `ABC-123`).

- **PROJECTKEY** must be 2–10 uppercase letters (A–Z).
- **NUMBER** must be a positive integer (no leading zeros).

> TODO If your JIRA instance uses non-standard formats, you can provide a custom regex pattern using the `issue-pattern` input.

## Required Permissions

This action needs the following GitHub token permissions to run successfully:

- **`contents: read`** — Required to read repository content and pull request data.
- **`pull-requests: write`** — Required to update the pull request body or other PR attributes.

By default, GitHub Actions provides a `GITHUB_TOKEN` with read/write access to your repository.  
If you are running this action in a restricted environment, ensure that these minimum permissions are granted to the `GITHUB_TOKEN` or any personal access token you use.

## Example Workflow

```yaml
name: Add JIRA Links
on:
  pull_request:
    types: [opened, edited, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  add-jira-links:
    runs-on: ubuntu-latest
    steps:
      - uses: codenamegrant/jira-pr-link-action@v1
        with:
          jira-base-url: 'https://yourcompany.atlassian.net'
          github-token: ${{ secrets.GITHUB_TOKEN }}
          pr-number: ${{ github.event.pull_request.number }}
          github-owner: ${{ github.repository_owner }}
          github-repo: ${{ github.event.repository.name }}
          jira-link-mode: body-start
```

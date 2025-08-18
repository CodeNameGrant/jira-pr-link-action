import { GitHub } from '@actions/github/lib/utils';

// Specifies where to insert the JIRA link in the PR
// TODO: include include alts like 'comment' & 'label'
export type JiraLinkMode = 'body-start' | 'body-end';

// Represents the required input variables for the action
export interface InputVariables {
  token: string;
  jiraBaseUrl: string;
  jiraLinkMode: JiraLinkMode;
}

// Holds the regular expressions used for JIRA ticket and link detection
export interface JiraPatterns {
  JIRA_TICKET_REGEX: RegExp;
  JIRA_LINK_LINE_REGEX: RegExp;
}

// Type alias for the Octokit GitHub API client instance
export type Octokit = InstanceType<typeof GitHub>;

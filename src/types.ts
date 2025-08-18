import { GitHub } from '@actions/github/lib/utils';

export type JiraLinkMode = 'body-start' | 'body-end';

export interface InputVariables {
  token: string;
  jiraBaseUrl: string;
  jiraLinkMode: JiraLinkMode;
}

export interface JiraPatterns {
  JIRA_TICKET_REGEX: RegExp;
  JIRA_LINK_LINE_REGEX: RegExp;
}

export type Octokit = InstanceType<typeof GitHub>;

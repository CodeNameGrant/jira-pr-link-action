import * as core from '@actions/core';
import { InputVariables, JiraLinkMode, JiraPatterns, Octokit } from './types';
import { Context } from '@actions/github/lib/context';

// Default JIRA ticket pattern
const DEFAULT_TICKET_PATTERN = '([A-Z][A-Z0-9_]*-\\d+)';

// Allowed JIRA link modes
const JIRA_LINK_MODES: JiraLinkMode[] = ['body-start', 'body-end'];

export function validateInputVariables(): InputVariables {
  // Read required inputs
  const token = core.getInput('token', { required: true });
  const jiraBaseUrl = core.getInput('jira-base-url', { required: true }).replace(/\/$/, '');

  if (!token || token === '') {
    throw new Error('Input "token" is required.');
  }

  if (!jiraBaseUrl || jiraBaseUrl === '') {
    throw new Error('Input "jira-base-url" is required.');
  }

  try {
    new URL(jiraBaseUrl);
  } catch (err) {
    throw new Error(`Input "jira-base-url" must be a valid URL. Received: ${jiraBaseUrl}`);
  }

  // Read optional inputs
  const jiraLinkMode = (core.getInput('jira-link-mode') || 'body-start') as JiraLinkMode;
  if (!JIRA_LINK_MODES.includes(jiraLinkMode)) {
    throw new Error(
      `Input 'jira-link-mode' is invalid. Must be one of: ${JIRA_LINK_MODES.join(', ')}`
    );
  }

  return { token, jiraBaseUrl, jiraLinkMode };
}

export function getJiraPatterns(): JiraPatterns {
  let ticketPattern = DEFAULT_TICKET_PATTERN;

  const issuePatternInput = core.getInput('issue-pattern');
  if (issuePatternInput) {
    // If the user regex already has '(', assume they added a capturing group
    ticketPattern = issuePatternInput.includes('(') ? issuePatternInput : `(${issuePatternInput})`;
  }

  const JIRA_TICKET_REGEX = new RegExp(ticketPattern);

  // Build the link regex dynamically from ticket pattern
  const JIRA_LINK_LINE_REGEX = new RegExp(
    `^🔗 Linked to JIRA ticket: \\[${ticketPattern}\\]\\(.+?\\)\\s*$`,
    'm'
  );

  return {
    JIRA_TICKET_REGEX,
    JIRA_LINK_LINE_REGEX
  };
}

export function extractJiraTicket(text: string): string | null {
  const { JIRA_TICKET_REGEX } = getJiraPatterns();
  const match = text.match(JIRA_TICKET_REGEX);
  return match ? match[1] : null;
}

export function generateJiraLink(baseUrl: string, ticket: string): string {
  return `🔗 Linked to JIRA ticket: [${ticket}](${baseUrl}/browse/${ticket})`;
}

export function removeExistingJiraLink(prBody: string): string {
  const { JIRA_LINK_LINE_REGEX } = getJiraPatterns();
  return prBody.replace(JIRA_LINK_LINE_REGEX, '').trim();
}

export function updatePRBodyWithJiraLink(
  prBody: string,
  jiraLink: string,
  jiraLinkMode: JiraLinkMode
): string {
  const { JIRA_LINK_LINE_REGEX } = getJiraPatterns();

  if (JIRA_LINK_LINE_REGEX.test(prBody)) {
    return prBody.replace(JIRA_LINK_LINE_REGEX, jiraLink);
  }

  if (jiraLinkMode === 'body-start') {
    return `${jiraLink}\n\n${prBody}`.trim();
  }

  if (jiraLinkMode === 'body-end') {
    return `${prBody}\n\n${jiraLink}`.trim();
  }

  throw new Error(`Unsupported JIRA_LINK_MODE: ${jiraLinkMode}`);
}

export async function handleNoJiraTicket(octokit: Octokit, context: Context, prBody: string) {
  core.info('No JIRA ticket found in PR title.');
  const cleanedBody = removeExistingJiraLink(prBody);

  if (cleanedBody !== prBody) {
    const { owner, repo } = context.repo;
    const prNumber = context.payload.pull_request?.number as number;

    await octokit.rest.pulls.update({ owner, repo, pull_number: prNumber, body: cleanedBody });
    core.info('Removed existing JIRA link from PR description.');
  }

  return;
}

export async function handleJiraTicketFound(
  octokit: Octokit,
  context: Context,
  prBody: string,
  jiraLink: string,
  jiraLinkMode: JiraLinkMode
) {
  const newBody = updatePRBodyWithJiraLink(prBody, jiraLink, jiraLinkMode);

  if (newBody !== prBody) {
    const { owner, repo } = context.repo;
    const prNumber = context.payload.pull_request?.number as number;

    await octokit.rest.pulls.update({ owner, repo, pull_number: prNumber, body: newBody });

    core.info(
      prBody.includes(jiraLink)
        ? 'Updated existing JIRA link in PR description.'
        : 'Added new JIRA link to PR description.'
    );
  } else {
    core.info('JIRA link already up to date. No changes made.');
  }
}

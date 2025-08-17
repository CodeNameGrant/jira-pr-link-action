import * as core from '@actions/core';

// Configuration constants
const CONFIG = {
  // Matches: feat(PROJ-123): ... or PROJ-123: ...
  JIRA_TICKET_REGEX: /\(?([A-Z][A-Z0-9_]*-\d+)\)?/,
  // Matches existing link in PR body (more forgiving about spaces/URL)
  JIRA_LINK_LINE_REGEX: /^🔗 Linked to JIRA ticket: \[[A-Z][A-Z0-9_]*-\d+\]\(.+?\)\s*$/m
};

const JIRA_LINK_MODES = ['body-start', 'body-end'];

export function validateEnvironmentVariables() {
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

  // Optional input with validation
  const jiraLinkMode = core.getInput('jira-link-mode') || 'body-start';
  if (!JIRA_LINK_MODES.includes(jiraLinkMode)) {
    throw new Error(
      `Input 'jira-link-mode' is invalid. Must be one of: ${JIRA_LINK_MODES.join(', ')}`
    );
  }

  return { token, jiraBaseUrl, jiraLinkMode };
}

export function extractJiraTicket(prTitle) {
  const match = prTitle.match(CONFIG.JIRA_TICKET_REGEX);
  return match ? match[1] : null;
}

export function generateJiraLink(baseUrl, ticket) {
  return `🔗 Linked to JIRA ticket: [${ticket}](${baseUrl}/browse/${ticket})`;
}

export function removeExistingJiraLink(prBody) {
  return prBody.replace(CONFIG.JIRA_LINK_LINE_REGEX, '').trim();
}

export function updatePRBodyWithJiraLink(prBody, jiraLink, jiraLinkMode) {
  if (CONFIG.JIRA_LINK_LINE_REGEX.test(prBody)) {
    return prBody.replace(CONFIG.JIRA_LINK_LINE_REGEX, jiraLink);
  }

  if (jiraLinkMode === 'body-start') {
    return `${jiraLink}\n\n${prBody}`.trim();
  }

  if (jiraLinkMode === 'body-end') {
    return `${prBody}\n\n${jiraLink}`.trim();
  }

  throw new Error(`Unsupported JIRA_LINK_MODE: ${jiraLinkMode}`);
}

export async function handleNoJiraTicket(octokit, context, prBody) {
  core.info('No JIRA ticket found in PR title.');
  const cleanedBody = removeExistingJiraLink(prBody);

  if (cleanedBody !== prBody) {
    const { owner, repo } = context.repo;
    const prNumber = context.payload.pull_request?.number;

    await octokit.rest.pulls.update({ owner, repo, pull_number: prNumber, body: cleanedBody });
    core.info('Removed existing JIRA link from PR description.');
  }

  return;
}

export async function handleJiraTicketFound(octokit, context, prBody, jiraLink, jiraLinkMode) {
  const newBody = updatePRBodyWithJiraLink(prBody, jiraLink, jiraLinkMode);

  if (newBody !== prBody) {
    const { owner, repo } = context.repo;
    const prNumber = context.payload.pull_request?.number;

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

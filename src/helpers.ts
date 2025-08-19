import * as core from '@actions/core';
import { InputVariables, JiraLinkMode, JiraPatterns, Octokit } from './types';
import { Context } from '@actions/github/lib/context';

// Default JIRA ticket pattern
const DEFAULT_TICKET_PATTERN = '([A-Z][A-Z0-9_]*-\\d+)';

// Allowed JIRA link modes
const JIRA_LINK_MODES: JiraLinkMode[] = ['body-start', 'body-end'];

/**
 * Validates and retrieves required and optional input variables for the action.
 *
 * - Ensures the 'token' and 'jira-base-url' inputs are provided and non-empty.
 * - Strips any trailing slash from 'jira-base-url' and verifies it is a valid URL.
 * - Reads the optional 'jira-link-mode' input, defaulting to 'body-start' if not provided,
 *   and checks that it is one of the allowed modes.
 *
 * @throws {Error} If any required input is missing, empty, or invalid.
 * @returns {InputVariables} An object containing the validated input variables.
 */
export function validateInputVariables(): InputVariables {
  // Read required inputs
  const token = core.getInput('github-token', { required: true });
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

/**
 * Generates regular expression patterns for matching JIRA ticket references and JIRA ticket link lines.
 *
 * The ticket pattern is determined by the 'issue-pattern' input. If the input contains a capturing group,
 * it is used directly; otherwise, it is wrapped in parentheses to form a capturing group.
 *
 * Returns an object containing:
 * - `JIRA_TICKET_REGEX`: RegExp for matching JIRA ticket references.
 * - `JIRA_LINK_LINE_REGEX`: RegExp for matching lines that link to JIRA tickets in markdown format.
 *
 * @returns {JiraPatterns} An object with regular expressions for JIRA ticket and link line matching.
 */
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

/**
 * Extracts a Jira ticket identifier from the provided text using a predefined regex pattern.
 *
 * @param text - The input string from which to extract the Jira ticket.
 * @returns The extracted Jira ticket identifier if found; otherwise, `null`.
 */
export function extractJiraTicket(text: string): string | null {
  const { JIRA_TICKET_REGEX } = getJiraPatterns();
  const match = text.match(JIRA_TICKET_REGEX);
  return match ? match[1] : null;
}

/**
 * Generates a markdown-formatted link to a JIRA ticket.
 *
 * @param jiraBaseUrl - The base URL of the JIRA instance (e.g., "https://yourcompany.atlassian.net").
 * @param ticket - The JIRA ticket identifier (e.g., "PROJ-123").
 * @returns A string containing a markdown link to the specified JIRA ticket.
 */
export function generateJiraLink(jiraBaseUrl: string, ticket: string): string {
  return `🔗 Linked to JIRA ticket: [${ticket}](${jiraBaseUrl}/browse/${ticket})`;
}

/**
 * Removes an existing Jira link line from the provided pull request body string.
 *
 * This function uses a regular expression defined in `getJiraPatterns()` to identify
 * and remove the Jira link line from the PR body. The resulting string is trimmed
 * to remove any leading or trailing whitespace.
 *
 * @param prBody - The body of the pull request as a string.
 * @returns The PR body string with the Jira link line removed and trimmed.
 */
export function removeExistingJiraLink(prBody: string): string {
  const { JIRA_LINK_LINE_REGEX } = getJiraPatterns();
  return prBody.replace(JIRA_LINK_LINE_REGEX, '').trim();
}

/**
 * Updates the pull request body with a JIRA link according to the specified mode.
 *
 * If the PR body already contains a JIRA link, it will be replaced.
 * Otherwise, the JIRA link will be inserted at the start or end of the PR body, based on `jiraLinkMode`.
 *
 * @param prBody - The original pull request body text.
 * @param jiraLink - The JIRA link to insert or replace in the PR body.
 * @param jiraLinkMode - Determines where to insert the JIRA link. Supported values are `'body-start'` and `'body-end'`.
 * @returns The updated pull request body with the JIRA link.
 * @throws If an unsupported `jiraLinkMode` is provided.
 */
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

/**
 * Handles the scenario where no JIRA ticket is found in the pull request title.
 * Removes any existing JIRA link from the pull request description if present.
 * Updates the pull request body using the provided Octokit instance.
 *
 * @param octokit - The Octokit instance used to interact with the GitHub API.
 * @param context - The GitHub Actions context containing repository and payload information.
 * @param prBody - The current body of the pull request.
 * @returns A promise that resolves when the operation is complete.
 */
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

/**
 * Handles the addition or update of a JIRA ticket link in a pull request description.
 *
 * This function checks if the provided JIRA link is already present in the PR body.
 * If not, it updates the PR description with the new or updated JIRA link according to the specified mode.
 * It then uses the Octokit client to update the PR on GitHub and logs the action taken.
 * If the JIRA link is already up to date, no changes are made.
 *
 * @param octokit - An authenticated Octokit instance for interacting with the GitHub API.
 * @param context - The GitHub Actions context containing repository and PR information.
 * @param prBody - The current body (description) of the pull request.
 * @param jiraLink - The JIRA ticket link to add or update in the PR description.
 * @param jiraLinkMode - The mode specifying how the JIRA link should be added or updated.
 */
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

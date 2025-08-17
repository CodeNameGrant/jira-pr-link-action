import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  extractJiraTicket,
  generateJiraLink,
  handleJiraTicketFound,
  handleNoJiraTicket,
  validateEnvironmentVariables
} from './helpers';

async function run() {
  try {
    if (github.context.eventName !== 'pull_request') {
      core.setFailed(
        `This action only supports the 'pull_request' event. Received: '${github.context.eventName}'`
      );
      return;
    }

    // Get required inputs
    const { token, jiraBaseUrl, jiraLinkMode } = validateEnvironmentVariables();

    // Initialize Octokit using @actions/github
    const octokit = github.getOctokit(token);

    // Extract repo/owner and PR number from context
    const { owner, repo } = github.context.repo;
    const prNumber = github.context.payload.pull_request?.number;
    if (!prNumber) {
      core.setFailed('This action must be run on a pull_request event.');
      return;
    }

    const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
    const prTitle = pr.title ?? '';
    const prBody = pr.body ?? '';

    const jiraTicket = extractJiraTicket(prTitle);

    if (jiraTicket) {
      const jiraLink = generateJiraLink(jiraBaseUrl, jiraTicket);
      await handleJiraTicketFound(octokit, github.context, prBody, jiraLink, jiraLinkMode);

      core.setOutput('jira-ticket', jiraTicket);
      core.setOutput('jira-link', jiraLink);
    } else {
      await handleNoJiraTicket(octokit, github.context, prBody);
    }
  } catch (error) {
    core.setFailed(`Error managing JIRA link: ${error.message}`);
  }
}

run();

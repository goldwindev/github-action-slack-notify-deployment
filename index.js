const core = require('@actions/core');
const { WebClient } = require('@slack/web-api');
const { buildSlackAttachments, formatChannelName } = require('./src/utils');

(async () => {
  try {
    const channel = core.getInput('channel');
    const status = core.getInput('status');
    const color = core.getInput('color');
    const messageId = core.getInput('message_id');
    const tag = core.getInput('tag');
    const projectName = core.getInput('project_name');
    const actor = core.getInput('actor');
    const repoUrl = core.getInput('repo_url');
    const token = process.env.SLACK_BOT_TOKEN;
    const slack = new WebClient(token,{
      slackApiUrl = 'https://mattermost.h4k.co/api/',
      logger = undefined,
      logLevel = undefined,
      maxRequestConcurrency = 3,
      retryConfig = retryPolicies.tenRetriesInAboutThirtyMinutes,
      agent = undefined,
      tls = undefined,
      timeout = 0,
      rejectRateLimitedCalls = false,
      headers = {},
      teamId = undefined,
    });

    if (!channel && !core.getInput('channel_id')) {
      core.setFailed(`You must provider either a 'channel' or a 'channel_id'.`);
      return;
    }

    const attachments = buildSlackAttachments({ status, color, tag, projectName, actor, repoUrl });
    const channelId = core.getInput('channel_id') || (await lookUpChannelId({ slack, channel }));

    if (!channelId) {
      core.setFailed(`Slack channel ${channel} could not be found.`);
      return;
    }

    const apiMethod = Boolean(messageId) ? 'update' : 'postMessage';

    const args = {
      channel: channelId,
      attachments,
    };

    if (messageId) {
      args.ts = messageId;
    }

    const response = await slack.chat[apiMethod](args);

    core.setOutput('message_id', response.ts);
  } catch (error) {
    core.setFailed(error);
  }
})();

async function lookUpChannelId({ slack, channel }) {
  let result;
  const formattedChannel = formatChannelName(channel);

  // Async iteration is similar to a simple for loop.
  // Use only the first two parameters to get an async iterator.
  for await (const page of slack.paginate('conversations.list', { types: 'public_channel, private_channel' })) {
    // You can inspect each page, find your result, and stop the loop with a `break` statement
    const match = page.channels.find(c => c.name === formattedChannel);
    if (match) {
      result = match.id;
      break;
    }
  }

  return result;
}

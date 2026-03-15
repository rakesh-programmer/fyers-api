const crypto = require('crypto');
const { execFile } = require('child_process');
const path = require('path');

const DEFAULT_BRANCH = process.env.DEPLOY_BRANCH || 'main';
const DEFAULT_REPO_DIR = process.env.DEPLOY_REPO_DIR || path.join(__dirname, '..');
const EXPECTED_REPOSITORY = process.env.GITHUB_REPOSITORY || 'rakesh-programmer/fyers-api';
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const RESTART_COMMAND = process.env.DEPLOY_RESTART_COMMAND;

const runCommand = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    execFile(command, args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        return reject(
          new Error(
            `Command failed: ${command} ${args.join(' ')}\n${stderr || error.message}`
          )
        );
      }

      return resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });

const runShellCommand = (command, cwd) => {
  if (!command) {
    return Promise.resolve(null);
  }

  if (process.platform === 'win32') {
    return runCommand('cmd.exe', ['/c', command], cwd);
  }

  return runCommand('/bin/sh', ['-lc', command], cwd);
};

const verifySignature = (bodyBuffer, signatureHeader) => {
  if (!WEBHOOK_SECRET) {
    return true;
  }

  if (!signatureHeader) {
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(bodyBuffer)
    .digest('hex')}`;

  const actual = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expected);

  if (actual.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actual, expectedBuffer);
};

const deployRepository = async () => {
  const fetchResult = await runCommand('git', ['fetch', 'origin', DEFAULT_BRANCH], DEFAULT_REPO_DIR);
  const pullResult = await runCommand('git', ['pull', 'origin', DEFAULT_BRANCH], DEFAULT_REPO_DIR);
  const restartResult = await runShellCommand(RESTART_COMMAND, DEFAULT_REPO_DIR);

  return {
    fetch: fetchResult.stdout || fetchResult.stderr,
    pull: pullResult.stdout || pullResult.stderr,
    restart: restartResult ? restartResult.stdout || restartResult.stderr : 'Skipped'
  };
};

const deployFromGithubWebhook = async ({ bodyBuffer, headers }) => {
  const event = headers['x-github-event'];
  const signature = headers['x-hub-signature-256'];
  const payload = JSON.parse(bodyBuffer.toString('utf8'));

  if (!verifySignature(bodyBuffer, signature)) {
    return {
      statusCode: 401,
      body: { error: 'Invalid webhook signature' }
    };
  }

  if (event === 'ping') {
    return {
      statusCode: 200,
      body: { message: 'GitHub webhook received' }
    };
  }

  if (event !== 'push') {
    return {
      statusCode: 202,
      body: { message: `Ignored event ${event}` }
    };
  }

  if (payload.repository?.full_name !== EXPECTED_REPOSITORY) {
    return {
      statusCode: 202,
      body: { message: `Ignored repository ${payload.repository?.full_name || 'unknown'}` }
    };
  }

  if (payload.ref !== `refs/heads/${DEFAULT_BRANCH}`) {
    return {
      statusCode: 202,
      body: { message: `Ignored branch ${payload.ref}` }
    };
  }

  const deployResult = await deployRepository();

  return {
    statusCode: 200,
    body: {
      message: 'Deployment completed',
      branch: DEFAULT_BRANCH,
      repository: EXPECTED_REPOSITORY,
      deployResult
    }
  };
};

module.exports = {
  deployFromGithubWebhook
};

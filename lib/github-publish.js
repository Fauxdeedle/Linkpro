const fs = require('fs');
const os = require('os');
const path = require('path');

const REVIEW_BRANCH = 'admin/live-events';
const SOURCE_FILES = [
  'index.html',
  'live-events.html',
  'components/site-nav.html',
  'components/site-analytics.html',
];

function publishConfig(env = process.env) {
  const token = typeof env.ADMIN_GITHUB_TOKEN === 'string' ? env.ADMIN_GITHUB_TOKEN.trim() : '';
  const repo = String(env.ADMIN_GITHUB_REPO || env.GITHUB_REPOSITORY || '').trim();
  const baseBranch = String(env.ADMIN_GITHUB_BASE || 'main').trim() || 'main';
  let branch = String(env.ADMIN_GITHUB_BRANCH || REVIEW_BRANCH).trim() || REVIEW_BRANCH;
  if (branch === baseBranch) branch = REVIEW_BRANCH;
  if (!token || !repo || token.startsWith('...')) return null;
  return { token, repo, branch, baseBranch };
}

async function githubRequest(fetchImpl, token, url, options = {}) {
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'linkpro-admin',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 300) };
    }
  }
  if (!response.ok) {
    const details = Array.isArray(data?.errors)
      ? data.errors
          .map((item) => item.message || item.code)
          .filter(Boolean)
          .join('; ')
      : '';
    const error = new Error(
      [data?.message || response.statusText || 'GitHub request failed', details]
        .filter(Boolean)
        .join(': ')
    );
    error.status = response.status;
    throw error;
  }
  return data;
}

function refUrl(api, branch, method) {
  const name = encodeURIComponent(branch);
  // GitHub reads a branch at /git/ref and updates it at /git/refs.
  const collection = method === 'PATCH' ? 'refs' : 'ref';
  return `${api}/git/${collection}/heads/${name}`;
}

async function readBranch(fetchImpl, token, api, branch) {
  try {
    const ref = await githubRequest(fetchImpl, token, refUrl(api, branch, 'GET'));
    const sha = ref.object?.sha || ref.object?.oid;
    if (!sha) throw new Error(`The ${branch} branch has no commit.`);
    return sha;
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

function fileText(data) {
  if (!data || typeof data.content !== 'string') {
    throw new Error('GitHub file content was missing');
  }
  if (data.encoding === 'utf-8') return data.content;
  return Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf8');
}

function safeRepoPath(filePath) {
  const parts = String(filePath).split('/').filter(Boolean);
  if (!parts.length || parts.some((part) => part === '..')) {
    throw new Error('GitHub returned an unsafe file path.');
  }
  return parts.join('/');
}

async function writeRepoFile(fetchImpl, token, api, ref, dest, filePath) {
  const data = await githubRequest(
    fetchImpl,
    token,
    `${api}/contents/${filePath}?ref=${encodeURIComponent(ref)}`
  );
  const relative = safeRepoPath(filePath);
  const target = path.join(dest, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fileText(data));
}

async function checkoutPublishSource({ env = process.env, fetchImpl = fetch } = {}) {
  const config = publishConfig(env);
  if (!config) return null;
  const { token, repo, branch, baseBranch } = config;
  const api = `https://api.github.com/repos/${repo}`;
  const baseSha = await readBranch(fetchImpl, token, api, baseBranch);
  if (!baseSha) throw new Error(`The ${baseBranch} branch was not found.`);
  const reviewSha = await readBranch(fetchImpl, token, api, branch);
  const ref = reviewSha || baseSha;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'linkpro-publish-'));

  const listing = await githubRequest(
    fetchImpl,
    token,
    `${api}/contents/content/events?ref=${encodeURIComponent(ref)}`
  );
  if (!Array.isArray(listing)) throw new Error('The event directory could not be read.');
  for (const entry of listing) {
    if (entry.type !== 'file' || !entry.path) continue;
    await writeRepoFile(fetchImpl, token, api, ref, root, entry.path);
  }
  for (const filePath of SOURCE_FILES) {
    try {
      await writeRepoFile(fetchImpl, token, api, ref, root, filePath);
    } catch (err) {
      if (err.status !== 404) throw err;
    }
  }

  return {
    root,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

function reviewUrl(repo, baseBranch, branch) {
  return `https://github.com/${repo}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(branch)}?expand=1`;
}

async function findOpenPullRequest(fetchImpl, token, api, branch, baseBranch) {
  const query = new URLSearchParams({
    state: 'open',
    base: baseBranch,
    per_page: '100',
  });
  const pulls = await githubRequest(fetchImpl, token, `${api}/pulls?${query}`);
  if (!Array.isArray(pulls)) return null;
  return (
    pulls.find((pull) => pull.head?.ref === branch && pull.base?.ref === baseBranch) || null
  );
}

async function ensurePullRequest(fetchImpl, token, api, repo, branch, baseBranch) {
  const existing = await findOpenPullRequest(fetchImpl, token, api, branch, baseBranch);
  if (existing) return existing;
  try {
    return await githubRequest(fetchImpl, token, `${api}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'Review live event updates',
        head: branch,
        base: baseBranch,
        body: 'Saved from the admin hub. Merge this pull request when the preview looks right. Further saves are added to this branch until it is merged.',
      }),
    });
  } catch (err) {
    const again = await findOpenPullRequest(fetchImpl, token, api, branch, baseBranch).catch(
      () => null
    );
    if (again) return again;
    throw err;
  }
}

async function publishSiteFiles({
  files,
  message,
  env = process.env,
  fetchImpl = fetch,
}) {
  const config = publishConfig(env);
  if (!config) {
    throw new Error('Admin publishing is not configured');
  }

  const { token, repo, branch, baseBranch } = config;
  const api = `https://api.github.com/repos/${repo}`;
  const baseSha = await readBranch(fetchImpl, token, api, baseBranch);
  if (!baseSha) throw new Error(`The ${baseBranch} branch was not found.`);
  const reviewSha = await readBranch(fetchImpl, token, api, branch);
  const parentSha = reviewSha || baseSha;
  const parent = await githubRequest(fetchImpl, token, `${api}/git/commits/${parentSha}`);
  const treeEntries = [];

  for (const [filePath, content] of Object.entries(files.writes || {})) {
    const blob = await githubRequest(fetchImpl, token, `${api}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content, encoding: 'utf-8' }),
    });
    treeEntries.push({
      path: filePath,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    });
  }

  for (const filePath of files.deletes || []) {
    treeEntries.push({
      path: filePath,
      mode: '100644',
      type: 'blob',
      sha: null,
    });
  }

  const tree = await githubRequest(fetchImpl, token, `${api}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: parent.tree.sha, tree: treeEntries }),
  });
  const commit = await githubRequest(fetchImpl, token, `${api}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [parentSha],
    }),
  });

  if (reviewSha) {
    await githubRequest(fetchImpl, token, refUrl(api, branch, 'PATCH'), {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha }),
    });
  } else {
    await githubRequest(fetchImpl, token, `${api}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
    });
  }

  let pullRequestUrl = '';
  try {
    const pull = await ensurePullRequest(fetchImpl, token, api, repo, branch, baseBranch);
    pullRequestUrl = pull.html_url || '';
  } catch (err) {
    console.error('Admin pull request was not opened:', err.message);
  }
  return {
    commitSha: commit.sha,
    branch,
    baseBranch,
    pullRequestUrl: pullRequestUrl || reviewUrl(repo, baseBranch, branch),
  };
}

module.exports = {
  REVIEW_BRANCH,
  checkoutPublishSource,
  publishConfig,
  publishSiteFiles,
};

function publishConfig(env = process.env) {
  const token = typeof env.ADMIN_GITHUB_TOKEN === 'string' ? env.ADMIN_GITHUB_TOKEN.trim() : '';
  const repo = String(env.ADMIN_GITHUB_REPO || env.GITHUB_REPOSITORY || '').trim();
  const branch = String(env.ADMIN_GITHUB_BRANCH || 'main').trim() || 'main';
  if (!token || !repo || token.startsWith('...')) return null;
  return { token, repo, branch };
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
    const message = data?.message || response.statusText || 'GitHub request failed';
    throw new Error(message);
  }
  return data;
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

  const { token, repo, branch } = config;
  const base = `https://api.github.com/repos/${repo}`;
  const branchPath = branch.split('/').map(encodeURIComponent).join('/');
  const ref = await githubRequest(
    fetchImpl,
    token,
    `${base}/git/ref/heads/${branchPath}`
  );
  const parentSha = ref.object.oid || ref.object.sha;
  const parent = await githubRequest(fetchImpl, token, `${base}/git/commits/${parentSha}`);
  const treeEntries = [];

  for (const [filePath, content] of Object.entries(files.writes || {})) {
    const blob = await githubRequest(fetchImpl, token, `${base}/git/blobs`, {
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

  const tree = await githubRequest(fetchImpl, token, `${base}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: parent.tree.sha, tree: treeEntries }),
  });
  const commit = await githubRequest(fetchImpl, token, `${base}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [parentSha],
    }),
  });
  await githubRequest(fetchImpl, token, `${base}/git/refs/heads/${branchPath}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });

  return { commitSha: commit.sha, branch };
}

module.exports = { publishConfig, publishSiteFiles };

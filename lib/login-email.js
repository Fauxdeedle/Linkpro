function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loginMessage(url) {
  return {
    text: `Use this link to open your LINK Pro courses. It expires in 30 minutes and works once.\n\n${url}\n`,
    html: `<p>Use this link to open your LINK Pro courses. It expires in 30 minutes and works once.</p><p><a href="${escapeHtml(url)}">Open your courses</a></p>`,
  };
}

async function resendErrorMessage(response) {
  if (!response || typeof response.text !== 'function') {
    return '';
  }

  let body = '';
  try {
    body = await response.text();
  } catch {
    return '';
  }
  if (!body) {
    return '';
  }

  try {
    const parsed = JSON.parse(body);
    const message = parsed?.message || parsed?.error?.message || parsed?.error;
    return typeof message === 'string' ? message : body;
  } catch {
    return body;
  }
}

async function sendLoginEmail({ to, url, fetchImpl = fetch }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ACCESS_EMAIL_FROM?.trim();
  if (!apiKey || !from || apiKey.startsWith('...') || from.startsWith('...')) {
    console.info(`Login link (email delivery is not configured): ${url}`);
    if (process.env.VERCEL) {
      console.error(
        'Course link was not emailed. Set RESEND_API_KEY and ACCESS_EMAIL_FROM on this deployment.'
      );
    }
    return { sent: false, reason: 'not-configured' };
  }

  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: 'Your LINK Pro course link',
      ...loginMessage(url),
    }),
  });

  if (!response.ok) {
    const message = (await resendErrorMessage(response)).slice(0, 500);
    console.error('Resend rejected the course link', {
      status: response.status,
      message,
    });
    return { sent: false, reason: 'rejected', status: response.status, message };
  }

  return { sent: true };
}

module.exports = { sendLoginEmail };

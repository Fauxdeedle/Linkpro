async function sendLoginEmail({ to, url, fetchImpl = fetch }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ACCESS_EMAIL_FROM;
  if (!apiKey || !from || apiKey.startsWith('...') || from.startsWith('...')) {
    console.info(`Login link (email delivery is not configured): ${url}`);
    return { sent: false };
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
      text: `Use this link to open your LINK Pro courses. It expires in 30 minutes and works once.\n\n${url}\n`,
    }),
  });

  if (!response.ok) {
    console.error('Login email failed', { status: response.status });
    return { sent: false };
  }

  return { sent: true };
}

module.exports = { sendLoginEmail };

// Vercel serverless function: home-improvement pilot application
// 1. POSTs the application to a GHL Inbound Webhook (its own workflow, NOT the solar scan one)
// 2. Emails the full application to the FlowBuild inbox via Resend, so nothing is lost
//    even if the GHL webhook is missing or down.
//
// Env vars in Vercel:
//   GHL_APPLY_WEBHOOK_URL  GHL Workflow Inbound Webhook for applications (optional but recommended)
//   RESEND_API_KEY         already set for /api/submit
//   APPLY_NOTIFY_EMAIL     optional, defaults to info@flowbuildai.ie

const GHL_APPLY_WEBHOOK_URL = process.env.GHL_APPLY_WEBHOOK_URL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY = process.env.APPLY_NOTIFY_EMAIL || 'info@flowbuildai.ie';

const LABELS = {
  challenge: 'Biggest challenge',
  trade: 'Trade',
  job_value: 'Average job value',
  sales_team: 'Who sits the sales appointments',
  close_rate: 'Close rate on sales appointments',
  capacity: 'Capacity for more work (next 3 months)',
  ad_budget: 'Monthly ad budget',
  areas: 'Areas covered',
};

// One natural line linking their biggest challenge to the part of the system that fixes it.
// Sent to GHL as challenge_phrase so the first follow-up message needs no if/else branches.
const CHALLENGE_PHRASES = {
  'Not enough enquiries': 'Not enough enquiries is exactly what our Meta campaigns are built to fix.',
  'Enquiries, but poor quality': 'Poor-quality enquiries is exactly what our qualifying calls fix: you only meet people who are ready to buy.',
  'No time to follow up properly': 'Not having time to follow up is exactly why we reply to every lead in seconds and do the calling for you.',
  'Busy one month, quiet the next': 'Feast-or-famine months are exactly what a steady weekly flow of booked appointments fixes.',
};
const DEFAULT_PHRASE = 'From your answers, this looks like a good fit for the pilot.';

const clean = (v, n = 300) => String(v ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  let p = req.body;
  if (!p || typeof p !== 'object') {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(Buffer.from(c));
      p = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    } catch { p = {}; }
  }

  // Honeypot: bots fill the hidden field. Pretend success, store nothing.
  if (p.company_url) return res.status(200).json({ ok: true });

  const a = {
    name: clean(p.name, 120),
    company: clean(p.company, 160),
    email: clean(p.email, 160),
    phone: clean(p.phone, 40),
    website: clean(p.website, 200),
    challenge: clean(p.challenge),
    challenge_phrase: '',
    trade: clean(p.trade),
    job_value: clean(p.job_value),
    sales_team: clean(p.sales_team),
    close_rate: clean(p.close_rate),
    capacity: clean(p.capacity),
    ad_budget: clean(p.ad_budget),
    areas: clean(p.areas, 300),
    fit: clean(p.fit, 20),
    fit_score: Number(p.fit_score) || 0,
    consent: !!p.consent,
  };

  a.challenge_phrase = CHALLENGE_PHRASES[a.challenge] || DEFAULT_PHRASE;

  if (!a.name || !a.email || !a.phone || !a.consent) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }

  const tasks = [];
  if (GHL_APPLY_WEBHOOK_URL) tasks.push(toGHL(a));
  if (RESEND_API_KEY) tasks.push(toEmail(a));
  if (!tasks.length) {
    console.error('[apply] no delivery configured; application:', JSON.stringify(a));
    return res.status(500).json({ ok: false, error: 'Not configured' });
  }

  const results = await Promise.allSettled(tasks);
  results.forEach(r => { if (r.status === 'rejected') console.error('[apply] delivery failed:', r.reason?.message); });
  const delivered = results.some(r => r.status === 'fulfilled');
  if (!delivered) console.error('[apply] ALL deliveries failed; application:', JSON.stringify(a));
  return res.status(delivered ? 200 : 502).json({ ok: delivered });
}

async function toGHL(a) {
  const [firstName, ...rest] = a.name.split(' ');
  const r = await fetch(GHL_APPLY_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName, lastName: rest.join(' '),
      email: a.email, phone: a.phone, companyName: a.company, website: a.website,
      challenge: a.challenge, challenge_phrase: a.challenge_phrase, trade: a.trade, job_value: a.job_value, sales_team: a.sales_team, close_rate: a.close_rate,
      capacity: a.capacity, ad_budget: a.ad_budget, areas: a.areas,
      fit: a.fit, fit_score: a.fit_score,
      source: 'home-improvement-landing',
      tags: `hi-pilot-application,fit-${a.fit}`,
    }),
  });
  if (!r.ok) throw new Error(`GHL ${r.status}: ${await r.text()}`);
}

async function toEmail(a) {
  const rows = Object.keys(LABELS).map(k =>
    `<tr><td style="padding:8px 12px;color:#6b635c;border-bottom:1px solid #eee">${LABELS[k]}</td><td style="padding:8px 12px;border-bottom:1px solid #eee"><b>${esc(a[k] || '-')}</b></td></tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px">
    <h2 style="margin:0 0 4px">New pilot application: ${esc(a.company || a.name)}</h2>
    <p style="margin:0 0 16px;color:#6b635c">Fit: <b style="color:${a.fit === 'strong' ? '#1f9d6b' : '#c4501b'}">${esc(a.fit)}</b> (score ${a.fit_score})</p>
    <p>${esc(a.name)}<br>${esc(a.email)}<br>${esc(a.phone)}${a.website ? '<br>' + esc(a.website) : ''}</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">${rows}</table>
    <p style="color:#6b635c;font-size:12px;margin-top:16px">Consent to be contacted: yes. Source: home-improvement landing page.</p></div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'FlowBuild AI <scan@flowbuildai.ie>',
      to: [NOTIFY],
      reply_to: a.email,
      subject: `Pilot application (${a.fit}): ${a.company || a.name}`,
      html,
    }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

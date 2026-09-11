# FlowBuild Landing Page — handoff to Paddy

This folder is the finished "FlowBuild Premium Websites" landing page — the
one selling website builds (separate from flowbuildai.ie's AI/automation
service). Goal: get it reachable at **flowbuildai.ie/websites**, and add a
"Websites" button to flowbuildai.ie's nav pointing at it.

## ⚠️ One thing to check before anything else

This code is currently deployed at `flowbuildpremiumwebsites.vercel.app`,
**but that live URL has not been updated with the latest version yet** —
Liam's been holding the deploy. If you go with Option A below (the
recommended one), ping Liam to run `vercel --prod` from the project first,
or the `/websites` page will show an old version. Option B (redeploying this
folder fresh) sidesteps that entirely, since you'd be deploying exactly
what's in this folder.

## What this actually is

Plain static HTML/CSS/JS — no build step, no framework. One exception: a
single serverless function (`api/chat.js`) that powers a live AI chat demo
widget on the page. It calls Anthropic's Claude API server-side (the API key
never touches the browser).

## Option A (recommended): proxy a subpath to the existing deployment

Since both flowbuildai.ie and this site are on Vercel, the simplest approach
is a **rewrite** — flowbuildai.ie/websites/* transparently serves this site,
no code merging, no second copy to maintain. Add this to flowbuildai.ie's
`vercel.json` (create the file if it doesn't exist):

```json
{
  "rewrites": [
    { "source": "/websites", "destination": "/websites/" },
    { "source": "/websites/:path*", "destination": "https://flowbuildpremiumwebsites.vercel.app/:path*" }
  ]
}
```

The first rule forces a trailing slash on `/websites` — **this matters**,
because the page's own internal links (images, the chat widget's API call)
are relative, and they only resolve correctly if the browser sees `/websites/`
as a folder, not `/websites` as a bare file. Without that first rule, some
assets or the chat widget could silently fail.

That's it — no other changes needed on your side for the site itself to work.

## Option B: deploy this folder as its own Vercel project

If you'd rather own the deployment directly instead of proxying to Liam's
existing project:

1. `vercel` (or drag this folder into the Vercel dashboard) → deploy it as a
   new project.
2. In that new project's Environment Variables, add `ANTHROPIC_API_KEY`
   (ask Liam for the key, or generate your own at console.anthropic.com) —
   without it, the chat widget just shows a placeholder message instead of
   real replies, everything else on the page still works fine.
3. Use the same rewrite rules as Option A, but pointing `destination` at
   *your* new deployment's URL instead of `flowbuildpremiumwebsites.vercel.app`.

## Adding the nav button

Wherever flowbuildai.ie's nav links live, add one more:

```html
<a href="/websites/">Websites</a>
```

## Local testing

`node serve.mjs` serves it on `http://localhost:3100` (needs Node.js). Add
`ANTHROPIC_API_KEY=sk-ant-...` to a new `.env.local` file in this folder
first if you want to test the real chatbot locally — it works fine without
one too, just shows a placeholder reply.

---

**Prompt for your Claude Code session** — paste this into a Claude Code
session inside the flowbuildai.ie project:

> We want to add a "Websites" button to our site's nav bar that takes
> visitors to a separate landing page (a website-builds product, distinct
> from our AI/automation service) at flowbuildai.ie/websites. That landing
> page already exists and is deployed at
> https://flowbuildpremiumwebsites.vercel.app — I have a README from the
> other developer explaining two integration options: (A) add a Vercel
> rewrite so /websites/* transparently proxies to that existing deployment
> (recommended, no code merging needed), or (B) deploy the provided folder
> as its own project and proxy to that instead. Please read
> README-FOR-PADDY.md in the folder I'm about to share for the exact
> rewrite rules and the trailing-slash gotcha on /websites, implement
> Option A unless I tell you otherwise, and add the nav link.

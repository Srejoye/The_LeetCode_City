import fs from 'fs';

const repo = "Ixotic27/The-Leetcode-City";
const token = fs.readFileSync(".env.local", "utf-8")
    .split("\n")
    .find(line => line.startsWith("GITHUB_TOKEN="))
    ?.split("=")[1]?.trim();

if (!token) {
    console.error("No GITHUB_TOKEN found in .env.local");
    process.exit(1);
}

const headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `token ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "Node-Script"
};

async function createIssue(title, body, labels) {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, body, labels })
    });
    if (res.status === 201) {
        const issue = await res.json();
        console.log(`Created issue: ${title} (#${issue.number})`);
    } else {
        console.error(`Failed to create issue ${title}:`, await res.text());
    }
}

async function run() {
    const issues = [
        {
            title: "Clean up remaining mentions of previous owner",
            body: "There are still some mentions of the original repository owner (`Samuel Rizzon` / `samuelrizzondev`) left over in the project. \n\nPlaces to look:\n- `user_ideas.txt`\n- `supabase/migrations/0091_sky_ads.sql`\n- `src/app/api/sky-ads/analytics/route.ts`\n- `src/app/advertise/track/[token]/page.tsx`\n\nThese need to be replaced with the current maintainer details or removed. This is a great, easy issue for getting started!",
            labels: ["good first issue", "beginner"]
        },
        {
            title: "Rename leftover 'Git City' text to 'LeetCode City'",
            body: "Since this project is 'LeetCode City', we need to remove the old 'Git City' mentions. Several SQL migrations inside `supabase/migrations/` and scripts like `scripts/analytics-report.mjs`, `scripts/seed.ts` still use 'Git City'. \n\nFor example, achievement descriptions in `010_raise_achievement_thresholds.sql` still say 'Refer 3 developers to Git City'. We need a sweep to fix these strings.",
            labels: ["good first issue", "beginner"]
        },
        {
            title: "[Feature] Implement Sky Ads Management Dashboard",
            body: "We currently have some API endpoints for `sky-ads`, but we need a complete user interface under `/advertise` for users to submit, manage, and track their sky banner ads. \n\nRequirements:\n- A form to submit ad text, colors, and links.\n- Integration with our payment webhooks.\n- A dashboard page showing clicks and impressions analytics for the active user.",
            labels: ["good first issue", "intermediate"]
        }
    ];

    for (const issue of issues) {
        await createIssue(issue.title, issue.body, issue.labels);
    }
}

run().catch(console.error);

// Owner: Member 1. Sets a new password for one LIFELINE account, typed with hidden input.
// Usage, from the project folder:
//   node --env-file=.env apps/api/src/scripts/reset-password.mjs you@example.com
// Needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env. Nothing is printed except the result.

import readline from "node:readline";

const email = process.argv[2]?.trim().toLowerCase();
const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email) fail("Give the account's email: node --env-file=.env apps/api/src/scripts/reset-password.mjs you@example.com");
if (!url || !key) fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => { if (text.includes(question)) process.stdout.write(text); };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const list = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers });
if (!list.ok) fail(`Could not read accounts (HTTP ${list.status})`);
const { users } = await list.json();
const user = users.find((entry) => (entry.email ?? "").toLowerCase() === email);
if (!user) fail(`No account found for ${email}. Check the spelling.`);

const password = await askHidden("New password (at least 8 characters): ");
if (password.length < 8) fail("Too short. Nothing was changed.");
const again = await askHidden("Type it again: ");
if (again !== password) fail("The two passwords don't match. Nothing was changed.");

const update = await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: "PUT", headers, body: JSON.stringify({ password }) });
if (!update.ok) fail(`Supabase refused the change (HTTP ${update.status}). Nothing was changed.`);
console.log(`Password updated for ${email}. Sign in with it on the live site.`);

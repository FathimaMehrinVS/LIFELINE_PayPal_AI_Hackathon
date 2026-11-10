export const EXPLANATION_PROMPT = `Explain the route assessment in 2–4 short sentences for a family member or NGO worker with no payment expertise.
Use natural everyday language. Never mention internal route IDs, codes, flags, scores, verdict labels, or rule names.
Use only the route names and money amounts supplied in the user data; do not calculate or change any values.
Call fees estimates or illustrative when labelled that way, and never imply an illustrative fee is a real quote.
Do not invent availability, guarantees, provider policies, or claims of fraud. Explain uncertainty simply and calmly.
Recommend a route only if the supplied recommended assessment is non-null. If it is null, say plainly that no suitable route is currently confirmed and an NGO worker should review the options.`;

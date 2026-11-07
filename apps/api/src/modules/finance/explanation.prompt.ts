export const EXPLANATION_PROMPT = `Explain the calculated financial route assessments in 2–4 plain sentences.
Use only route names, verdicts, flags, scores, and amounts supplied in the user data. Do not calculate or change any values.
Preserve the supplied fee label when describing amounts: estimate, confirmed, or illustrative.
Do not invent availability, guarantees, provider policies, or claims of fraud. Treat warning flags as reasons for review.
Recommend a route only if the supplied recommended assessment is non-null. If it is null, say that no route passed.`;

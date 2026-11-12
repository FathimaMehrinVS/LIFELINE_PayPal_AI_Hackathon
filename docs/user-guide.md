# LIFELINE: A Beginner’s Guide

This guide is for someone opening LIFELINE for the first time. It explains how to sign in, what each role can do, and how a request moves from a report to a recorded delivery.

## 1. Start here

Open the LIFELINE website in a browser: [lifeline-pay-pal-ai-hackathon-wwr2.vercel.app](https://lifeline-pay-pal-ai-hackathon-wwr2.vercel.app).

The website may open quickly while the API takes a little longer to wake up. The API is hosted on a free service that can go idle, so give the first page or request up to a minute. If it still does not load, refresh once and check your internet connection.

LIFELINE is a coordination tool. It helps an NGO turn a report into an assistance plan, lets a donor fund an approved plan, and records delivery steps. It does not decide who deserves help.

## 2. Make an account or sign in

1. Choose **Sign In** or **Create account** on the home page.
2. To make an account, enter your email and choose a password. If the site asks you to confirm your email, follow the message it sends you, then return to the site and sign in.
3. To sign in, enter the same email and password you used when you registered.
4. Use **Sign out** when you are finished, especially on a shared computer.

Every new account starts with **Donor** access. If you need NGO staff, partner, or Admin access, an existing LIFELINE operator must assign it. You cannot give yourself a different role.

### Which role should I use?

| Role | Use this if you… | Main pages you can use |
|---|---|---|
| **Donor** | Want to browse approved plans, contribute, and follow recorded progress. | Approved Plans, My Contributions, Profile |
| **NGO staff** | Review requests, prepare and approve plans, manage suppliers, and coordinate deliveries. | Overview, Assistance Cases, Financial Assessments, Product Baskets, Suppliers, Payments, Delivery Tracking, Audit Logs, Team & Access |
| **Partner** | Have been assigned to prepare or hand over goods for a delivery. | Delivery Tracking |
| **LIFELINE Admin** | Manage account roles. | Manage Accounts, Profile |

An NGO staff member gives NGO or Partner access from **Team & Access**. An Admin can assign any role, including Admin, from **Manage Accounts**. The person must create an account and sign in at least once before the account can be assigned. After a role change, ask the person to sign out and sign back in.

If no one can open **Manage Accounts** yet, contact the person who operates the LIFELINE deployment to set up the first Admin account.

## 3. Report a need

Reports currently require a signed-in account. A family member does not need a bank account or PayPal account; an NGO worker or another signed-in reporter can enter the report with them.

1. Choose **Request Assistance** on the home page, or **New case** inside the app.
2. Choose who is making the report: **I need assistance**, **I am reporting for someone**, or **I am an NGO worker**.
3. Describe what happened in your own words. You can type, speak, use a suggested phrase, or choose **Prefer to tap answers instead?** A few clear words are enough.
4. Answer any questions shown, such as the area, number of people, urgency, or (for NGO staff) an optional assistance amount. If you do not know an answer, leave it blank or choose **I’m not sure** when offered.
5. Read the AI summary carefully. Correct it with **Edit Information** if something is wrong. AI can misunderstand; it does not verify the report.
6. Choose **Looks right**, answer any short follow-up questions, and select **Submit Request**.
7. Save the case reference shown on the confirmation page. The NGO team can use it to find the request.

Submitting a report is free. LIFELINE will not ask the family to pay. If someone is in immediate danger, contact local emergency services first.

### After submitting

The confirmation page shows whether the report is waiting for NGO review or needs more information. An NGO reviewer may contact the reporter to clarify details. A request is not an approved plan, and submitting it does not start a payment.

Use **My Requests** to see requests submitted by your account. It only shows your own requests. NGO staff can see and manage the team’s cases in **Assistance Cases**.

## 4. NGO staff: review requests and prepare a plan

### Start from Overview

The **Overview** page summarizes active and urgent cases, plans waiting for approval, funding, and recent activity. Use the alerts and **View all cases** link to decide what to review first.

### Review a case

1. Open **Assistance Cases** and select a case. The list shows urgency and status.
2. Open the case details and check the summary, reported needs, location, household size, urgency, missing answers, and history.
3. If information is missing, ask the reporter for the missing details and update the case through the follow-up questions where available. Do not fill gaps by guessing.
4. Review the financial assessment and product basket. LIFELINE’s rules compare available routes, fees, access, and the value that can reach the family, then keep the basket within its budget. The AI can explain or rank options, but it does not approve the plan.

Common case statuses are:

- **Ready**: the case has enough information for a reviewer to continue.
- **Needs info**: an answer is needed before a route can be assessed.
- **No route**: no suitable route was found; a human needs to review the options.
- **Awaiting approval**: a plan is ready for an NGO decision.

### Check a supplier and approve the plan

1. Open **Suppliers**. Search by name, location, or category, or register a supplier.
2. Open **Review** for a supplier and complete its verification checks with evidence. A supplier must be approved before it can receive an order. Suppliers shown by product search are not automatically verified.
3. Return to the case and review the proposed amount, items, route, and supplier.
4. Choose **Approve** only when the plan is ready. This is a human decision. Approval creates the next procurement step; it does not mean the donor has funded it or the supplier has been paid.

After funding, NGO staff can open the case in **Assistance Cases** and use **Record simulated supplier payment** when that action is available. Enter the reference from the demo procurement record. This adds an internal record only; it does not send money. The **Payments** page shows recorded donations and supplier-payment records separately.

Supplier names, routes, fees, and some product information are synthetic or illustrative in this demo. Treat the labels in the app as the source of truth about whether an item is real, estimated, or simulated.

## 5. Donors: choose a plan and contribute

1. Open **Approved Plans**. These plans have been reviewed by an NGO. Plans shown to donors are anonymized; they do not show a family’s name, exact location, or original report.
2. Search or filter plans by need, or change the sort order. Select **View Plan** to read its items, funding progress, and recorded timeline.
3. Choose **Support this plan** or **Donate**. Select one of the suggested amounts or enter another amount up to the approved total.
4. Select **Continue with PayPal**. LIFELINE sends you to PayPal’s **Sandbox** checkout.
5. Approve the payment using the Sandbox buyer account supplied for the demo. Follow the checkout instructions and return to LIFELINE.
6. Wait for the confirmation page. It reports success only after LIFELINE checks the capture with PayPal. If the page says the donation was not confirmed, do not assume it succeeded; contact the team operating the demo before trying again.
7. Open **My Contributions** to see the donation and the steps that have been recorded since.

The checkout is a PayPal test environment. Use the Sandbox account supplied for testing; do not enter real payment details. A successful donation capture means the plan received a recorded contribution. It does **not** mean a supplier has been paid or the goods have been delivered.

Plans in this demo are funded in euros (EUR). The site may show an approximate amount in your display currency, but PayPal charges in the plan's currency and shows the exact amount before you approve.

## 6. NGO staff and partners: track delivery

Delivery steps are recorded in **Delivery Tracking**. An NGO assigns an approved, funded plan to a partner who has Partner access.

### NGO: create and share the family’s pickup code

1. In **Delivery Tracking**, find the assigned plan and choose **Create pickup code**.
2. The code appears only once. Copy the prepared message, or send/read the code to the family by another safe method.
3. Give the code to the family only. **Do not share it with the partner.** If the family loses it, the NGO can create a new code; the old one stops working.

### Partner: record preparation and handover

1. Open **Delivery Tracking** and find the delivery assigned to you.
2. Record each step using the button shown: accept the assignment, start preparation, mark the goods ready, then mark them dispatched.
3. At handover, ask the family for the pickup code they received from the NGO. Enter that code, the quantities actually handed over, and any helpful note, then choose **Record handover**.
4. The code locks after five incorrect tries. Ask the NGO to help if the code does not work; do not guess repeatedly.

### NGO: verify the handover

1. Return to **Delivery Tracking** and review the partner’s handover and quantities.
2. If fewer goods were handed over than planned, review the shortfall, tick the approval box, and enter a reason if you accept it.
3. Check the family’s pickup code if it has not already been checked during handover, add a note if useful, and choose **Confirm delivery**.

The completed record means the NGO reviewed and confirmed the handover steps. It is an audit record, not proof of a PayPal payout to the family.

## 7. Other pages you may see

- **Financial Assessments**: compare routes, fees, access, and estimated usable value.
- **Product Baskets**: view essentials selected for cases and budget information.
- **Payments**: see donations received separately from supplier payments recorded by the NGO.
- **Audit Logs**: review recorded actions, such as approvals and access changes.
- **Team & Access**: NGO staff can give Donor, Partner, or NGO access to existing accounts. An Admin role is managed by a LIFELINE Admin.
- **Manage Accounts**: Admins can change any account’s role. Admins cannot use this page to change their own role.
- **Profile**: see your account role and choose the currency used to display amounts. The actual plan and payment currency does not change.

## 8. What the labels mean

| Label or status | Plain meaning |
|---|---|
| **AI-generated** | A computer prepared this summary or suggestion. Check that it is accurate. |
| **NGO approved** | An NGO staff member reviewed and approved the plan. |
| **Sandbox** | A payment test environment; it is not a live PayPal payment. |
| **Simulated** | LIFELINE records a demo step, but it does not send money or perform that real-world action. |
| **Captured** | PayPal confirmed the donation. Supplier payment and delivery are separate steps. |
| **Not recorded yet** | No one has completed that step in LIFELINE yet. |

Supplier payments shown in the app are simulated. The app does not send PayPal payouts to a family or supplier. Use invented details for demonstrations; this prototype is not ready for real families’ personal information.

## 9. If something goes wrong

- **The app is slow the first time:** wait up to a minute for the API service to wake, then refresh once.
- **“Failed to fetch” or pages will not load:** check your internet connection, wait briefly, and refresh. If the problem continues, contact the person who maintains the website; the web app may not be able to reach its API.
- **You cannot see an NGO or Partner page:** ask an NGO team member or Admin to check your role. After a role change, sign out and back in.
- **Your new account cannot access the app:** make sure you completed any email confirmation and try signing in again. New accounts start as Donors.
- **A plan or request list is empty:** it may not have been created yet, may belong to another account, or may not have been approved. NGO cases and a donor’s own requests appear in different places.
- **PayPal returns but no success appears:** wait for the confirmation. A return from PayPal alone is not proof of payment; only the confirmed status counts.
- **You lose the pickup code:** contact the NGO. They can issue a new one for the family.

## 10. A quick first-time tour

If you are exploring the app for the first time, try this order:

1. Sign in with your assigned role.
2. Open **Profile** and check your role and display currency.
3. If you are NGO staff, open **Overview**, then **Assistance Cases** and **Suppliers**.
4. If you are a Donor, open **Approved Plans**, view a plan, and inspect its funding and progress. Only continue to PayPal if you have a Sandbox buyer account and are meant to test checkout.
5. If you are a Partner, open **Delivery Tracking** and follow the steps only for a delivery assigned to you.
6. Sign out when you finish on a shared device.


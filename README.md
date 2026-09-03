## Deployment Guide — `sendCreativeNotifications.gs`

### ⚠ Read first: this project has more than one script

Every `.gs` file in an Apps Script project shares **one global namespace**. Two files declaring the same variable gives you `SyntaxError: Identifier 'X' has already been declared`. Worse, two files declaring the same **function** produce *no error at all* — whichever loads last silently wins, and the other script stops working.

Because this spreadsheet has other scripts on it (columns L, S and T are theirs), everything here lives inside a single `BBW_NOTIFY` object and every entry point is prefixed `bbw`. This file adds exactly seven names to the global namespace and nothing else.

### Step 1 – Put it in the Apps Script editor
1. Open your Google Spreadsheet → **Extensions → Apps Script**.
2. **Delete any older copy of this notification script** from the project's file list (left sidebar). Leaving two copies is what causes the "already been declared" error.
3. Give this its own file, and paste in the entire contents of `sendCreativeNotifications.gs`.
4. **Save** (💾 or Ctrl+S).

### Step 2 – Verify nothing is clashing
1. Select **`bbwSelfCheck`** from the function drop-down → **▶ Run**.
2. Authorise when prompted (**Review permissions → Allow**) — it needs your Spreadsheet and permission to send mail.
3. Read the log. It reports name clashes, which account it runs as, remaining email quota, both timezones, and every trigger in the project.

### Step 3 – Install the trigger
1. Select **`bbwInstallDailyTrigger`** → **▶ Run**. This also removes any stale trigger pointing at the old `sendCreativeNotifications` name.
2. Confirm in the ⏰ **Triggers** sidebar: `bbwSendCreativeNotifications` → *Time-driven → Day timer → 7am–8am*.

> Triggers are **per account**. If a colleague installed it, you won't see it in your own Triggers list — check with them before installing a second one.

### Step 4 – Test manually
1. Add a test row to **bookings**: today + 2 days in Column H, a known creative name in Column O.
2. That creative must exist in **contractors** (Column C = name, Column D = email).
3. Run **`bbwDryRunNotifications`** — every check, but sends nothing. Read the log to see who *would* be emailed.
4. Run **`bbwSendCreativeNotifications`** for the real send, then remove the test row.

### Troubleshooting — run these when emails stop arriving
| Function | What it does |
|---|---|
| `bbwSelfCheck()` | Name clashes with other scripts, which account it runs as, email quota, script vs. spreadsheet timezone, and every trigger in the project. **Start here.** |
| `bbwDebugNotifications()` | Sheets found, resolved column letters, contractor map, every row's parsed date, and each creative → email lookup. |
| `bbwDryRunNotifications()` | Real run with sending disabled. |
| `bbwSendTestEmail()` | Emails the template — with placeholder names — to whoever authorised the script, for proof-reading. |

Also check the **Executions** page in the left sidebar. It lists every run and its failure reason. An empty list means the script has never fired at all, which points at a missing trigger or revoked authorization rather than anything in the code.

### Spreadsheet requirements
| Sheet name | Column | Content |
|---|---|---|
| `bookings` | E | Couple Names |
| `bookings` | H | Event Date (`MM/DD/YYYY`, `YYYY-MM-DD`, or a native Date cell) |
| `bookings` | O, P, Q, R | Finally assigned: lead photographer, second photographer, lead videographer, second videographer |
| `contractors` | C | Contractor Name (matched case- and spacing-insensitively) |
| `contractors` | D | Contractor Email Address |

Other bookings columns (D area, F city, G event type, I venue, J service type, K package/add-ons, M notes, N project folder, and L/S/T reserved for other scripts) are ignored by this script.

> **Sheet names** are matched case-insensitively, so `Bookings` and `bookings` both work.
> **Columns** are resolved from the header row by name first, and only fall back to the fixed letters above if the header is missing — so inserting a column no longer breaks the script. Any mismatch is written to the log as a `NOTE:` line.

---

This technical task is designed for an AI coding assistant to generate a Google Apps Script that automates email notifications based on a Google Sheet.
Technical Specification for Google Apps Script Automation
1. Objective
Create a Google Apps Script that monitors a Google Sheet and sends personalized emails to contractors exactly two days before a scheduled event
.
2. Data Structure
The script must interact with two specific sheets within the same Google Spreadsheet:
Sheet "bookings":
Column E: Client Name
.
Column H: Event Date (Format: MM/DD/YYYY)
.
Columns O, P, Q, R: Names of contractors/creatives
.
Sheet "contractors":
Column C: Contractor Name (matches names in "bookings")
.
Column D: Corresponding Email Address
.
3. Functional Requirements
Step 1: Date Verification
The script should iterate through each row in the "bookings" sheet.
It must read the date in Column H (event date).
Logic: If the current date is exactly two days before the event date, proceed with sending the message
.
Example: If the event date is 7/24/2026, the email should be sent on 7/22/2026
.
Step 2: Recipient Identification and Lookup
For a valid row, check Columns O, P, Q, and R for names.
Empty Cell Handling: If a cell in these columns is empty, skip it. If it contains a name, the script must find the matching email address
.
Mapping: Go to the "contractors" sheet, find the name in Column C, and retrieve the associated email from Column D
.
Step 3: Email Composition and Personalization
Subject Line: Use the client's name from Column E of the "bookings" sheet.
Template: "Ready for [Client Name]'s big day a quick friendly briefing"

.
Email Body: Use the contractor’s name found in Columns O–R.
Greeting: "Hi [Creative_Name],

We are so pumped to have you capturing [Client_Name]’s wedding with us! We truly value your talent and the unique eye you bring to the Blue Belle family.

To make sure everything goes like clockwork and we can get your edit started (and your invoice paid!) as fast as possible, we’ve put together a "cheat sheet" of our core standards. It’s a great way to sync up before the first shutter click.

Before you head out, please review our Creatives Portal & Handbook — it’s your best friend for all logistics.

🛠 The "Pro-Kit" Checklist
Clean Glass, Happy Editor: Please double-check that your sensors and lenses are sparkling clean. Dust spots and smudges are a nightmare in post!

Power & Space: Ensure you have several spare sets of batteries and enough formatted cards for the entire day.

Sync Your Gear (Crucial): Please make sure all cameras are synced to the exact same time/date. It saves our editors hours of work during multi-cam syncing!

Logistics: Double-check all addresses, weather, and traffic today. We want to make sure you’re at the right place at the right time without any stress.

Say Hello: Don't forget to do a "last call" with the couple to confirm the final timeline and locations.

🎥 Technical Magic (Video & Photo)
Keep it Steady: We’re all about that smooth, cinematic look—please use your 3-axis stabilizer for all moving shots. Handheld is a bit too "indie" for our brand, and we'd hate to have to apply deductions for shaky footage.

The Sweet Spot: Shoot at 60fps (keep 24fps just for the vows/speeches and only if you really need extra light. Basically, it's safer to keep 60fps for the entire footage).

Audio & Photo: External audio is mandatory for ceremonies/toasts (no in-camera audio!). Photographers: RAW format only, ISO under 3200, and use flash for dark environments. No Auto modes or JPEGs, please.

📂 Delivery & Payouts
How to Deliver: All you need to do to complete the media delivery step is go to the Media Delivery page on the Creatives Portal, select your project, and fill out the short form.

48-Hour Rule: Please ensure all uploads are completed within 48 hours of the wedding's completion.

No Alterations: Do NOT rename, transcode, or convert files. We need the original camera structure exactly as it was shot.

Verify Your Upload: Before finishing, double-check that the file count on your cards/drives matches the file count in the upload folder to ensure everything was transferred properly.

Quick Access Links:

📎 Media Delivery

📎 Handbook

📎 Requirements

We know you’re going to crush it out there! Go create some magic, capture those tear-jerking moments, and may your batteries be full and your memory cards never-ending.

If you get stuck, the Handbook is always there for you. Have an amazing shoot!

Best,

Andrew and Jack
Blue Belle Weddings"


[Creative_Name]  should be Taken from Column O, P, Q, or R of the bookings sheet
[Client Name]'s should be taken from column E of the bookings sheet
Media Delivery - https://sites.google.com/bluebelleweddings.com/creativesportal/media-delivery?authuser=0

Handbook - https://sites.google.com/bluebelleweddings.com/creativesportal/handbook?authuser=0

Requirements - https://sites.google.com/bluebelleweddings.com/creativesportal/our-requirements?authuser=0

The script should be able to handle multiple recipients for the same event, sending a personalized email to each
If there are 4 names in each row from O to R then 4 separate emails to 4 different creatives should be sent.
.

4. Technical Implementation Details

Language: Google Apps Script (JavaScript-based).

Trigger: The script should be designed to run daily (e.g., via a time-driven trigger) to check for upcoming events

.

Optimization: Use getValues() to retrieve data in bulk from both sheets to ensure the script runs efficiently and stays within Google's execution limits.

5. Example Scenario

Client Name (Col E): Anna

Contractor Name (Col O): Robin

Event Date (Col H): 7/24/2026

Script Execution Date: 7/22/2026

Result: Robin receives an email with the subject "Ready for Anna's big day a quick friendly briefing" and a body starting with "Hi Robin. ... *The rest of the message body*"


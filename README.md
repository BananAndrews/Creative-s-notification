## Deployment Guide — `sendCreativeNotifications.gs`

### Step 1 – Open the Apps Script editor
1. Open your Google Spreadsheet.
2. Click **Extensions → Apps Script**.
3. Delete any placeholder code in the editor.
4. Paste the entire contents of `sendCreativeNotifications.gs` into the editor.
5. Click **Save** (💾 or Ctrl+S). Name the project anything you like (e.g. *Blue Belle Notifications*).

### Step 2 – Authorise the script
1. In the function drop-down (top toolbar), select **`createDailyTrigger`**.
2. Click **▶ Run**.
3. Google will ask you to review permissions — click **Review permissions → Allow**.
   The script needs access to your Spreadsheet and permission to send email on your behalf.

### Step 3 – Verify the trigger was created
1. In the left sidebar click the **clock icon** (Triggers).
2. You should see a trigger: `sendCreativeNotifications` → *Time-driven → Day timer → 7am–8am*.
3. That's it! The script now runs automatically every morning at 7 AM.

### Step 4 – Test manually (optional but recommended)
1. Temporarily add a test row to the **bookings** sheet with today's date + 2 days in Column H and a known creative name in Column O.
2. Make sure that creative exists in the **contractors** sheet (Column C = name, Column D = email).
3. In the Apps Script editor, select **`sendCreativeNotifications`** from the drop-down and click **▶ Run**.
4. Check the **Execution log** (View → Logs) to confirm the email was sent.
5. Remove the test row when done.

### Spreadsheet requirements
| Sheet name | Column | Content |
|---|---|---|
| `bookings` | E | Client Name |
| `bookings` | H | Event Date (`MM/DD/YYYY` or a native Date cell) |
| `bookings` | O, P, Q, R | Creative / contractor names (leave empty if unused) |
| `contractors` | C | Contractor Name (must match exactly, case-insensitive) |
| `contractors` | D | Contractor Email Address |

> **Tip:** Both sheets must be named exactly `bookings` and `contractors` (lowercase).

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
48-Hour Rule: Please ensure all uploads are completed within 48 hours of the wedding's completion.

No Alterations: Do NOT rename, transcode, or convert files. We need the original camera structure exactly as it was shot.

Verify Your Upload: Before finishing, double-check that the file count on your cards/drives matches the file count in the upload folder to ensure everything was transferred properly.

Quick Access Links:

📎 Bookings Sheet (To confirm your rate and project details).

📎 Media Delivery Sheet (For folder structures and upload steps).

We know you’re going to crush it out there! Go create some magic, capture those tear-jerking moments, and may your batteries be full and your memory cards never-ending.

If you get stuck, the Handbook is always there for you. Have an amazing shoot!

Best,

Andrew and Jack
Blue Belle Weddings"


[Creative_Name]  should be Taken from Column O, P, Q, or R of the bookings sheet
[Client Name]'s should be taken from column E of the bookings sheet
 Bookings Sheet hyperlink - https://docs.google.com/spreadsheets/d/1Tf-h96pkJ1JZ_3TJAsYvFt7d-PHt5w-jm7TaH3Atq7A/edit?pli=1&gid=0#gid=0

Media Delivery Sheet hyperlink - https://docs.google.com/spreadsheets/d/1Tf-h96pkJ1JZ_3TJAsYvFt7d-PHt5w-jm7TaH3Atq7A/edit?pli=1&gid=1926724890#gid=1926724890

Creatives Portal & Handbook hhttps://sites.google.com/bluebelleweddings.com/creativesportal/home?authuser=7
.

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


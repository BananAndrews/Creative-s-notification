// ============================================================
//  Blue Belle Weddings – Creative Notification Script
//  Sends a briefing email to every creative assigned to a
//  booking exactly TWO days before the event date.
//
//  HOW TO DEPLOY
//  1. Open your Google Spreadsheet.
//  2. Extensions → Apps Script → paste this file.
//  3. Save, then run createDailyTrigger() ONCE to install the
//     automatic daily trigger.
//  4. Authorise the script when prompted.
// ============================================================

// ── Quick-access hyperlinks embedded in every email ─────────
var BOOKINGS_URL =
  "https://docs.google.com/spreadsheets/d/1Tf-h96pkJ1JZ_3TJAsYvFt7d-PHt5w-jm7TaH3Atq7A/edit?pli=1&gid=0#gid=0";

var MEDIA_DELIVERY_URL =
  "https://docs.google.com/spreadsheets/d/1Tf-h96pkJ1JZ_3TJAsYvFt7d-PHt5w-jm7TaH3Atq7A/edit?pli=1&gid=1926724890#gid=1926724890";

var HANDBOOK_URL =
  "https://sites.google.com/bluebelleweddings.com/creativesportal/home";

// ── Column indices (0-based) ─────────────────────────────────
// bookings sheet
var COL_CLIENT_NAME = 4;   // E
var COL_EVENT_DATE  = 7;   // H
var COL_CREATIVES   = [14, 15, 16, 17]; // O, P, Q, R

// contractors sheet
var COL_CONTRACTOR_NAME  = 2; // C
var COL_CONTRACTOR_EMAIL = 3; // D

// ── Main entry point ─────────────────────────────────────────
function sendCreativeNotifications() {
  var ss           = SpreadsheetApp.getActiveSpreadsheet();
  var bookingsSheet    = ss.getSheetByName("bookings");
  var contractorsSheet = ss.getSheetByName("contractors");

  if (!bookingsSheet || !contractorsSheet) {
    Logger.log("ERROR: Could not find 'bookings' or 'contractors' sheet. Check sheet names.");
    return;
  }

  // Build email-lookup map from contractors sheet (name → email)
  var contractorData = contractorsSheet.getDataRange().getValues();
  var emailMap = {};
  for (var c = 1; c < contractorData.length; c++) { // skip header row
    var name  = String(contractorData[c][COL_CONTRACTOR_NAME]).trim();
    var email = String(contractorData[c][COL_CONTRACTOR_EMAIL]).trim();
    if (name && email) {
      emailMap[name.toLowerCase()] = email;
    }
  }

  // Target date = today + 2 days (time-stripped, local midnight)
  var today      = new Date();
  var targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);

  // Read all booking rows in one call
  var bookingData = bookingsSheet.getDataRange().getValues();
  var emailsSent  = 0;

  for (var r = 1; r < bookingData.length; r++) { // skip header row
    var row        = bookingData[r];
    var clientName = String(row[COL_CLIENT_NAME]).trim();
    var rawDate    = row[COL_EVENT_DATE];

    if (!clientName || !rawDate) continue;

    // Parse event date – handles both Date objects and MM/DD/YYYY strings
    var eventDate = parseEventDate(rawDate);
    if (!eventDate) {
      Logger.log("Row " + (r + 1) + ": Could not parse date '" + rawDate + "' – skipped.");
      continue;
    }

    // Compare date portions only (ignore time)
    if (!isSameDay(eventDate, targetDate)) continue;

    Logger.log("Row " + (r + 1) + ": Event on " + eventDate.toDateString() + " matches. Checking creatives…");

    // Send one email per creative found in columns O–R
    for (var i = 0; i < COL_CREATIVES.length; i++) {
      var creativeName = String(row[COL_CREATIVES[i]]).trim();
      if (!creativeName) continue;

      var recipientEmail = emailMap[creativeName.toLowerCase()];
      if (!recipientEmail) {
        Logger.log("  WARNING: No email found for creative '" + creativeName + "' – skipped.");
        continue;
      }

      var subject  = buildSubject(clientName);
      var htmlBody = buildEmailBody(creativeName, clientName);

      MailApp.sendEmail({
        to:       recipientEmail,
        subject:  subject,
        htmlBody: htmlBody
      });

      emailsSent++;
      Logger.log("  Email sent → " + creativeName + " <" + recipientEmail + ">");
    }
  }

  Logger.log("Done. Total emails sent: " + emailsSent);
}

// ── Email builders ───────────────────────────────────────────
function buildSubject(clientName) {
  return "Ready for " + clientName + "'s big day \u2013 a quick friendly briefing";
}

function buildEmailBody(creativeName, clientName) {
  return "<div style='font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;max-width:680px'>"

    + "<p>Hi " + creativeName + ",</p>"

    + "<p>We are so pumped to have you capturing <strong>" + clientName + "</strong>'s wedding with us! "
    + "We truly value your talent and the unique eye you bring to the Blue Belle family.</p>"

    + "<p>To make sure everything goes like clockwork and we can get your edit started (and your invoice paid!) "
    + "as fast as possible, we've put together a <em>\"cheat sheet\"</em> of our core standards. "
    + "It's a great way to sync up before the first shutter click.</p>"

    + "<p>Before you head out, please review our "
    + "<a href='" + HANDBOOK_URL + "'>Creatives Portal &amp; Handbook</a> "
    + "— it's your best friend for all logistics.</p>"

    + "<hr style='border:none;border-top:1px solid #ddd;margin:20px 0'>"

    + "<h3 style='color:#4a4a4a'>🛠 The \"Pro-Kit\" Checklist</h3>"
    + "<p><strong>Clean Glass, Happy Editor:</strong> Please double-check that your sensors and lenses are "
    + "sparkling clean. Dust spots and smudges are a nightmare in post!</p>"
    + "<p><strong>Power &amp; Space:</strong> Ensure you have several spare sets of batteries and enough "
    + "formatted cards for the entire day.</p>"
    + "<p><strong>Sync Your Gear (Crucial):</strong> Please make sure all cameras are synced to the exact "
    + "same time/date. It saves our editors hours of work during multi-cam syncing!</p>"
    + "<p><strong>Logistics:</strong> Double-check all addresses, weather, and traffic today. We want to make "
    + "sure you're at the right place at the right time without any stress.</p>"
    + "<p><strong>Say Hello:</strong> Don't forget to do a \"last call\" with the couple to confirm the final "
    + "timeline and locations.</p>"

    + "<hr style='border:none;border-top:1px solid #ddd;margin:20px 0'>"

    + "<h3 style='color:#4a4a4a'>🎥 Technical Magic (Video &amp; Photo)</h3>"
    + "<p><strong>Keep it Steady:</strong> We're all about that smooth, cinematic look—please use your "
    + "3-axis stabilizer for all moving shots. Handheld is a bit too \"indie\" for our brand, and we'd "
    + "hate to have to apply deductions for shaky footage.</p>"
    + "<p><strong>The Sweet Spot:</strong> Shoot at 60fps (keep 24fps just for the vows/speeches and only "
    + "if you really need extra light. Basically, it's safer to keep 60fps for the entire footage).</p>"
    + "<p><strong>Audio &amp; Photo:</strong> External audio is mandatory for ceremonies/toasts "
    + "(no in-camera audio!). Photographers: RAW format only, ISO under 3200, and use flash for dark "
    + "environments. No Auto modes or JPEGs, please.</p>"

    + "<hr style='border:none;border-top:1px solid #ddd;margin:20px 0'>"

    + "<h3 style='color:#4a4a4a'>📂 Delivery &amp; Payouts</h3>"
    + "<p><strong>48-Hour Rule:</strong> Please ensure all uploads are completed within 48 hours of the "
    + "wedding's completion.</p>"
    + "<p><strong>No Alterations:</strong> Do NOT rename, transcode, or convert files. We need the original "
    + "camera structure exactly as it was shot.</p>"
    + "<p><strong>Verify Your Upload:</strong> Before finishing, double-check that the file count on your "
    + "cards/drives matches the file count in the upload folder to ensure everything was transferred "
    + "properly.</p>"

    + "<hr style='border:none;border-top:1px solid #ddd;margin:20px 0'>"

    + "<p><strong>Quick Access Links:</strong></p>"
    + "<p>📎 <a href='" + BOOKINGS_URL + "'>Bookings Sheet</a> (To confirm your rate and project details).</p>"
    + "<p>📎 <a href='" + MEDIA_DELIVERY_URL + "'>Media Delivery Sheet</a> (For folder structures and upload steps).</p>"

    + "<hr style='border:none;border-top:1px solid #ddd;margin:20px 0'>"

    + "<p>We know you're going to crush it out there! Go create some magic, capture those tear-jerking moments, "
    + "and may your batteries be full and your memory cards never-ending.</p>"
    + "<p>If you get stuck, the Handbook is always there for you. Have an amazing shoot!</p>"

    + "<p>Best,<br><strong>Andrew and Jack</strong><br>Blue Belle Weddings</p>"
    + "</div>";
}

// ── Date helpers ─────────────────────────────────────────────

/**
 * Accepts a native Date object (when Sheets auto-parses the cell)
 * OR a string in MM/DD/YYYY format.
 * Returns a Date at local midnight, or null on failure.
 */
function parseEventDate(raw) {
  if (raw instanceof Date && !isNaN(raw)) {
    return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
  }

  var str = String(raw).trim();
  // Match MM/DD/YYYY
  var parts = str.match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/);
  if (parts) {
    var month = parseInt(parts[1], 10) - 1;
    var day   = parseInt(parts[2], 10);
    var year  = parseInt(parts[3], 10);
    return new Date(year, month, day);
  }

  return null;
}

/** Returns true when two Date objects fall on the same calendar day. */
function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

// ── One-time trigger installer ────────────────────────────────
/**
 * Run this function ONCE from the Apps Script editor to create
 * a daily time-driven trigger that fires every morning at 7 AM.
 * Running it again will NOT create duplicates (it checks first).
 */
function createDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var t = 0; t < triggers.length; t++) {
    if (triggers[t].getHandlerFunction() === "sendCreativeNotifications") {
      Logger.log("Trigger already exists – nothing to do.");
      return;
    }
  }

  ScriptApp.newTrigger("sendCreativeNotifications")
    .timeBased()
    .everyDays(1)
    .atHour(7)   // 7 AM in the script's timezone (set in Project Settings)
    .create();

  Logger.log("Daily trigger created. sendCreativeNotifications will run every day at 7 AM.");
}

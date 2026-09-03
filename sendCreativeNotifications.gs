// ============================================================
//  Blue Belle Weddings – Creative Notification Script
//  Sends a briefing email to every creative assigned to a
//  booking exactly TWO days before the event date.
//
//  ⚠ IMPORTANT – NAMESPACING
//  Every .gs file in an Apps Script project shares ONE global
//  namespace. If two files declare the same variable you get
//  "Identifier X has already been declared"; if two files
//  declare the same *function*, the last one loaded silently
//  wins and the other script breaks with no error at all.
//
//  So everything here lives inside the single BBW_NOTIFY object
//  and every entry point is prefixed "bbw". Nothing else is
//  added to the global namespace, so this file can safely
//  coexist with the other scripts on this spreadsheet.
//
//  HOW TO DEPLOY
//  1. Open your Google Spreadsheet.
//  2. Extensions → Apps Script.
//  3. Put this in its OWN file, and delete any older copy of
//     this notification script from the project.
//  4. Run bbwSelfCheck() – it verifies nothing is clashing.
//  5. Run bbwInstallDailyTrigger() ONCE.
//
//  IF EMAILS ARE NOT ARRIVING, run in this order:
//    bbwSelfCheck()          – name clashes, trigger, quota
//    bbwDebugNotifications() – sheets, columns, dates, lookups
//    bbwDryRunNotifications()– full run, sends nothing
// ============================================================

var BBW_NOTIFY = (function () {

  // Bumped whenever this file changes, so bbwSelfCheck() can prove
  // which copy of the script is actually live.
  var VERSION = "2026-08-27";

  // A private marker stamped onto each global entry point. If another
  // file redefines one of those names, the marker disappears and
  // bbwSelfCheck() catches it instead of failing silently.
  var SIGNATURE = "bbw-notify-" + VERSION;

  // ── Quick-access hyperlinks embedded in every email ─────────
  var MEDIA_DELIVERY_URL =
    "https://sites.google.com/bluebelleweddings.com/creativesportal/media-delivery?authuser=0";

  var HANDBOOK_URL =
    "https://sites.google.com/bluebelleweddings.com/creativesportal/handbook?authuser=0";

  var REQUIREMENTS_URL =
    "https://sites.google.com/bluebelleweddings.com/creativesportal/our-requirements?authuser=0";

  // ── Trigger wiring ───────────────────────────────────────────
  var TRIGGER_HANDLER = "bbwSendCreativeNotifications";
  var TRIGGER_HOUR    = 7;
  // Triggers left over from earlier versions of this script, cleaned
  // up by bbwInstallDailyTrigger() so they cannot double-send.
  var LEGACY_HANDLERS = ["sendCreativeNotifications"];

  // ── Sheet names ──────────────────────────────────────────────
  // Matched case-insensitively, so "Bookings" / " bookings " still work.
  var BOOKINGS_SHEET_NAMES    = ["bookings", "booking", "bookings sheet"];
  var CONTRACTORS_SHEET_NAMES = ["contractors", "contractor", "creatives", "contractors sheet"];

  // ── Column layout ────────────────────────────────────────────
  // Current bookings sheet:
  //   D area | E couple names | F city | G type of event | H event date |
  //   I venue | J service type | K package/add-ons/comments | L (other scripts) |
  //   M notes | N project folder | O lead photographer | P second photographer |
  //   Q lead videographer | R second videographer | S,T (other scripts)
  //
  // `fallback` is the 0-based index used when the header text cannot be found.
  // `headers` lets the script survive columns being inserted or renamed: if a
  // matching header exists, its real position wins over the fallback index.
  var BOOKINGS_COLUMNS = {
    clientName: {
      fallback: 4,   // E
      headers: ["couple names", "couple name", "couples", "couple", "client name", "clients", "client"]
    },
    eventDate: {
      fallback: 7,   // H
      headers: ["event date", "date of event", "wedding date", "event day", "date"]
    }
  };

  // Creative columns, in the order they should be emailed.
  var CREATIVE_COLUMNS = [
    { label: "Lead photographer",   fallback: 14, headers: ["finally assigned: lead photographer", "lead photographer", "lead photo"] },
    { label: "Second photographer", fallback: 15, headers: ["finally assigned: second photographer", "second photographer", "2nd photographer"] },
    { label: "Lead videographer",   fallback: 16, headers: ["finally assigned: lead videographer", "lead videographer", "lead video"] },
    { label: "Second videographer", fallback: 17, headers: ["finally assigned: second videographer", "second videographer", "2nd videographer"] }
  ];

  var CONTRACTOR_COLUMNS = {
    name:  { fallback: 2, headers: ["name", "contractor name", "creative name", "full name"] },   // C
    email: { fallback: 3, headers: ["email", "email address", "e-mail", "contact email"] }        // D
  };

  // How many rows from the top to scan when hunting for the header row.
  var HEADER_SEARCH_ROWS = 10;

  // ── Main run ─────────────────────────────────────────────────
  function run(dryRun) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      Logger.log("ERROR: no active spreadsheet. This script must be bound to the bookings spreadsheet "
        + "(Extensions → Apps Script from inside that file), not run as a standalone project.");
      return;
    }

    Logger.log("BBW_NOTIFY " + VERSION + " | spreadsheet: '" + ss.getName() + "'");

    var bookingsSheet    = findSheet(ss, BOOKINGS_SHEET_NAMES);
    var contractorsSheet = findSheet(ss, CONTRACTORS_SHEET_NAMES);

    if (!bookingsSheet || !contractorsSheet) {
      Logger.log("ERROR: Missing sheet. bookings=" + (bookingsSheet ? "OK" : "NOT FOUND")
        + ", contractors=" + (contractorsSheet ? "OK" : "NOT FOUND"));
      Logger.log("Sheets actually in this spreadsheet: " + listSheetNames(ss).join(" | "));
      return;
    }

    var tz = ss.getSpreadsheetTimeZone();

    var emailMap = buildEmailMap(contractorsSheet);
    if (isEmptyObject(emailMap)) {
      Logger.log("ERROR: No usable name/email pairs found in '" + contractorsSheet.getName()
        + "'. Check that the name and email columns still hold what the script expects.");
      return;
    }

    var bookingData = bookingsSheet.getDataRange().getValues();
    if (!bookingData.length) {
      Logger.log("ERROR: '" + bookingsSheet.getName() + "' is empty.");
      return;
    }

    var layout   = resolveBookingsLayout(bookingData);
    var colName  = layout.columns.clientName;
    var colDate  = layout.columns.eventDate;
    var creative = layout.creatives;

    // Target date = today + 2 days, computed in the SPREADSHEET's timezone.
    // (Using the raw script clock here is an off-by-one-day trap when the
    // script project and the spreadsheet sit in different timezones.)
    var today      = todayInTimezone(tz);
    var targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
    Logger.log("Timezone: " + tz + " | Today: " + today.toDateString() + " | Target (+2): " + targetDate.toDateString());

    var emailsSent  = 0;
    var matchedRows = 0;

    for (var r = layout.firstDataRow; r < bookingData.length; r++) {
      var row        = bookingData[r];
      var clientName = cleanCell(row[colName]);
      var rawDate    = row[colDate];

      if (!clientName || rawDate === "" || rawDate === null) continue;

      var eventDate = parseEventDate(rawDate, tz);
      if (!eventDate) {
        Logger.log("Row " + (r + 1) + ": could not parse date '" + rawDate + "' – skipped.");
        continue;
      }

      if (!isSameDay(eventDate, targetDate)) continue;

      matchedRows++;
      Logger.log("Row " + (r + 1) + ": '" + clientName + "' on " + eventDate.toDateString() + " matches. Checking creatives…");

      for (var i = 0; i < creative.length; i++) {
        var creativeName = cleanCell(row[creative[i].index]);
        if (!creativeName || isPlaceholder(creativeName)) continue;

        var recipientEmail = lookupEmail(emailMap, creativeName);
        if (!recipientEmail) {
          Logger.log("  WARNING: no email for " + creative[i].label + " '" + creativeName + "' – skipped.");
          continue;
        }

        if (dryRun) {
          Logger.log("  [DRY RUN] would email " + creativeName + " <" + recipientEmail + ">");
          emailsSent++;
          continue;
        }

        MailApp.sendEmail({
          to:       recipientEmail,
          subject:  buildSubject(clientName),
          htmlBody: buildEmailBody(creativeName, clientName)
        });

        emailsSent++;
        Logger.log("  Email sent → " + creativeName + " <" + recipientEmail + ">");
      }
    }

    if (!matchedRows) {
      Logger.log("No bookings fall on " + targetDate.toDateString() + ". Nothing to send.");
    }
    Logger.log("Done. Total emails " + (dryRun ? "that would be sent" : "sent") + ": " + emailsSent);
  }

  // ── Sheet / column resolution ────────────────────────────────

  function listSheetNames(ss) {
    var sheets = ss.getSheets();
    var names = [];
    for (var i = 0; i < sheets.length; i++) names.push("'" + sheets[i].getName() + "'");
    return names;
  }

  /** Finds a sheet by any of the candidate names, ignoring case and stray spaces. */
  function findSheet(ss, candidates) {
    var sheets = ss.getSheets();
    for (var c = 0; c < candidates.length; c++) {
      for (var s = 0; s < sheets.length; s++) {
        if (normalize(sheets[s].getName()) === normalize(candidates[c])) return sheets[s];
      }
    }
    return null;
  }

  /** Lowercase, trim, collapse inner whitespace, drop a trailing colon. */
  function normalize(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .replace(/:$/, "");
  }

  function cleanCell(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  /** Cells people use as "nobody assigned yet". */
  function isPlaceholder(value) {
    var v = normalize(value);
    return v === "-" || v === "n/a" || v === "na" || v === "tbd" || v === "tba" || v === "none" || v === "x";
  }

  function isEmptyObject(obj) {
    for (var k in obj) if (obj.hasOwnProperty(k)) return false;
    return true;
  }

  function countKeys(obj) {
    var n = 0;
    for (var k in obj) if (obj.hasOwnProperty(k)) n++;
    return n;
  }

  /**
   * Locates the header row (the row in the first HEADER_SEARCH_ROWS with the
   * most recognised header names) and maps every configured column onto its
   * real position. Falls back to the hard-coded index when a header is gone.
   */
  function resolveBookingsLayout(data) {
    var specs = [];
    for (var key in BOOKINGS_COLUMNS) {
      if (BOOKINGS_COLUMNS.hasOwnProperty(key)) specs.push({ spec: BOOKINGS_COLUMNS[key] });
    }
    for (var i = 0; i < CREATIVE_COLUMNS.length; i++) {
      specs.push({ spec: CREATIVE_COLUMNS[i] });
    }

    var headerRow = findHeaderRow(data, specs);
    var header    = headerRow >= 0 ? data[headerRow] : null;

    var columns = {};
    for (var key2 in BOOKINGS_COLUMNS) {
      if (!BOOKINGS_COLUMNS.hasOwnProperty(key2)) continue;
      columns[key2] = resolveColumn(header, BOOKINGS_COLUMNS[key2], "bookings." + key2);
    }

    var creatives = [];
    for (var c = 0; c < CREATIVE_COLUMNS.length; c++) {
      creatives.push({
        label: CREATIVE_COLUMNS[c].label,
        index: resolveColumn(header, CREATIVE_COLUMNS[c], "bookings." + CREATIVE_COLUMNS[c].label)
      });
    }

    return {
      headerRow:    headerRow,
      firstDataRow: headerRow >= 0 ? headerRow + 1 : 0,
      columns:      columns,
      creatives:    creatives
    };
  }

  function findHeaderRow(data, specs) {
    var bestRow  = -1;
    var bestHits = 0;
    var limit    = Math.min(HEADER_SEARCH_ROWS, data.length);

    for (var r = 0; r < limit; r++) {
      var hits = 0;
      for (var s = 0; s < specs.length; s++) {
        if (matchHeader(data[r], specs[s].spec.headers) >= 0) hits++;
      }
      if (hits > bestHits) { bestHits = hits; bestRow = r; }
    }

    // One lucky word ("date") is not proof of a header row.
    return bestHits >= 2 ? bestRow : -1;
  }

  /** Exact header match first, then "header contains alias" as a looser pass. */
  function matchHeader(headerRow, aliases) {
    if (!headerRow) return -1;

    for (var a = 0; a < aliases.length; a++) {
      var alias = normalize(aliases[a]);
      for (var i = 0; i < headerRow.length; i++) {
        if (normalize(headerRow[i]) === alias) return i;
      }
    }
    for (var a2 = 0; a2 < aliases.length; a2++) {
      var alias2 = normalize(aliases[a2]);
      if (alias2.length < 4) continue; // too short to match loosely without false hits
      for (var j = 0; j < headerRow.length; j++) {
        var cell = normalize(headerRow[j]);
        if (cell && cell.indexOf(alias2) !== -1) return j;
      }
    }
    return -1;
  }

  function resolveColumn(header, spec, label) {
    var found = matchHeader(header, spec.headers);
    if (found >= 0) {
      if (found !== spec.fallback) {
        Logger.log("NOTE: " + label + " moved to column " + columnLetter(found)
          + " (expected " + columnLetter(spec.fallback) + ") – using the header position.");
      }
      return found;
    }
    Logger.log("NOTE: no header found for " + label + " – falling back to column " + columnLetter(spec.fallback) + ".");
    return spec.fallback;
  }

  function columnLetter(index) {
    var letter = "";
    var n = index;
    while (n >= 0) {
      letter = String.fromCharCode(65 + (n % 26)) + letter;
      n = Math.floor(n / 26) - 1;
    }
    return letter;
  }

  // ── Contractor lookup ────────────────────────────────────────

  /**
   * Builds a normalised name → email map. Resolves the name/email columns from
   * the header row, and if that yields no emails at all it scans every column
   * for the one that actually contains addresses before giving up.
   */
  function buildEmailMap(sheet) {
    var data = sheet.getDataRange().getValues();
    if (!data.length) return {};

    var specs = [
      { spec: CONTRACTOR_COLUMNS.name },
      { spec: CONTRACTOR_COLUMNS.email }
    ];
    var headerRow = findHeaderRow(data, specs);
    var header    = headerRow >= 0 ? data[headerRow] : null;

    var nameCol  = resolveColumn(header, CONTRACTOR_COLUMNS.name,  "contractors.name");
    var emailCol = resolveColumn(header, CONTRACTOR_COLUMNS.email, "contractors.email");

    var map = collectEmails(data, nameCol, emailCol);

    if (isEmptyObject(map)) {
      var guess = guessEmailColumn(data);
      if (guess >= 0 && guess !== emailCol) {
        Logger.log("NOTE: no emails in column " + columnLetter(emailCol)
          + "; addresses were found in " + columnLetter(guess) + " instead – using that.");
        map = collectEmails(data, nameCol, guess);
      }
    }

    Logger.log("Contractors loaded: " + countKeys(map));
    return map;
  }

  function collectEmails(data, nameCol, emailCol) {
    var map = {};
    for (var r = 0; r < data.length; r++) {
      var name  = cleanCell(data[r][nameCol]);
      var email = extractEmail(data[r][emailCol]);
      if (!name || !email) continue;
      map[normalize(name)] = email;
    }
    return map;
  }

  /** Returns the column holding the most email-looking values, or -1. */
  function guessEmailColumn(data) {
    var counts = [];
    var best = -1;
    for (var r = 0; r < data.length; r++) {
      for (var c = 0; c < data[r].length; c++) {
        if (!extractEmail(data[r][c])) continue;
        counts[c] = (counts[c] || 0) + 1;
        if (best < 0 || counts[c] > counts[best]) best = c;
      }
    }
    return best;
  }

  /** Pulls an address out of "a@b.com", "Name <a@b.com>", or "a@b.com; c@d.com". */
  function extractEmail(value) {
    var match = String(value == null ? "" : value)
      .match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
    return match ? match[0] : "";
  }

  /**
   * Name → email, tolerating case, extra spaces, a trailing "(role)" or note,
   * and cells where someone typed the address straight into the bookings sheet.
   */
  function lookupEmail(emailMap, creativeName) {
    var direct = extractEmail(creativeName);
    if (direct) return direct;

    var key = normalize(creativeName);
    if (emailMap[key]) return emailMap[key];

    // Strip a trailing parenthetical / bracketed note: "Robin (2nd shooter)".
    var stripped = normalize(creativeName.replace(/[\(\[].*$/, ""));
    if (stripped && emailMap[stripped]) return emailMap[stripped];

    // "Last, First" written the other way round.
    var comma = key.indexOf(",");
    if (comma !== -1) {
      var flipped = normalize(key.slice(comma + 1) + " " + key.slice(0, comma));
      if (emailMap[flipped]) return emailMap[flipped];
    }

    return "";
  }

  // ── Email builders ───────────────────────────────────────────
  function buildSubject(clientName) {
    return "📸 Ready for " + clientName + "'s big day? A quick friendly briefing!";
  }

  function buildEmailBody(creativeName, clientName) {
    return "<div style='font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;max-width:680px'>"

      + "<p>Hi " + creativeName.split(" ")[0] + ",</p>"

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
      + "<p><strong>Logistics:</strong> Before the shoot, please double-check all addresses and weather, "
      + "and be sure to check live traffic to ensure you are at the right place at the right time.</p>"
      + "<p><strong>Say Hello:</strong> Don't forget to send the couple a quick \"Happy Wedding Day!\" text message "
      + "on the morning of the event. It's the best way to wish them a great day, confirm the final timeline, "
      + "and let them know you'll see them soon without disturbing their preparations.</p>"

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
      + "<p><strong>How to Deliver:</strong> All you need to do to complete the media delivery step is go to the "
      + "<a href='" + MEDIA_DELIVERY_URL + "'>Media Delivery page</a> on the Creatives Portal, select your project, "
      + "and fill out the short form. That's it.</p>"
      + "<p><strong>48-Hour Rule:</strong> Please ensure all uploads are completed within 48 hours of the "
      + "wedding's completion.</p>"
      + "<p><strong>No Alterations:</strong> Do NOT rename, transcode, or convert files. We need the original "
      + "camera structure exactly as it was shot.</p>"
      + "<p><strong>Verify Your Upload:</strong> Before finishing, double-check that the file count on your "
      + "cards/drives matches the file count in the upload folder to ensure everything was transferred "
      + "properly.</p>"

      + "<hr style='border:none;border-top:1px solid #ddd;margin:20px 0'>"

      + "<p><strong>Quick Access Links:</strong></p>"
      + "<p>📎 <a href='" + MEDIA_DELIVERY_URL + "'>Media Delivery</a></p>"
      + "<p>📎 <a href='" + HANDBOOK_URL + "'>Handbook</a></p>"
      + "<p>📎 <a href='" + REQUIREMENTS_URL + "'>Requirements</a></p>"

      + "<hr style='border:none;border-top:1px solid #ddd;margin:20px 0'>"

      + "<p>We know you're going to crush it out there! Go create some magic, capture those tear-jerking moments, "
      + "and may your batteries be full and your memory cards never-ending.</p>"
      + "<p>If you get stuck, the Handbook is always there for you. Have an amazing shoot!</p>"

      + "<p>Best,<br><strong>Andrew and Jack</strong><br>Blue Belle Weddings</p>"
      + "</div>";
  }

  // ── Date helpers ─────────────────────────────────────────────

  /** Today at local midnight, read through the spreadsheet's timezone. */
  function todayInTimezone(tz) {
    var parts = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd").split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  /**
   * Accepts a native Date object (when Sheets auto-parses the cell),
   * a MM/DD/YYYY or YYYY-MM-DD string, OR a Sheets serial-number
   * (days since 30 Dec 1899). Returns a Date at local midnight, or null.
   */
  function parseEventDate(raw, tz) {
    // Case 1: Sheets already handed us a proper Date object.
    // Read it back through the spreadsheet timezone so a cell stored as
    // midnight elsewhere doesn't slide onto the previous day.
    if (raw instanceof Date && !isNaN(raw)) {
      if (tz) {
        var ymd = Utilities.formatDate(raw, tz, "yyyy-MM-dd").split("-");
        return new Date(Number(ymd[0]), Number(ymd[1]) - 1, Number(ymd[2]));
      }
      return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
    }

    // Case 2: Sheets date serial number (a plain positive integer/float)
    if (typeof raw === "number" && raw > 0) {
      // Sheets epoch = 30 Dec 1899; add serial days to get the real date
      var epoch = new Date(1899, 11, 30);
      var d     = new Date(epoch.getTime() + raw * 86400000);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    var str = String(raw).trim();
    if (!str) return null;

    // Case 3: MM/DD/YYYY or MM-DD-YYYY (2- or 4-digit year)
    var slash = str.match(/^([0-9]{1,2})[\/\-\.]([0-9]{1,2})[\/\-\.]([0-9]{2}|[0-9]{4})$/);
    if (slash) {
      var year = parseInt(slash[3], 10);
      if (year < 100) year += 2000;
      return new Date(year, parseInt(slash[1], 10) - 1, parseInt(slash[2], 10));
    }

    // Case 4: ISO-style YYYY-MM-DD (optionally with a time appended)
    var iso = str.match(/^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})/);
    if (iso) {
      return new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
    }

    // Case 5: anything the JS engine recognises, e.g. "July 24, 2026"
    var parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
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

  // ── Diagnostics ──────────────────────────────────────────────

  /**
   * Confirms this file is the one actually running, that nothing else in
   * the project has hijacked its entry points, that the trigger exists,
   * and that there is email quota left.
   */
  function selfCheck() {
    Logger.log("=== SELF CHECK ===");
    Logger.log("BBW_NOTIFY version: " + VERSION);

    // 1. Entry points still ours?
    var entryPoints = [
      "bbwSendCreativeNotifications",
      "bbwDryRunNotifications",
      "bbwDebugNotifications",
      "bbwSendTestEmail",
      "bbwInstallDailyTrigger",
      "bbwSelfCheck"
    ];
    var scope = (typeof globalThis !== "undefined") ? globalThis : this;
    var hijacked = 0;
    for (var e = 0; e < entryPoints.length; e++) {
      var fn = scope[entryPoints[e]];
      if (typeof fn !== "function") {
        Logger.log("  FAIL: " + entryPoints[e] + " is not defined.");
        hijacked++;
      } else if (fn.bbwSignature !== SIGNATURE) {
        Logger.log("  FAIL: " + entryPoints[e] + " has been REDEFINED by another file in this project. "
          + "Rename the other one – whichever loads last wins and the other script silently breaks.");
        hijacked++;
      }
    }
    Logger.log(hijacked ? "  " + hijacked + " entry point(s) clashing." : "  Entry points OK – no name clashes.");

    // 2. Who is this running as, and is there quota?
    var effective = "";
    try { effective = Session.getEffectiveUser().getEmail(); } catch (err) { effective = "(unavailable: " + err + ")"; }
    Logger.log("  Runs as (effective user): " + (effective || "(blank)"));
    try { Logger.log("  Remaining email quota today: " + MailApp.getRemainingDailyQuota()); }
    catch (err2) { Logger.log("  Could not read email quota: " + err2); }

    // 3. Timezones – a mismatch is a silent off-by-one-day bug.
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var scriptTz = Session.getScriptTimeZone();
    if (!ss) {
      Logger.log("  FAIL: no active spreadsheet – this script is NOT bound to the bookings file.");
    } else {
      var sheetTz = ss.getSpreadsheetTimeZone();
      Logger.log("  Bound spreadsheet: '" + ss.getName() + "'");
      Logger.log("  Script timezone: " + scriptTz + " | Spreadsheet timezone: " + sheetTz
        + (scriptTz === sheetTz ? " (match)" : " (MISMATCH – handled, but worth aligning in Project Settings)"));
    }

    // 4. Triggers – including ones belonging to the other scripts here.
    var triggers = ScriptApp.getProjectTriggers();
    Logger.log("  Triggers in this project: " + triggers.length);
    var installed = false;
    for (var t = 0; t < triggers.length; t++) {
      var handler = triggers[t].getHandlerFunction();
      Logger.log("    → " + handler + " (" + triggers[t].getEventType() + ")");
      if (handler === TRIGGER_HANDLER) installed = true;
    }
    Logger.log(installed
      ? "  Daily trigger for " + TRIGGER_HANDLER + " is INSTALLED."
      : "  NO trigger for " + TRIGGER_HANDLER + " – run bbwInstallDailyTrigger(). "
        + "This alone would mean the script has never run on its own.");

    Logger.log("=== SELF CHECK END ===");
  }

  /** Full diagnostic report: sheets, columns, dates, and name lookups. */
  function debug() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    Logger.log("=== DEBUG START (BBW_NOTIFY " + VERSION + ") ===");
    if (!ss) { Logger.log("FAIL: no active spreadsheet – script is not bound to the bookings file."); return; }

    Logger.log("Spreadsheet: '" + ss.getName() + "' | timezone: " + ss.getSpreadsheetTimeZone());
    Logger.log("Sheets present: " + listSheetNames(ss).join(" | "));

    var bookingsSheet    = findSheet(ss, BOOKINGS_SHEET_NAMES);
    var contractorsSheet = findSheet(ss, CONTRACTORS_SHEET_NAMES);

    if (!bookingsSheet)    { Logger.log("FAIL: no sheet matching " + BOOKINGS_SHEET_NAMES.join("/"));    return; }
    if (!contractorsSheet) { Logger.log("FAIL: no sheet matching " + CONTRACTORS_SHEET_NAMES.join("/")); return; }

    Logger.log("Using bookings sheet    : '" + bookingsSheet.getName() + "'");
    Logger.log("Using contractors sheet : '" + contractorsSheet.getName() + "'");

    var tz       = ss.getSpreadsheetTimeZone();
    var emailMap = buildEmailMap(contractorsSheet);
    for (var k in emailMap) {
      if (emailMap.hasOwnProperty(k)) Logger.log("  contractor: '" + k + "' → " + emailMap[k]);
    }

    var bookingData = bookingsSheet.getDataRange().getValues();
    if (!bookingData.length) { Logger.log("FAIL: bookings sheet is empty."); return; }

    var layout = resolveBookingsLayout(bookingData);
    Logger.log("Header row detected at row " + (layout.headerRow >= 0 ? layout.headerRow + 1 : "NONE (using fallback indices)"));
    Logger.log("Client name column : " + columnLetter(layout.columns.clientName));
    Logger.log("Event date column  : " + columnLetter(layout.columns.eventDate));
    for (var ci = 0; ci < layout.creatives.length; ci++) {
      Logger.log("Creative column    : " + columnLetter(layout.creatives[ci].index) + " → " + layout.creatives[ci].label);
    }

    var today      = todayInTimezone(tz);
    var targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
    Logger.log("Today           : " + today.toDateString());
    Logger.log("Target date (+2): " + targetDate.toDateString());
    Logger.log("bookings rows (incl. header): " + bookingData.length);

    for (var r = layout.firstDataRow; r < bookingData.length; r++) {
      var row        = bookingData[r];
      var clientName = cleanCell(row[layout.columns.clientName]);
      var rawDate    = row[layout.columns.eventDate];
      var eventDate  = parseEventDate(rawDate, tz);

      if (!clientName && (rawDate === "" || rawDate === null)) continue;

      Logger.log("  Row " + (r + 1)
        + " | client='" + clientName + "'"
        + " | date raw='" + rawDate + "' (type:" + typeof rawDate + ")"
        + " | parsed=" + (eventDate ? eventDate.toDateString() : "NULL")
        + " | match=" + (eventDate ? isSameDay(eventDate, targetDate) : false));

      if (eventDate && isSameDay(eventDate, targetDate)) {
        Logger.log("    *** DATE MATCH on row " + (r + 1) + " ***");
        for (var i = 0; i < layout.creatives.length; i++) {
          var cre = cleanCell(row[layout.creatives[i].index]);
          if (!cre) { Logger.log("    " + layout.creatives[i].label + ": (empty)"); continue; }
          var em = lookupEmail(emailMap, cre) || "(NOT FOUND IN contractors sheet)";
          Logger.log("    " + layout.creatives[i].label + ": '" + cre + "' → " + em);
        }
      }
    }

    Logger.log("=== DEBUG END ===");
  }

  /**
   * Sends the current email template to whoever authorised this script,
   * so the wording can be proof-read. Touches no booking data.
   */
  function sendTest(overrideRecipient) {
    var to = overrideRecipient || Session.getEffectiveUser().getEmail();
    if (!to) {
      Logger.log("ERROR: could not determine your address. Pass one explicitly: "
        + "BBW_NOTIFY.sendTest('you@bluebelleweddings.com')");
      return;
    }
    MailApp.sendEmail({
      to:       to,
      subject:  "[TEST] " + buildSubject("Anna & Tom"),
      htmlBody: buildEmailBody("Robin", "Anna & Tom")
    });
    Logger.log("Test email sent to " + to);
  }

  // ── Trigger installer ────────────────────────────────────────
  /**
   * Installs the daily trigger, removing any trigger left over from the
   * old un-prefixed function name so the two cannot both fire.
   */
  function installTrigger() {
    var triggers = ScriptApp.getProjectTriggers();
    var existing = false;
    var removed  = 0;

    for (var t = 0; t < triggers.length; t++) {
      var handler = triggers[t].getHandlerFunction();
      if (handler === TRIGGER_HANDLER) { existing = true; continue; }
      for (var l = 0; l < LEGACY_HANDLERS.length; l++) {
        if (handler === LEGACY_HANDLERS[l]) {
          ScriptApp.deleteTrigger(triggers[t]);
          removed++;
          break;
        }
      }
    }

    if (removed) Logger.log("Removed " + removed + " stale trigger(s) for the old function name.");

    if (existing) {
      Logger.log("Trigger already installed for " + TRIGGER_HANDLER + " – nothing to do.");
      return;
    }

    ScriptApp.newTrigger(TRIGGER_HANDLER)
      .timeBased()
      .everyDays(1)
      .atHour(TRIGGER_HOUR)
      .create();

    Logger.log("Daily trigger created: " + TRIGGER_HANDLER + " runs every day at "
      + TRIGGER_HOUR + " AM (" + Session.getScriptTimeZone() + ").");
  }

  // ── Public surface ───────────────────────────────────────────
  return {
    VERSION:        VERSION,
    SIGNATURE:      SIGNATURE,
    run:            run,
    debug:          debug,
    selfCheck:      selfCheck,
    sendTest:       sendTest,
    installTrigger: installTrigger,
    buildSubject:   buildSubject,
    buildEmailBody: buildEmailBody,
    parseEventDate: parseEventDate
  };

})();

// ============================================================
//  Global entry points – the ONLY names this file adds besides
//  BBW_NOTIFY. All prefixed "bbw" so they cannot collide with
//  the other scripts on this spreadsheet. Select these from the
//  function drop-down in the Apps Script editor.
// ============================================================

/** Main job. This is what the daily trigger calls. */
function bbwSendCreativeNotifications() { BBW_NOTIFY.run(false); }

/** Full run with sending disabled – shows who would be emailed today. */
function bbwDryRunNotifications() { BBW_NOTIFY.run(true); }

/** Sheets, columns, parsed dates and every name → email lookup. */
function bbwDebugNotifications() { BBW_NOTIFY.debug(); }

/** Name clashes, effective user, quota, timezones and triggers. */
function bbwSelfCheck() { BBW_NOTIFY.selfCheck.call(this); }

/** Emails the template to whoever authorised the script, for proof-reading. */
function bbwSendTestEmail() { BBW_NOTIFY.sendTest(); }

/** Run ONCE to install the daily 7 AM trigger. */
function bbwInstallDailyTrigger() { BBW_NOTIFY.installTrigger(); }

// Stamp each entry point so bbwSelfCheck() can prove another file in the
// project has not quietly redefined one of these names.
bbwSendCreativeNotifications.bbwSignature = BBW_NOTIFY.SIGNATURE;
bbwDryRunNotifications.bbwSignature       = BBW_NOTIFY.SIGNATURE;
bbwDebugNotifications.bbwSignature        = BBW_NOTIFY.SIGNATURE;
bbwSelfCheck.bbwSignature                 = BBW_NOTIFY.SIGNATURE;
bbwSendTestEmail.bbwSignature             = BBW_NOTIFY.SIGNATURE;
bbwInstallDailyTrigger.bbwSignature       = BBW_NOTIFY.SIGNATURE;

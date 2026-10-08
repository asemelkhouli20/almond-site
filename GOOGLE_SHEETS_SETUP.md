# Almond contact form → Google Sheets

The nine existing forms POST to `/api/contact.php`. PHP forwards to Apps Script and only confirms success when Google returns `{ "ok": true, "saved": true }`. No design, fields, or animations have been changed. JavaScript is required for inline feedback without navigation; without JavaScript, native POST displays JSON at the same-origin endpoint.

## Google setup

1. Create a private Google Sheet. Add a worksheet named **Leads** with these exact headers in row 1:
   `Date | Name | Company | Email | Phone | Project Type | Message`
   The script also creates the worksheet and headers if absent. An existing mismatched header row is rejected rather than overwritten.
2. Copy the spreadsheet ID from its URL (between `/d/` and `/edit`). Keep it out of frontend code.
3. In the Sheet, open **Extensions → Apps Script**. Replace the editor's `Code.gs` with [google-apps-script/Code.gs](google-apps-script/Code.gs). Save.
4. In **Project Settings → Script properties**, add:
   - `SPREADSHEET_ID`: the spreadsheet ID.
   - `CONTACT_RELAY_TOKEN`: a secret generated on the VPS with `openssl rand -hex 32`. Use the same token in PHP-FPM below. Do not commit it.
5. Set the Sheet and Apps Script timezone to **Asia/Riyadh** if you want Saudi local timestamp display. Format column A as date/time.
6. Select **Deploy → New deployment → gear icon → Web app**. Set **Execute as: Me**, and **Who has access: Anyone**. Deploy and authorize spreadsheet access using the account that owns the sheet. Review the requested permissions; only proceed with the script you installed. Workspace policy may prohibit public web apps; ask your administrator if Anyone is unavailable.
7. Copy the deployed URL ending in `/exec`, not `/dev`. Anonymous access is required because the relay does not sign in to Google; the private relay token authenticates writes within the script.

Google documents [web-app deployment](https://developers.google.com/apps-script/guides/web) and the [ContentService redirect](https://developers.google.com/apps-script/guides/content). The server relay follows that redirect and validates the returned JSON; an opaque browser response is never treated as saved.

## VPS setup (only the contact endpoint needs PHP)

Upload the modified HTML files, `contact-form.js`, and `api/contact.php` into the existing website document root. Keep setup documents, tests, and Apps Script source outside the public document root where practical. The rest of the site remains static.

If PHP-FPM/cURL are absent on Ubuntu:

```sh
sudo apt update
sudo apt install php-fpm php-curl
ls /run/php/
```

In your active PHP-FPM pool configuration (typically `/etc/php/8.3/fpm/pool.d/www.conf`; use your installed version), configure these **two server-only values in one place**:

```ini
env[ALMOND_APPS_SCRIPT_URL] = "PASTE_DEPLOYED_EXEC_URL_HERE"
env[ALMOND_CONTACT_RELAY_TOKEN] = "PASTE_THE_SAME_SECRET_HERE"
```

No endpoint URL needs to be added to HTML or JavaScript. Do not place a secrets file under the website root. Ensure the pool configuration is readable only by appropriate system administrators.

Add this exact location inside the existing Nginx `server` block, using its existing document root and your installed socket path:

```nginx
location = /api/contact.php {
    client_max_body_size 32k;
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME $document_root/api/contact.php;
    fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    fastcgi_read_timeout 40s;
}
```

Use this exact location even if the site has a static catch-all. Do not enable arbitrary PHP execution. Confirm that Nginx executes the endpoint rather than serving PHP source. If PHP is already configured, reuse its pool/socket and avoid unnecessary installation or configuration changes.

```sh
sudo php-fpm8.3 -t
sudo systemctl restart php8.3-fpm
sudo nginx -t
sudo systemctl reload nginx
```

Replace `8.3` with the installed version. Retain existing TLS and site settings. Clear any CDN cache of HTML/JavaScript after upload. The PHP response uses `Cache-Control: no-store`.

## Redeploying Apps Script

After edits: save, open **Deploy → Manage deployments → Edit (pencil)**, choose **New version**, then **Deploy**. Updating the existing deployment preserves its `/exec` URL. Creating another deployment requires updating the PHP-FPM URL and restarting PHP-FPM. Script property changes do not require a new code version.

## Verification

Run local checks from the repository root:

```sh
node tests/contact.test.cjs
php -l api/contact.php
node --check contact-form.js
```

Then test the actual deployed site on Arabic and English pages:

- Submit blank fields, an invalid email, too-short details, and invalid phone; errors should appear without sending.
- Submit a valid unique test enquiry; the button should disable and show loading text. Double-clicking must send one request.
- Confirm exactly one new row in Leads with the seven expected columns and timestamp. The inline success message must appear and the form must reset without navigation.
- Use browser developer tools to block `/api/contact.php` or simulate offline mode; verify failure feedback, preserved fields, and restored button.
- Test the honeypot via developer tools; filled values must be rejected and create no row. Empty values should pass.
- Verify mobile layout and animations remain unchanged. DOM validation rejects programmatically overlong values; normal typing is already constrained by existing maxlength attributes.

Do not consider live delivery verified until a real submission is visible in the Google Sheet. No deployment URL or VPS access was supplied for this repository implementation.

## Troubleshooting and limits

- **503 configuration**: missing/invalid `/exec` URL, missing relay token, or missing PHP cURL. Check PHP-FPM environment and restart the correct pool.
- **502 upstream/upstream_rejected**: deployment is not public, token mismatch, script needs authorization, incorrect spreadsheet ID, mismatched headers, lock timeout, or Google quota/outage. Check Apps Script Executions and properties; redeploy changed code.
- **422**: required fields, email/phone format, length limits, or honeypot failed. All six fields are required. Name/company are 2–180 UTF-16 units, email 1–180, phone 7–40, message 15–4000; project type has a defensive 180-unit server bound.
- **404/PHP source download**: incorrect document root, missing upload, or missing exact PHP location. Fix Nginx routing before accepting submissions.
- **Timeout/network failure**: fields remain populated because delivery cannot be confirmed. A row may already have been written when the response was lost; manual retry can create a duplicate. Double-click prevention covers concurrent browser submits, not retries after an uncertain outcome.
- Honeypot filtering is basic spam protection. The public relay is not a comprehensive anti-abuse system. No Google credentials or spreadsheet identifiers are sent to the browser.
- Existing Arabic/English messaging and layout-event behavior are preserved. There is no redirect during the JavaScript submission flow.

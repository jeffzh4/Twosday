# Google Calendar Overlay Setup

Twosday can display selected Google calendars as read-only busy blocks. It does not import those events, write to Google Calendar, store Google access tokens, or save external event details in Firestore or local storage.

## One-Time Google Cloud Setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select the `jhschedule4` project.
2. Go to **APIs & Services → Library**, search for **Google Calendar API**, and enable it.
3. Go to **APIs & Services → OAuth consent screen**. Configure the app as **External** or **Internal** as appropriate, add your own Google account as a test user while the app is in testing, and add the `calendar.readonly` scope.
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**. Choose **Web application**.
5. Add JavaScript origins:
   - `https://twosday.dev`
   - `https://www.twosday.dev`
   - `http://localhost:8001` for local development
6. Copy the client ID ending in `.apps.googleusercontent.com` into `TWOSDAY_GOOGLE_CALENDAR_CLIENT_ID` in `js/config.js`, then deploy normally.

Do not add an OAuth client secret to Twosday. Browser applications use only the public client ID.

## Using the Overlay

1. Open **Account settings → Google Calendar overlay**.
2. Select **Connect Google Calendar** and approve access.
3. Choose the calendars to display and save the selection.
4. Twosday shows them as blue, dashed, non-editable busy blocks. Google event names, descriptions, locations, attendees, and colors are intentionally not displayed.

Access tokens exist only in the current browser session. Twosday tries to reconnect silently after reload when Google permits it; otherwise choose **Reconnect Google Calendar**. Removing all selected calendars stops the overlay immediately.

## Verification

Run `npm run test:google` for privacy-preserving event normalization checks and `npm run test:browser` for the mocked browser workflow smoke test. Neither uses a Google account or production Firebase data.

const fs = require('fs');

const events = fs.readFileSync('js/events.js', 'utf8');
const dayWeek = fs.readFileSync('js/views/day-week.js', 'utf8');
const css = fs.readFileSync('css/style.css', 'utf8');
const settings = fs.readFileSync('js/settings.js', 'utf8');
const state = fs.readFileSync('js/state.js', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const googleCalendar = fs.readFileSync('js/google-calendar.js', 'utf8');
const mobile = fs.readFileSync('js/mobile.js', 'utf8');
const reminders = fs.readFileSync('js/reminders.js', 'utf8');
const diagnostics = fs.readFileSync('js/diagnostics.js', 'utf8');
const modal = fs.readFileSync('js/modal.js', 'utf8');
const audit = fs.readFileSync('js/audit.js', 'utf8');
const auth = fs.readFileSync('js/auth.js', 'utf8');
const vercel = fs.readFileSync('vercel.json', 'utf8');
const browserSources = fs.readdirSync('js').filter(file => file.endsWith('.js')).map(file => fs.readFileSync(`js/${file}`, 'utf8')).join('\n');

const onDragEnd = events.slice(events.indexOf('function onDragEnd()'), events.indexOf('\n}', events.indexOf('function onDragEnd()')) + 2);
if (!/if \(didMove\) render\(\)/.test(onDragEnd)) {
  throw new Error('event click regression: onDragEnd must render only after pointer movement');
}

const doneAction = dayWeek.slice(dayWeek.indexOf("if (action === 'done')"), dayWeek.indexOf('\n      }', dayWeek.indexOf("if (action === 'done')")) + 8);
if (/toggleDone[\s\S]*render\(\)/.test(doneAction)) {
  throw new Error('event click regression: done action must refresh event in place');
}

if (!/\.month-body \{[\s\S]*grid-auto-rows: minmax\(110px, 1fr\)/.test(css)) {
  throw new Error('month layout regression: month rows must use stable grid tracks');
}

const eventGlass = css.slice(css.indexOf('.glass-events .ev,'), css.indexOf('.glass-events .month-ev-pill { position: relative; }'));
if (/backdrop-filter/.test(eventGlass)) {
  throw new Error('event flicker regression: event cards must not blur animated backdrops');
}

if (/s-density|data-density="compact"/.test(settings + css)) {
  throw new Error('density regression: unsupported compact controls or geometry must stay removed');
}
if (!/setAttribute\('data-density', 'comfortable'\)/.test(state)) {
  throw new Error('density regression: legacy compact values must render at stable comfortable geometry');
}

if (!/bg\.appendChild\(popover\)/.test(settings) || !/hidden aria-hidden="true"/.test(settings)) {
  throw new Error('emoji picker regression: popover must escape scroll clipping and stay hidden when closed');
}
if (!/role="listbox"/.test(settings) || !/setAttribute\('role', 'option'\)/.test(settings)) {
  throw new Error('emoji picker regression: listbox and option semantics must stay intact');
}

const localScripts = Array.from(index.matchAll(/<script src="(js\/[^"]+)/g), match => '/' + match[1].split('?')[0]);
localScripts.forEach(script => {
  if (!serviceWorker.includes(`'${script}'`)) {
    throw new Error(`offline shell regression: ${script} is missing from service worker assets`);
  }
});

if (!/let googleCalendarEvents = \{\}/.test(googleCalendar) || /buildPayload:[\s\S]*googleCalendarEvents/.test(state)) {
  throw new Error('Google Calendar privacy regression: external event data must remain memory-only');
}
if (!/external: true/.test(googleCalendar) || /summary/.test(googleCalendar.slice(googleCalendar.indexOf('function normalizeGoogleCalendarEvent'), googleCalendar.indexOf('function getGoogleOverlayRange')))) {
  throw new Error('Google Calendar privacy regression: overlay records must be marked external and omit event titles');
}
if (!/external-event/.test(dayWeek) || !/event\.stopPropagation\(\)/.test(dayWeek.slice(dayWeek.indexOf('function buildExternalEventEl'), dayWeek.indexOf('function buildEventEl')))) {
  throw new Error('Google Calendar immutability regression: external blocks must not enter event editing flows');
}

if (!/touchstart/.test(dayWeek) || !/touchend/.test(dayWeek) || !/Math\.abs\(dx\) < 72/.test(dayWeek)) {
  throw new Error('mobile navigation regression: day agenda must retain guarded swipe navigation');
}
if (!/mobile-event-reschedule/.test(modal) || !/quickReschedule/.test(modal)) {
  throw new Error('mobile reschedule regression: event editor must retain fast rescheduling actions');
}
if (!/Notification\.permission/.test(reminders) || !/event\.reminderMinutes/.test(reminders)) {
  throw new Error('reminder regression: browser-open reminders must remain opt-in and event-scoped');
}
if (/JSON\.stringify\(allData\)|currentAccount|location\.search|error\.stack|error\.message/.test(diagnostics)) {
  throw new Error('diagnostics privacy regression: browser diagnostics must not collect calendar data, account data, query strings, stacks, or provider messages');
}
if (!/AUTH_IDLE_TIMEOUT_MS = 30 \* 60 \* 1000/.test(auth) || !/startIdleSessionGuard/.test(auth) || !/sessionIsIdleExpired/.test(auth)) {
  throw new Error('session regression: authenticated sessions must retain the idle-expiry guard');
}
if (!/requireSignupAttestation/.test(auth) || !/firebase\.appCheck\(\)\.getToken\(false\)/.test(auth)) {
  throw new Error('signup protection regression: production signup must require an App Check token');
}
if (!/if \(!e\.isTrusted\) return;/.test(auth)) {
  throw new Error('auth interaction regression: login and signup handlers must reject synthetic submissions');
}
if (!/form-action 'self'/.test(vercel) || !/frame-ancestors 'none'/.test(vercel) || /<form[^>]+action=/.test(index)) {
  throw new Error('CSRF posture regression: forms must remain same-origin and no cookie-authenticated form endpoint may be introduced');
}
if (/console\.warn\([^)]*,\s*(?:err|error|e)\b/.test(browserSources) || /(?:setError|setMsg)\([^\n]*\.(?:message|stack)\b/.test(browserSources)) {
  throw new Error('logging regression: browser logs and user-facing errors must not expose raw provider details');
}
if (!/undo latest local change/.test(audit)) {
  throw new Error('recovery regression: change history must expose the latest local undo action');
}

console.log('ui regression guards passed');

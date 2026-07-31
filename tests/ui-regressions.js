const fs = require('fs');

const events = fs.readFileSync('js/events.js', 'utf8');
const dayWeek = fs.readFileSync('js/views/day-week.js', 'utf8');
const css = fs.readFileSync('css/style.css', 'utf8');
const settings = fs.readFileSync('js/settings.js', 'utf8');
const state = fs.readFileSync('js/state.js', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const googleCalendar = fs.readFileSync('js/google-calendar.js', 'utf8');

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

console.log('ui regression guards passed');

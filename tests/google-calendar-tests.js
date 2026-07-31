const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = {
  console,
  URLSearchParams,
  Date,
  currentAccount: { googleCalendar: { calendarIds: ['primary'] } },
  TWOSDAY_GOOGLE_CALENDAR_CLIENT_ID: '',
  getDateKey: date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'),
  window: {}, document: {},
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/google-calendar.js', 'utf8'), context);

const timed = context.normalizeGoogleCalendarEvent({
  id: 'timed', start: { dateTime: '2026-07-21T09:30:00' }, end: { dateTime: '2026-07-21T10:45:00' }, summary: 'private title',
}, 'primary');
assert.deepStrictEqual(JSON.parse(JSON.stringify(timed)), {
  id: 'google:primary:timed', calendarId: 'primary', dateKey: '2026-07-21', start: 9.5, end: 10.75, allDay: false, external: true,
});
assert.ok(!Object.hasOwn(timed, 'text'), 'Google event titles must never enter the overlay model');

const allDay = context.normalizeGoogleCalendarEvent({ id: 'all-day', start: { date: '2026-07-22' }, end: { date: '2026-07-23' } }, 'work');
assert.strictEqual(allDay.start, 0);
assert.strictEqual(allDay.end, 24);
assert.strictEqual(allDay.allDay, true);
assert.strictEqual(context.normalizeGoogleCalendarEvent({ id: 'skip', transparency: 'transparent', start: { date: '2026-07-22' }, end: { date: '2026-07-23' } }, 'work'), null);
const multiDay = context.expandGoogleCalendarEvent({ id: 'trip', start: { date: '2026-07-22' }, end: { date: '2026-07-24' } }, 'work');
assert.deepStrictEqual(Array.from(multiDay, event => event.dateKey), ['2026-07-22', '2026-07-23']);
assert.deepStrictEqual(Array.from(multiDay, event => [event.start, event.end]), [[0, 24], [0, 24]]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.googleCalendarSettings())), { calendarIds: ['primary'] });
console.log('Google Calendar overlay tests passed');

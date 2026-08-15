// Read-only Google Calendar overlay. OAuth tokens and fetched events are kept
// in memory only; Firestore stores selected calendar IDs, never Google data.
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

let googleCalendarToken = null;
let googleCalendarClient = null;
let googleCalendarEvents = {};
let googleCalendarList = [];
let googleCalendarLoad = null;
let googleCalendarStatus = 'disconnected';

function googleCalendarSettings() {
  const settings = currentAccount && currentAccount.googleCalendar;
  return settings && Array.isArray(settings.calendarIds) ? settings : { calendarIds: [] };
}

function getGoogleCalendarEvents(dateKey) {
  return googleCalendarEvents[dateKey] || [];
}

function googleCalendarConfigured() {
  return typeof TWOSDAY_GOOGLE_CALENDAR_CLIENT_ID === 'string' &&
    TWOSDAY_GOOGLE_CALENDAR_CLIENT_ID.endsWith('.apps.googleusercontent.com');
}

function loadGoogleIdentityServices() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  if (googleCalendarLoad) return googleCalendarLoad;
  googleCalendarLoad = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Google identity services could not load'));
    document.head.appendChild(script);
  });
  return googleCalendarLoad;
}

function updateGoogleCalendarStatus(status, message = '') {
  googleCalendarStatus = status;
  const el = document.getElementById('s-google-calendar-msg');
  if (el) {
    el.textContent = message;
    el.className = 'settings-msg ' + (status === 'error' ? 'settings-msg-error' : message ? 'settings-msg-ok' : '');
  }
  const button = document.getElementById('s-google-calendar-connect');
  if (button) button.textContent = status === 'connected' ? 'reconnect Google Calendar' : 'connect Google Calendar';
}

function requestGoogleCalendarToken(prompt) {
  return new Promise((resolve, reject) => {
    googleCalendarClient.callback = response => {
      if (response && response.access_token) {
        googleCalendarToken = response.access_token;
        updateGoogleCalendarStatus('connected', 'Google Calendar connected for this session');
        resolve(response.access_token);
      } else {
        reject(new Error(response && response.error_description || response && response.error || 'Google Calendar access was not granted'));
      }
    };
    googleCalendarClient.requestAccessToken({ prompt });
  });
}

async function connectGoogleCalendar(interactive = true) {
  if (!googleCalendarConfigured()) {
    updateGoogleCalendarStatus('error', 'Google Calendar needs its OAuth client ID configured first');
    return false;
  }
  try {
    updateGoogleCalendarStatus('pending', interactive ? 'requesting Google Calendar access...' : 'reconnecting to Google Calendar...');
    await loadGoogleIdentityServices();
    googleCalendarClient = google.accounts.oauth2.initTokenClient({
      client_id: TWOSDAY_GOOGLE_CALENDAR_CLIENT_ID,
      scope: GOOGLE_CALENDAR_SCOPE,
      callback: () => {},
    });
    await requestGoogleCalendarToken(interactive ? 'consent' : '');
    await loadGoogleCalendarList();
    await refreshGoogleCalendarOverlay(true);
    return true;
  } catch (error) {
    googleCalendarToken = null;
    updateGoogleCalendarStatus(interactive ? 'error' : 'disconnected', interactive
      ? 'Google Calendar connection failed. Please reconnect.'
      : 'Google Calendar needs reconnecting');
    return false;
  }
}

async function googleCalendarFetch(path, params = {}) {
  if (!googleCalendarToken) throw new Error('Google Calendar is not connected');
  const query = new URLSearchParams(params);
  const response = await fetch(`${GOOGLE_CALENDAR_API}${path}?${query}`, {
    headers: { Authorization: `Bearer ${googleCalendarToken}` },
  });
  if (response.status === 401) {
    googleCalendarToken = null;
    updateGoogleCalendarStatus('disconnected', 'Google Calendar needs reconnecting');
    throw new Error('Google Calendar access expired');
  }
  if (!response.ok) throw new Error(`Google Calendar request failed (${response.status})`);
  return response.json();
}

async function loadGoogleCalendarList() {
  const data = await googleCalendarFetch('/users/me/calendarList', { minAccessRole: 'reader' });
  googleCalendarList = (data.items || []).map(item => ({ id: item.id, summary: item.summary || 'Untitled calendar', primary: !!item.primary }));
  renderGoogleCalendarPicker();
  return googleCalendarList;
}

function normalizeGoogleCalendarEvent(raw, calendarId) {
  const startValue = raw.start && (raw.start.dateTime || raw.start.date);
  const endValue = raw.end && (raw.end.dateTime || raw.end.date);
  if (!startValue || !endValue || raw.status === 'cancelled' || raw.transparency === 'transparent') return null;
  const isAllDay = !!(raw.start && raw.start.date);
  const startDate = new Date(startValue);
  const endDate = new Date(endValue);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const dateKey = isAllDay ? raw.start.date : getDateKey(startDate);
  const start = isAllDay ? 0 : startDate.getHours() + startDate.getMinutes() / 60;
  const end = isAllDay ? 24 : endDate.getHours() + endDate.getMinutes() / 60;
  if (end <= start && !isAllDay) return null;
  return {
    id: `google:${calendarId}:${raw.id}`,
    calendarId,
    dateKey,
    start,
    end,
    allDay: isAllDay,
    external: true,
  };
}

// Calendar API all-day ends are exclusive; timed events can also cross midnight.
// Expand them into per-day busy segments so every affected calendar view is true.
function expandGoogleCalendarEvent(raw, calendarId) {
  const base = normalizeGoogleCalendarEvent(raw, calendarId);
  if (!base) return [];
  const startValue = raw.start.dateTime || raw.start.date;
  const endValue = raw.end.dateTime || raw.end.date;
  const startDate = new Date(raw.start.date ? `${startValue}T00:00:00` : startValue);
  const endDate = new Date(raw.end.date ? `${endValue}T00:00:00` : endValue);
  const segments = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const lastDay = new Date(endDay);
  if (endDate.getHours() === 0 && endDate.getMinutes() === 0 && endDate.getSeconds() === 0) lastDay.setDate(lastDay.getDate() - 1);
  while (cursor <= lastDay) {
    const dateKey = getDateKey(cursor);
    const isFirst = dateKey === getDateKey(startDate);
    const isLast = dateKey === getDateKey(lastDay);
    segments.push({
      ...base,
      id: dateKey === base.dateKey ? base.id : `${base.id}:${dateKey}`,
      dateKey,
      start: base.allDay || !isFirst ? 0 : base.start,
      end: base.allDay || !isLast ? 24 : (endDate.getHours() + endDate.getMinutes() / 60 || 24),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return segments;
}

function getGoogleOverlayRange() {
  if (viewMode === 'day') return [new Date(currentDate), new Date(currentDate)];
  if (viewMode === 'week') {
    const dates = getWeekDates(currentDate);
    return [dates[0], dates[dates.length - 1]];
  }
  if (viewMode === 'month') {
    const weeks = getMonthGrid(currentDate.getFullYear(), currentDate.getMonth());
    return [weeks[0][0], weeks[weeks.length - 1][6]];
  }
  return [null, null];
}

async function refreshGoogleCalendarOverlay(force = false) {
  const ids = googleCalendarSettings().calendarIds;
  if (!googleCalendarToken || !ids.length) return;
  const [from, to] = getGoogleOverlayRange();
  if (!from || !to) return;
  const cacheKey = `${getDateKey(from)}:${getDateKey(to)}:${ids.join('|')}`;
  if (!force && googleCalendarEvents._range === cacheKey) return;
  try {
    const timeMin = new Date(from.getFullYear(), from.getMonth(), from.getDate()).toISOString();
    const timeMax = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).toISOString();
    const results = await Promise.all(ids.map(async calendarId => {
      const data = await googleCalendarFetch(`/calendars/${encodeURIComponent(calendarId)}/events`, {
        timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
      });
      return (data.items || []).flatMap(item => expandGoogleCalendarEvent(item, calendarId));
    }));
    const next = { _range: cacheKey };
    const seen = new Set();
    results.flat().forEach(event => {
      if (seen.has(event.id)) return;
      seen.add(event.id);
      (next[event.dateKey] ||= []).push(event);
    });
    Object.keys(next).forEach(key => { if (Array.isArray(next[key])) next[key].sort((a, b) => a.start - b.start); });
    googleCalendarEvents = next;
    if (typeof render === 'function') render();
  } catch (error) {
    reportOperationalIssue('google-overlay-refresh', error);
  }
}

async function saveGoogleCalendarSelection() {
  const ids = Array.from(document.querySelectorAll('input[name="google-calendar-id"]:checked')).map(input => input.value);
  const updated = { ...currentAccount, googleCalendar: { calendarIds: ids } };
  delete updated.username;
  await saveAccountRecord(currentAccount.username, updated);
  currentAccount = { ...currentAccount, googleCalendar: { calendarIds: ids } };
  googleCalendarEvents = {};
  await refreshGoogleCalendarOverlay(true);
  updateGoogleCalendarStatus(googleCalendarToken ? 'connected' : 'disconnected', ids.length ? 'selected calendars saved' : 'no calendars selected');
}

function renderGoogleCalendarPicker() {
  const target = document.getElementById('s-google-calendar-picker');
  if (!target) return;
  const selected = new Set(googleCalendarSettings().calendarIds);
  target.innerHTML = googleCalendarList.length
    ? googleCalendarList.map(calendar => `<label class="google-calendar-choice"><input type="checkbox" name="google-calendar-id" value="${escHtml(calendar.id)}" ${selected.has(calendar.id) ? 'checked' : ''}><span>${escHtml(calendar.summary)}${calendar.primary ? ' (primary)' : ''}</span></label>`).join('') + '<button class="mbtn mbtn-save" type="button" id="s-google-calendar-save">save selected calendars</button>'
    : '';
  const saveButton = document.getElementById('s-google-calendar-save');
  if (saveButton) saveButton.onclick = () => saveGoogleCalendarSelection().catch(() => updateGoogleCalendarStatus('error', 'could not save calendar selection'));
}

function setupGoogleCalendarSettings() {
  const connectButton = document.getElementById('s-google-calendar-connect');
  if (!connectButton) return;
  const selectedCount = googleCalendarSettings().calendarIds.length;
  updateGoogleCalendarStatus(googleCalendarConfigured() ? 'disconnected' : 'error', selectedCount ? 'saved calendars will reconnect when Google allows it' : 'connect to choose calendars');
  connectButton.onclick = () => connectGoogleCalendar(true);
  if (googleCalendarList.length) renderGoogleCalendarPicker();
}

function restoreGoogleCalendarOverlay() {
  if (!googleCalendarConfigured() || !googleCalendarSettings().calendarIds.length) return;
  connectGoogleCalendar(false);
}

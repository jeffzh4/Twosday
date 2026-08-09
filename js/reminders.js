// Browser reminders are an optional convenience while Twosday stays open.
// They do not claim to be a push-notification or background delivery service.
const reminderTimers = new Map();

function reminderKey(dateKey, event) {
  return `${dateKey}:${event.id}:${event.updatedAt || 0}:${event.reminderMinutes || 0}`;
}

function eventReminderAt(dateKey, event) {
  const date = parseDateKey(dateKey);
  if (!date) return null;
  date.setHours(Math.floor(event.start), Math.round((event.start % 1) * 60), 0, 0);
  return date.getTime() - event.reminderMinutes * 60 * 1000;
}

function scheduleEventReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const needed = new Set();
  const shared = new Set();
  Object.keys(allData).forEach(dateKey => {
    USERS.forEach(user => {
      getEventsForDate(dateKey, user).forEach(event => {
        if (!event.reminderMinutes || event.done) return;
        if (event.shared && event.sharedId) {
          if (shared.has(event.sharedId)) return;
          shared.add(event.sharedId);
        }
        const at = eventReminderAt(dateKey, event);
        const delay = at - Date.now();
        if (delay <= 0 || delay > 2147483647) return;
        const key = reminderKey(dateKey, event);
        needed.add(key);
        if (!reminderTimers.has(key)) {
          reminderTimers.set(key, window.setTimeout(() => {
            reminderTimers.delete(key);
            new Notification(event.text, { body: `Starts in ${event.reminderMinutes} minutes.` });
          }, delay));
        }
      });
    });
  });
  reminderTimers.forEach((timer, key) => {
    if (needed.has(key)) return;
    window.clearTimeout(timer);
    reminderTimers.delete(key);
  });
}

async function requestReminderPermission() {
  if (!('Notification' in window)) {
    showToast('browser reminders are unavailable here');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    showToast('enable notifications in browser settings to use reminders');
    return false;
  }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    showToast('browser reminders enabled', 'info');
    scheduleEventReminders();
    return true;
  }
  showToast('reminders were not enabled');
  return false;
}

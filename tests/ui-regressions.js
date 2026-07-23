const fs = require('fs');

const events = fs.readFileSync('js/events.js', 'utf8');
const dayWeek = fs.readFileSync('js/views/day-week.js', 'utf8');

const onDragEnd = events.slice(events.indexOf('function onDragEnd()'), events.indexOf('\n}', events.indexOf('function onDragEnd()')) + 2);
if (!/if \(didMove\) render\(\)/.test(onDragEnd)) {
  throw new Error('event click regression: onDragEnd must render only after pointer movement');
}

const doneAction = dayWeek.slice(dayWeek.indexOf("if (action === 'done')"), dayWeek.indexOf('\n      }', dayWeek.indexOf("if (action === 'done')")) + 8);
if (/toggleDone[\s\S]*render\(\)/.test(doneAction)) {
  throw new Error('event click regression: done action must refresh event in place');
}

console.log('ui regression guards passed');

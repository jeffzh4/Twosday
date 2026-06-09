// Demo account seed data
const DEMO_SEED_USERNAME = 'testing';
const DEMO_SEED_YEAR = 2026;

const DEMO_SEED_EVENTS = [
  // January
  { date: '2026-01-06', user: 0, text: 'resume review sprint', start: 10, end: 11.5, color: 'blue' },
  { date: '2026-01-08', user: 1, text: 'bio lab prep', start: 14, end: 16, color: 'violet' },
  { date: '2026-01-12', user: 0, text: 'work meeting: roadmap', start: 9, end: 10, shared: true, color: 'blue' },
  { date: '2026-01-17', user: 1, text: 'coffee with mentor', start: 11, end: 12, color: 'orange' },
  { date: '2026-01-24', user: 0, text: 'winter project deep work', start: 13, end: 16, color: 'blue' },

  // February
  { date: '2026-02-02', user: 0, text: 'math lecture', start: 10, end: 11.25, color: 'violet' },
  { date: '2026-02-05', user: 1, text: 'interview prep', start: 15, end: 16.5, color: 'blue' },
  { date: '2026-02-14', user: 0, text: 'valentine dinner reservation', start: 19, end: 21, shared: true, color: 'red' },
  { date: '2026-02-20', user: 1, text: 'study group', start: 13, end: 15, color: 'violet' },
  { date: '2026-02-27', user: 0, text: 'portfolio polish', start: 9.5, end: 12, color: 'blue' },

  // March
  { date: '2026-03-03', user: 1, text: 'chem lab', start: 9, end: 12, color: 'violet' },
  { date: '2026-03-07', user: 0, text: 'brunch and errands', start: 10.5, end: 13, shared: true, color: 'green' },
  { date: '2026-03-16', user: 0, text: 'spring planning session', start: 17, end: 18, shared: true, color: 'indigo' },
  { date: '2026-03-21', user: 1, text: 'birthday party', start: 20, end: 23, color: 'orange' },
  { date: '2026-03-30', user: 0, text: 'office hours', start: 14, end: 15, color: 'violet' },

  // April
  { date: '2026-04-04', user: 0, text: 'hackathon build block', start: 10, end: 15, color: 'blue' },
  { date: '2026-04-09', user: 1, text: 'statistics exam review', start: 18, end: 20, color: 'violet' },
  { date: '2026-04-15', user: 0, text: 'taxes and budget review', start: 19, end: 20.5, shared: true, color: 'yellow' },
  { date: '2026-04-22', user: 1, text: 'earth day picnic', start: 12, end: 14, shared: true, color: 'green' },
  { date: '2026-04-28', user: 0, text: 'recruiter coffee chat', start: 8.5, end: 9.5, color: 'blue' },

  // May
  { date: '2026-05-02', user: 1, text: 'final project lab', start: 13, end: 17, color: 'violet' },
  { date: '2026-05-10', user: 0, text: 'mother day call', start: 16, end: 17, shared: true, color: 'orange' },
  { date: '2026-05-15', user: 0, text: 'work demo rehearsal', start: 11, end: 12.5, color: 'blue' },
  { date: '2026-05-21', user: 1, text: 'dinner with friends', start: 18.5, end: 21, color: 'green' },
  { date: '2026-05-29', user: 0, text: 'long weekend packing', start: 19, end: 20.5, shared: true, color: 'orange' },

  // June
  { date: '2026-06-03', user: 0, text: 'portfolio analytics pass', start: 9, end: 11, color: 'blue' },
  { date: '2026-06-09', user: 1, text: 'summer class lecture', start: 10, end: 12, color: 'violet' },
  { date: '2026-06-13', user: 0, text: 'farmers market lunch', start: 11, end: 13, shared: true, color: 'green' },
  { date: '2026-06-18', user: 1, text: 'internship kickoff', start: 9, end: 10.5, color: 'blue' },
  { date: '2026-06-26', user: 0, text: 'movie night', start: 20, end: 22.5, shared: true, color: 'orange' },

  // July
  { date: '2026-07-04', user: 0, text: 'bbq and fireworks', start: 17, end: 22, shared: true, color: 'red' },
  { date: '2026-07-08', user: 1, text: 'meal prep', start: 18, end: 20, color: 'green' },
  { date: '2026-07-14', user: 0, text: 'midyear goals review', start: 12, end: 13, shared: true, color: 'indigo' },
  { date: '2026-07-19', user: 1, text: 'hike with friends', start: 8, end: 13, color: 'orange' },
  { date: '2026-07-27', user: 0, text: 'work sprint planning', start: 9.5, end: 11, color: 'blue' },

  // August
  { date: '2026-08-03', user: 1, text: 'resume refresh', start: 14, end: 15.5, color: 'blue' },
  { date: '2026-08-08', user: 0, text: 'beach day', start: 10, end: 16, shared: true, color: 'orange' },
  { date: '2026-08-17', user: 0, text: 'systems design study', start: 19, end: 21, color: 'violet' },
  { date: '2026-08-23', user: 1, text: 'family dinner', start: 18, end: 20, color: 'green' },
  { date: '2026-08-31', user: 0, text: 'fall calendar planning', start: 20, end: 21, shared: true, color: 'indigo' },

  // September
  { date: '2026-09-02', user: 1, text: 'first lecture', start: 9, end: 10.5, color: 'violet' },
  { date: '2026-09-10', user: 0, text: 'career fair prep', start: 16, end: 18, color: 'blue' },
  { date: '2026-09-15', user: 1, text: 'club social', start: 19, end: 21, color: 'orange' },
  { date: '2026-09-21', user: 0, text: 'project milestone review', start: 10, end: 11, shared: true, color: 'blue' },
  { date: '2026-09-30', user: 1, text: 'midterm study block', start: 18, end: 21, color: 'violet' },

  // October
  { date: '2026-10-03', user: 0, text: 'apple picking', start: 11, end: 15, shared: true, color: 'orange' },
  { date: '2026-10-08', user: 1, text: 'physics lab', start: 13, end: 16, color: 'violet' },
  { date: '2026-10-16', user: 0, text: 'technical interview loop', start: 9, end: 12, color: 'blue' },
  { date: '2026-10-24', user: 1, text: 'costume party', start: 21, end: 23.5, color: 'orange' },
  { date: '2026-10-29', user: 0, text: 'dinner reservation', start: 18.5, end: 20, shared: true, color: 'green' },

  // November
  { date: '2026-11-04', user: 0, text: 'work presentation', start: 10, end: 11.5, color: 'blue' },
  { date: '2026-11-09', user: 1, text: 'class registration', start: 8.5, end: 9.5, color: 'violet' },
  { date: '2026-11-15', user: 0, text: 'thanksgiving travel planning', start: 17, end: 18, shared: true, color: 'yellow' },
  { date: '2026-11-26', user: 1, text: 'thanksgiving dinner', start: 15, end: 20, shared: true, color: 'green' },
  { date: '2026-11-30', user: 0, text: 'finals study plan', start: 19, end: 20, color: 'violet' },

  // December
  { date: '2026-12-04', user: 1, text: 'final lab report', start: 13, end: 16, color: 'violet' },
  { date: '2026-12-09', user: 0, text: 'year-end work review', start: 11, end: 12, color: 'blue' },
  { date: '2026-12-14', user: 1, text: 'holiday shopping', start: 18, end: 20, shared: true, color: 'orange' },
  { date: '2026-12-20', user: 0, text: 'friendsmas dinner', start: 18, end: 22, shared: true, color: 'green' },
  { date: '2026-12-31', user: 0, text: 'new year countdown', start: 21, end: 24, shared: true, color: 'indigo' },
];

const DEMO_WEEKLY_PATTERNS = [
  { from: '2026-01-12', to: '2026-05-08', weekdays: [1, 3], user: 0, text: 'math lecture', start: 10, end: 11.25, color: 'violet' },
  { from: '2026-01-13', to: '2026-05-07', weekdays: [2, 4], user: 1, text: 'bio lab section', start: 14, end: 15.5, color: 'violet' },
  { from: '2026-06-15', to: '2026-08-14', weekdays: [1, 3, 5], user: 0, text: 'internship work block', start: 9, end: 12, color: 'blue' },
  { from: '2026-09-01', to: '2026-12-11', weekdays: [2, 4], user: 1, text: 'systems class', start: 11, end: 12.5, color: 'violet' },
  { from: '2026-09-07', to: '2026-12-11', weekdays: [1], user: 0, text: 'career prep block', start: 16, end: 17.5, color: 'blue' },
  { from: '2026-01-09', to: '2026-12-18', weekdays: [5], user: 0, text: 'friday dinner check-in', start: 18.5, end: 20, shared: true, color: 'green' },
];

function getDemoSeedDefinitions() {
  const defs = [...DEMO_SEED_EVENTS];
  DEMO_WEEKLY_PATTERNS.forEach(pattern => {
    const cur = parseDateKey(pattern.from);
    const end = parseDateKey(pattern.to);
    while (cur <= end) {
      if (pattern.weekdays.includes(cur.getDay())) {
        defs.push({
          date: getDateKey(cur),
          user: pattern.user,
          text: pattern.text,
          start: pattern.start,
          end: pattern.end,
          shared: pattern.shared,
          color: pattern.color,
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
  });
  return defs;
}

function demoSeedId(def, idx, mirror) {
  return `demo_${DEMO_SEED_YEAR}_${idx}_${mirror ? 'b' : 'a'}`;
}

function demoSeedSharedId(idx) {
  return `demo_shared_${DEMO_SEED_YEAR}_${idx}`;
}

function hasDemoSeedEvent(id) {
  return Object.keys(allData).some(dateKey =>
    USERS.some(user => getEventsForDate(dateKey, user).some(ev => ev.id === id))
  );
}

function applyTestingDemoSeed() {
  if (!currentAccount || currentAccount.username !== DEMO_SEED_USERNAME || USERS.length < 2) return false;

  let changed = false;
  const seedUpdatedAt = new Date(`${DEMO_SEED_YEAR}-01-01T12:00:00`).getTime();

  getDemoSeedDefinitions().forEach((def, idx) => {
    const primaryUser = USERS[def.user] || USERS[0];
    const id = demoSeedId(def, idx, false);
    if (hasDemoSeedEvent(id)) return;

    const sharedId = def.shared ? demoSeedSharedId(idx) : null;
    const ev = normalizeEvent({
      id,
      text: def.text,
      start: def.start,
      end: def.end,
      done: idx % 5 === 0 && parseDateKey(def.date) < new Date(),
      shared: !!def.shared,
      sharedId,
      color: def.color || null,
      updatedAt: seedUpdatedAt + idx * 60000,
      updatedBy: 'demo seed',
    });

    ensureDateUser(def.date, primaryUser);
    allData[def.date][primaryUser].push(ev);
    sortDateUser(def.date, primaryUser);

    if (def.shared) {
      const mirrorUser = getOtherUser(primaryUser);
      const mirror = {
        ...clone(ev),
        id: demoSeedId(def, idx, true),
        shared: true,
        sharedId,
      };
      ensureDateUser(def.date, mirrorUser);
      allData[def.date][mirrorUser].push(mirror);
      sortDateUser(def.date, mirrorUser);
    }

    changed = true;
  });

  return changed;
}

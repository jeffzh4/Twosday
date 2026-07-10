// Demo account seed data
const DEMO_SEED_USERNAME = 'testing';
const DEMO_SEED_YEAR = 2026;

// One-off events — hand-picked across the year for variety and color coverage.
// `user`: 0 = alex, 1 = jamie. `shared: true` mirrors onto both profiles.
const DEMO_SEED_EVENTS = [
  // ═══ January ═══
  { date: '2026-01-01', user: 0, text: "New Year's Day brunch 🥂", start: 11, end: 13, shared: true, color: 'orange' },
  { date: '2026-01-02', user: 1, text: 'take down holiday decorations', start: 14, end: 15.5, color: 'yellow' },
  { date: '2026-01-05', user: 0, text: 'back-to-work planning session', start: 9, end: 10, color: 'blue' },
  { date: '2026-01-06', user: 0, text: 'resume review sprint', start: 10, end: 11.5, color: 'blue' },
  { date: '2026-01-07', user: 1, text: 'new semester syllabus review', start: 15, end: 16.5, color: 'violet' },
  { date: '2026-01-08', user: 1, text: 'bio lab prep', start: 14, end: 16, color: 'violet' },
  { date: '2026-01-09', user: 0, text: 'flight to Tahoe ✈️🏔️', start: 6, end: 9, shared: true, color: 'blue' },
  { date: '2026-01-09', user: 0, text: 'ski lodge check-in', start: 15, end: 16, shared: true, color: 'blue' },
  { date: '2026-01-10', user: 0, text: 'ski day — Tahoe ⛷️', start: 9, end: 16, shared: true, color: 'green' },
  { date: '2026-01-11', user: 0, text: 'hot tub + fireside dinner', start: 18, end: 21, shared: true, color: 'red' },
  { date: '2026-01-12', user: 0, text: 'flight home from Tahoe', start: 13, end: 16, shared: true, color: 'blue' },
  { date: '2026-01-14', user: 1, text: 'dentist checkup', start: 10, end: 11, color: 'red' },
  { date: '2026-01-16', user: 0, text: 'happy hour with the team 🍻', start: 17.5, end: 19.5, color: 'yellow' },
  { date: '2026-01-17', user: 1, text: 'coffee with mentor', start: 11, end: 12, color: 'orange' },
  { date: '2026-01-18', user: 0, text: 'board game night @ home 🎲', start: 19, end: 22, shared: true, color: 'indigo' },
  { date: '2026-01-20', user: 0, text: 'car oil change', start: 9, end: 10, color: 'yellow' },
  { date: '2026-01-22', user: 1, text: 'pottery class 🏺', start: 18, end: 20, color: 'orange' },
  { date: '2026-01-24', user: 0, text: 'winter project deep work', start: 13, end: 16, color: 'blue' },
  { date: '2026-01-25', user: 0, text: "Alex's mom's birthday call 🎂", start: 16, end: 17, shared: true, color: 'orange' },
  { date: '2026-01-27', user: 1, text: 'study group', start: 19, end: 21, color: 'violet' },
  { date: '2026-01-30', user: 0, text: 'ramen night 🍜', start: 19, end: 20.5, shared: true, color: 'green' },
  { date: '2026-01-31', user: 1, text: 'closet declutter', start: 11, end: 13, color: 'yellow' },

  // ═══ February ═══
  { date: '2026-02-02', user: 0, text: 'math lecture make-up', start: 10, end: 11.25, color: 'violet' },
  { date: '2026-02-03', user: 1, text: 'annual physical', start: 9, end: 10, color: 'red' },
  { date: '2026-02-05', user: 1, text: 'interview prep', start: 15, end: 16.5, color: 'blue' },
  { date: '2026-02-06', user: 0, text: 'trivia night @ the pub 🍺', start: 19, end: 21, shared: true, color: 'yellow' },
  { date: '2026-02-08', user: 1, text: 'Super Bowl watch party 🏈', start: 15, end: 20, shared: true, color: 'green' },
  { date: '2026-02-10', user: 0, text: 'sprint retro', start: 14, end: 15, color: 'blue' },
  { date: '2026-02-12', user: 1, text: 'valentine gift shopping 💝', start: 17, end: 18.5, color: 'red' },
  { date: '2026-02-13', user: 0, text: 'galentine\'s brunch', start: 11, end: 13, color: 'orange' },
  { date: '2026-02-14', user: 0, text: 'valentine dinner reservation 💕', start: 19, end: 21, shared: true, color: 'red' },
  { date: '2026-02-16', user: 0, text: 'car inspection renewal', start: 9, end: 10, color: 'yellow' },
  { date: '2026-02-18', user: 1, text: 'rock climbing gym 🧗', start: 18, end: 20, color: 'green' },
  { date: '2026-02-20', user: 1, text: 'study group', start: 13, end: 15, color: 'violet' },
  { date: '2026-02-21', user: 0, text: 'apartment deep clean 🧹', start: 10, end: 13, shared: true, color: 'yellow' },
  { date: '2026-02-22', user: 0, text: 'brunch + farmers market', start: 10, end: 12.5, shared: true, color: 'orange' },
  { date: '2026-02-24', user: 1, text: 'therapy session', start: 17, end: 18, color: 'indigo' },
  { date: '2026-02-27', user: 0, text: 'portfolio polish', start: 9.5, end: 12, color: 'blue' },
  { date: '2026-02-28', user: 1, text: 'movie premiere night 🎬', start: 19.5, end: 22, shared: true, color: null },

  // ═══ March ═══
  { date: '2026-03-02', user: 0, text: '1:1 with manager', start: 11, end: 11.5, color: 'blue' },
  { date: '2026-03-03', user: 1, text: 'chem lab', start: 9, end: 12, color: 'violet' },
  { date: '2026-03-05', user: 0, text: 'IKEA run for new desk 🛒', start: 13, end: 15.5, shared: true, color: 'yellow' },
  { date: '2026-03-07', user: 0, text: 'brunch and errands', start: 10.5, end: 13, shared: true, color: 'green' },
  { date: '2026-03-09', user: 1, text: 'eye exam', start: 10, end: 11, color: 'red' },
  { date: '2026-03-11', user: 0, text: 'client demo rehearsal', start: 14, end: 15.5, color: 'blue' },
  { date: '2026-03-13', user: 0, text: "St. Patrick's warmup — pub crawl ☘️", start: 18, end: 22, shared: true, color: 'green' },
  { date: '2026-03-16', user: 0, text: 'spring planning session', start: 17, end: 18, shared: true, color: 'indigo' },
  { date: '2026-03-18', user: 1, text: 'hair appointment', start: 15, end: 16.5, color: 'violet' },
  { date: '2026-03-20', user: 0, text: 'first day of spring hike 🌸', start: 9, end: 12, shared: true, color: 'green' },
  { date: '2026-03-21', user: 1, text: "roommate's birthday party 🎉", start: 20, end: 23, color: 'orange' },
  { date: '2026-03-23', user: 0, text: 'quarterly review prep', start: 10, end: 12, color: 'blue' },
  { date: '2026-03-25', user: 1, text: 'blood donation drive 🩸', start: 12, end: 13, color: 'red' },
  { date: '2026-03-27', user: 0, text: 'game night @ Chris & Dana\'s 🎲', start: 19, end: 22.5, shared: true, color: 'indigo' },
  { date: '2026-03-28', user: 1, text: 'car wash + detailing', start: 10, end: 11.5, color: 'yellow' },
  { date: '2026-03-30', user: 0, text: 'office hours', start: 14, end: 15, color: 'violet' },
  { date: '2026-03-31', user: 1, text: 'plant new herb garden 🌱', start: 16, end: 17.5, shared: true, color: 'green' },

  // ═══ April ═══
  { date: '2026-04-01', user: 0, text: 'prank the team day 🤡', start: 9, end: 9.5, color: 'yellow' },
  { date: '2026-04-03', user: 1, text: 'statistics exam review', start: 18, end: 20, color: 'violet' },
  { date: '2026-04-04', user: 0, text: 'hackathon build block 💻', start: 10, end: 15, color: 'blue' },
  { date: '2026-04-05', user: 0, text: 'hackathon demos + awards', start: 15, end: 18, color: 'blue' },
  { date: '2026-04-07', user: 1, text: 'dermatologist appointment', start: 9, end: 10, color: 'red' },
  { date: '2026-04-09', user: 0, text: 'Easter basket shopping 🐰', start: 17, end: 18.5, shared: true, color: 'yellow' },
  { date: '2026-04-11', user: 0, text: 'brunch with the Lees', start: 10.5, end: 12.5, shared: true, color: 'orange' },
  { date: '2026-04-12', user: 1, text: 'Easter dinner with family 🐣', start: 15, end: 19, shared: true, color: 'green' },
  { date: '2026-04-15', user: 0, text: 'taxes and budget review 📊', start: 19, end: 20.5, shared: true, color: 'yellow' },
  { date: '2026-04-17', user: 0, text: 'annual review — self-assessment', start: 10, end: 11.5, color: 'blue' },
  { date: '2026-04-18', user: 1, text: 'volunteer day @ the shelter 🐾', start: 9, end: 13, color: 'green' },
  { date: '2026-04-20', user: 0, text: '4/20 concert in the park 🎵', start: 14, end: 18, shared: true, color: 'indigo' },
  { date: '2026-04-22', user: 1, text: 'earth day picnic 🌍', start: 12, end: 14, shared: true, color: 'green' },
  { date: '2026-04-24', user: 0, text: 'photography walk downtown 📷', start: 17, end: 19, color: 'indigo' },
  { date: '2026-04-25', user: 0, text: 'weekend trip — Big Sur 🌊', start: 8, end: 20, shared: true, color: 'blue' },
  { date: '2026-04-26', user: 0, text: 'coastal hike + drive home', start: 9, end: 17, shared: true, color: 'green' },
  { date: '2026-04-28', user: 0, text: 'recruiter coffee chat', start: 8.5, end: 9.5, color: 'blue' },
  { date: '2026-04-30', user: 1, text: 'yoga workshop', start: 18, end: 19.5, color: 'violet' },

  // ═══ May ═══
  { date: '2026-05-01', user: 0, text: 'May Day flower market 💐', start: 11, end: 12.5, shared: true, color: 'green' },
  { date: '2026-05-02', user: 1, text: 'final project lab', start: 13, end: 17, color: 'violet' },
  { date: '2026-05-04', user: 0, text: 'Star Wars day trivia ⭐', start: 19, end: 21, color: 'indigo' },
  { date: '2026-05-05', user: 0, text: 'Cinco de Mayo happy hour 🌮', start: 17.5, end: 20, shared: true, color: 'orange' },
  { date: '2026-05-07', user: 1, text: 'thesis advisor meeting', start: 14, end: 15, color: 'violet' },
  { date: '2026-05-09', user: 0, text: 'car detailing', start: 9, end: 10.5, color: 'yellow' },
  { date: '2026-05-10', user: 0, text: "Mother's Day call 📞", start: 16, end: 17, shared: true, color: 'orange' },
  { date: '2026-05-12', user: 1, text: 'skin check appointment', start: 10, end: 11, color: 'red' },
  { date: '2026-05-14', user: 0, text: 'flight to Seattle ✈️', start: 6, end: 9, color: 'blue' },
  { date: '2026-05-14', user: 1, text: 'girls night out 🍸', start: 19, end: 23, color: 'violet' },
  { date: '2026-05-15', user: 0, text: 'client meetings — Seattle', start: 9, end: 17, color: 'indigo' },
  { date: '2026-05-15', user: 0, text: 'movie night (virtual) 🎬', start: 20, end: 22, shared: true, color: null },
  { date: '2026-05-16', user: 0, text: 'flight home from Seattle', start: 10, end: 13, color: 'blue' },
  { date: '2026-05-16', user: 0, text: "BBQ @ Mike & Sarah's 🍔", start: 16, end: 20, shared: true, color: 'orange' },
  { date: '2026-05-18', user: 0, text: 'anniversary dinner ❤️', start: 19, end: 21.5, shared: true, color: 'red' },
  { date: '2026-05-21', user: 1, text: 'dinner with friends', start: 18.5, end: 21, color: 'green' },
  { date: '2026-05-23', user: 0, text: 'farmers market 🥦', start: 9.5, end: 11, shared: true, color: 'green' },
  { date: '2026-05-25', user: 0, text: 'Memorial Day cookout 🇺🇸', start: 15, end: 21, shared: true, color: 'red' },
  { date: '2026-05-27', user: 1, text: 'spa day 🧖', start: 12, end: 15, color: 'violet' },
  { date: '2026-05-29', user: 0, text: 'long weekend packing', start: 19, end: 20.5, shared: true, color: 'orange' },
  { date: '2026-05-30', user: 0, text: 'Runyon Canyon hike 🥾', start: 8, end: 11, shared: true, color: 'green' },

  // ═══ June ═══
  { date: '2026-06-01', user: 0, text: 'lease renewal signing 📝', start: 14, end: 15, shared: true, color: 'red' },
  { date: '2026-06-03', user: 0, text: 'portfolio analytics pass', start: 9, end: 11, color: 'blue' },
  { date: '2026-06-04', user: 0, text: 'flight to NYC ✈️🗽', start: 7, end: 10.5, shared: true, color: 'blue' },
  { date: '2026-06-04', user: 0, text: 'explore the city 🌆', start: 15, end: 19, shared: true, color: 'green' },
  { date: '2026-06-05', user: 0, text: 'Central Park + MoMA 🎨', start: 10, end: 16, shared: true, color: 'green' },
  { date: '2026-06-05', user: 0, text: 'Broadway show 🎭', start: 20, end: 23, shared: true, color: 'violet' },
  { date: '2026-06-06', user: 0, text: 'flight home from NYC ✈️', start: 15, end: 18.5, shared: true, color: 'blue' },
  { date: '2026-06-09', user: 1, text: 'summer class lecture', start: 10, end: 12, color: 'violet' },
  { date: '2026-06-10', user: 0, text: 'Pride parade 🏳️‍🌈', start: 11, end: 15, shared: true, color: 'indigo' },
  { date: '2026-06-13', user: 0, text: 'farmers market lunch', start: 11, end: 13, shared: true, color: 'green' },
  { date: '2026-06-15', user: 0, text: 'performance review', start: 10, end: 11, color: 'indigo' },
  { date: '2026-06-16', user: 1, text: 'pottery class 🏺', start: 18, end: 20, color: 'orange' },
  { date: '2026-06-18', user: 1, text: 'internship kickoff 🎉', start: 9, end: 10.5, color: 'blue' },
  { date: '2026-06-19', user: 0, text: 'Juneteenth BBQ 🎆', start: 16, end: 21, shared: true, color: 'orange' },
  { date: '2026-06-20', user: 0, text: "Jamie's birthday dinner 🎂", start: 19, end: 22, shared: true, color: 'red' },
  { date: '2026-06-21', user: 0, text: 'birthday brunch 🥂', start: 11, end: 13, shared: true, color: 'orange' },
  { date: '2026-06-24', user: 0, text: 'sushi date night 🍣', start: 19.5, end: 21.5, shared: true, color: 'red' },
  { date: '2026-06-26', user: 0, text: 'movie night 🎬', start: 20, end: 22.5, shared: true, color: 'orange' },
  { date: '2026-06-27', user: 0, text: 'day trip to Santa Barbara 🚗', start: 9, end: 20, shared: true, color: 'yellow' },
  { date: '2026-06-29', user: 0, text: 'month-end dinner 🥂', start: 19.5, end: 21.5, shared: true, color: 'red' },

  // ═══ July ═══
  { date: '2026-07-01', user: 1, text: 'internship mid-check-in', start: 11, end: 12, color: 'blue' },
  { date: '2026-07-04', user: 0, text: 'bbq and fireworks 🎆', start: 15, end: 22, shared: true, color: 'red' },
  { date: '2026-07-06', user: 0, text: 'kayaking on the lake 🛶', start: 9, end: 12, shared: true, color: 'green' },
  { date: '2026-07-08', user: 1, text: 'meal prep', start: 18, end: 20, color: 'green' },
  { date: '2026-07-10', user: 0, text: 'work sprint demo', start: 14, end: 15, color: 'blue' },
  { date: '2026-07-12', user: 0, text: 'beach day @ Santa Monica 🏖️', start: 10, end: 18, shared: true, color: 'yellow' },
  { date: '2026-07-14', user: 0, text: 'midyear goals review', start: 12, end: 13, shared: true, color: 'indigo' },
  { date: '2026-07-16', user: 1, text: 'dentist cleaning', start: 9, end: 10, color: 'red' },
  { date: '2026-07-18', user: 0, text: 'camping trip — Big Bear 🏕️', start: 8, end: 20, color: 'green' },
  { date: '2026-07-19', user: 0, text: 'camping trip — Big Bear 🏕️', start: 8, end: 20, color: 'green' },
  { date: '2026-07-19', user: 1, text: 'hike with friends', start: 8, end: 13, color: 'orange' },
  { date: '2026-07-22', user: 1, text: 'internship project sync', start: 10, end: 11, color: 'blue' },
  { date: '2026-07-24', user: 0, text: 'comedy show downtown 🎤', start: 20, end: 22.5, shared: true, color: 'violet' },
  { date: '2026-07-25', user: 0, text: 'outdoor concert — lawn seats 🎵', start: 17, end: 22, shared: true, color: 'indigo' },
  { date: '2026-07-27', user: 0, text: 'work sprint planning', start: 9.5, end: 11, color: 'blue' },
  { date: '2026-07-29', user: 1, text: 'car registration renewal', start: 10, end: 11, color: 'yellow' },
  { date: '2026-07-31', user: 0, text: 'rooftop happy hour 🍹', start: 18, end: 20, shared: true, color: 'yellow' },

  // ═══ August ═══
  { date: '2026-08-01', user: 0, text: 'lake house weekend 🏞️', start: 8, end: 20, shared: true, color: 'green' },
  { date: '2026-08-02', user: 0, text: 'lake house — day 2', start: 9, end: 18, shared: true, color: 'green' },
  { date: '2026-08-03', user: 1, text: 'resume refresh', start: 14, end: 15.5, color: 'blue' },
  { date: '2026-08-05', user: 0, text: 'orthodontist follow-up', start: 9, end: 10, color: 'red' },
  { date: '2026-08-07', user: 1, text: 'internship presentation prep', start: 15, end: 17, color: 'blue' },
  { date: '2026-08-08', user: 0, text: 'beach day 🏖️', start: 10, end: 16, shared: true, color: 'orange' },
  { date: '2026-08-10', user: 0, text: 'friend\'s engagement party 💍', start: 18, end: 22, shared: true, color: 'red' },
  { date: '2026-08-12', user: 1, text: 'internship demo day 🎤', start: 13, end: 15, color: 'blue' },
  { date: '2026-08-14', user: 1, text: 'internship wrap party', start: 17, end: 20, color: 'orange' },
  { date: '2026-08-15', user: 0, text: 'ice cream social 🍦', start: 16, end: 17.5, shared: true, color: 'yellow' },
  { date: '2026-08-17', user: 0, text: 'systems design study', start: 19, end: 21, color: 'violet' },
  { date: '2026-08-19', user: 1, text: 'back-to-school shopping', start: 11, end: 13, color: 'violet' },
  { date: '2026-08-21', user: 0, text: 'trivia night 🍺', start: 19, end: 21, shared: true, color: 'yellow' },
  { date: '2026-08-22', user: 0, text: 'weekend trip — San Diego 🌊', start: 9, end: 20, shared: true, color: 'blue' },
  { date: '2026-08-23', user: 0, text: 'San Diego Zoo + beach', start: 9, end: 20, shared: true, color: 'blue' },
  { date: '2026-08-25', user: 1, text: 'move-in shopping run', start: 10, end: 12.5, color: 'yellow' },
  { date: '2026-08-27', user: 0, text: 'welcome back sprint kickoff', start: 9, end: 10, color: 'blue' },
  { date: '2026-08-31', user: 0, text: 'fall calendar planning 🍂', start: 20, end: 21, shared: true, color: 'indigo' },

  // ═══ September ═══
  { date: '2026-09-01', user: 0, text: 'Labor Day BBQ 🍔', start: 14, end: 20, shared: true, color: 'red' },
  { date: '2026-09-02', user: 1, text: 'first lecture', start: 9, end: 10.5, color: 'violet' },
  { date: '2026-09-04', user: 0, text: 'quarterly planning offsite', start: 9, end: 17, color: 'indigo' },
  { date: '2026-09-06', user: 0, text: 'brunch + apple orchard prep', start: 10, end: 12, shared: true, color: 'orange' },
  { date: '2026-09-08', user: 1, text: 'grad school info session', start: 17, end: 18.5, color: 'violet' },
  { date: '2026-09-10', user: 0, text: 'career fair prep', start: 16, end: 18, color: 'blue' },
  { date: '2026-09-12', user: 0, text: 'wine tasting weekend 🍷', start: 12, end: 18, shared: true, color: 'red' },
  { date: '2026-09-15', user: 1, text: 'club social', start: 19, end: 21, color: 'orange' },
  { date: '2026-09-17', user: 0, text: 'annual eye exam', start: 10, end: 11, color: 'red' },
  { date: '2026-09-19', user: 0, text: 'game night 🎲', start: 19, end: 22, shared: true, color: 'indigo' },
  { date: '2026-09-21', user: 0, text: 'project milestone review', start: 10, end: 11, shared: true, color: 'blue' },
  { date: '2026-09-23', user: 1, text: 'career center appointment', start: 13, end: 14, color: 'blue' },
  { date: '2026-09-25', user: 0, text: 'first day of fall hike 🍁', start: 9, end: 12, shared: true, color: 'green' },
  { date: '2026-09-27', user: 0, text: 'pumpkin patch 🎃', start: 11, end: 14, shared: true, color: 'orange' },
  { date: '2026-09-29', user: 1, text: 'internship applications', start: 18, end: 20, color: 'blue' },
  { date: '2026-09-30', user: 1, text: 'midterm study block', start: 18, end: 21, color: 'violet' },

  // ═══ October ═══
  { date: '2026-10-02', user: 0, text: 'design review', start: 11, end: 12, color: 'blue' },
  { date: '2026-10-03', user: 0, text: 'apple picking 🍎', start: 11, end: 15, shared: true, color: 'orange' },
  { date: '2026-10-05', user: 1, text: 'flu shot appointment', start: 9, end: 9.5, color: 'red' },
  { date: '2026-10-07', user: 0, text: 'haunted house night 👻', start: 19, end: 22, shared: true, color: 'indigo' },
  { date: '2026-10-08', user: 1, text: 'physics lab', start: 13, end: 16, color: 'violet' },
  { date: '2026-10-10', user: 0, text: 'weekend cabin trip 🏔️', start: 8, end: 20, shared: true, color: 'green' },
  { date: '2026-10-11', user: 0, text: 'cabin trip — hiking day', start: 9, end: 16, shared: true, color: 'green' },
  { date: '2026-10-13', user: 0, text: 'sprint demo', start: 14, end: 15, color: 'blue' },
  { date: '2026-10-16', user: 0, text: 'technical interview loop', start: 9, end: 12, color: 'blue' },
  { date: '2026-10-18', user: 1, text: 'costume shopping 🎃', start: 15, end: 17, shared: true, color: 'orange' },
  { date: '2026-10-20', user: 0, text: 'pumpkin carving night 🎃', start: 19, end: 21, shared: true, color: 'orange' },
  { date: '2026-10-22', user: 1, text: 'grad school application deadline', start: 20, end: 22, color: 'violet' },
  { date: '2026-10-24', user: 1, text: 'costume party 🎉', start: 21, end: 23.5, color: 'orange' },
  { date: '2026-10-27', user: 0, text: 'Halloween movie marathon 🍿', start: 19, end: 23, shared: true, color: null },
  { date: '2026-10-29', user: 0, text: 'dinner reservation', start: 18.5, end: 20, shared: true, color: 'green' },
  { date: '2026-10-31', user: 0, text: 'trick-or-treat + block party 🍬', start: 17, end: 21, shared: true, color: 'orange' },

  // ═══ November ═══
  { date: '2026-11-01', user: 1, text: 'daylight saving reset 🕐', start: 10, end: 10.5, color: 'yellow' },
  { date: '2026-11-03', user: 0, text: 'all-hands meeting', start: 10, end: 11, color: 'blue' },
  { date: '2026-11-04', user: 0, text: 'work presentation', start: 10, end: 11.5, color: 'blue' },
  { date: '2026-11-06', user: 1, text: 'grad school interview', start: 13, end: 14, color: 'violet' },
  { date: '2026-11-07', user: 0, text: 'friendsgiving potluck 🦃', start: 17, end: 21, shared: true, color: 'orange' },
  { date: '2026-11-09', user: 1, text: 'class registration', start: 8.5, end: 9.5, color: 'violet' },
  { date: '2026-11-11', user: 0, text: 'veterans day 5k 🏃', start: 8, end: 10, shared: true, color: 'green' },
  { date: '2026-11-13', user: 0, text: 'happy hour + trivia', start: 18, end: 20.5, shared: true, color: 'yellow' },
  { date: '2026-11-15', user: 0, text: 'thanksgiving travel planning ✈️', start: 17, end: 18, shared: true, color: 'yellow' },
  { date: '2026-11-17', user: 1, text: 'annual physical', start: 9, end: 10, color: 'red' },
  { date: '2026-11-19', user: 0, text: 'project launch celebration 🚀', start: 17, end: 19, color: 'blue' },
  { date: '2026-11-21', user: 0, text: 'holiday shopping kickoff', start: 11, end: 14, shared: true, color: 'orange' },
  { date: '2026-11-24', user: 0, text: 'flight to see family ✈️', start: 8, end: 11, shared: true, color: 'blue' },
  { date: '2026-11-26', user: 1, text: 'thanksgiving dinner 🦃', start: 15, end: 20, shared: true, color: 'green' },
  { date: '2026-11-27', user: 0, text: 'black friday sale run', start: 6, end: 9, color: 'yellow' },
  { date: '2026-11-28', user: 0, text: 'flight home', start: 14, end: 17, shared: true, color: 'blue' },
  { date: '2026-11-30', user: 0, text: 'finals study plan', start: 19, end: 20, color: 'violet' },

  // ═══ December ═══
  { date: '2026-12-01', user: 0, text: 'holiday decorating 🎄', start: 18, end: 20.5, shared: true, color: 'red' },
  { date: '2026-12-03', user: 1, text: 'finals week — exam 1', start: 9, end: 11, color: 'violet' },
  { date: '2026-12-04', user: 1, text: 'final lab report', start: 13, end: 16, color: 'violet' },
  { date: '2026-12-06', user: 0, text: 'office holiday party 🎉', start: 18, end: 22, color: 'red' },
  { date: '2026-12-08', user: 1, text: 'finals week — exam 2', start: 9, end: 11.5, color: 'violet' },
  { date: '2026-12-09', user: 0, text: 'year-end work review', start: 11, end: 12, color: 'blue' },
  { date: '2026-12-11', user: 1, text: 'last day of classes 🎓', start: 10, end: 12, color: 'violet' },
  { date: '2026-12-12', user: 0, text: 'gingerbread house night 🏠', start: 18, end: 20.5, shared: true, color: 'red' },
  { date: '2026-12-14', user: 1, text: 'holiday shopping', start: 18, end: 20, shared: true, color: 'orange' },
  { date: '2026-12-16', user: 0, text: 'ugly sweater party 🧶', start: 19, end: 22, shared: true, color: 'red' },
  { date: '2026-12-18', user: 0, text: 'client year-end check-in', start: 10, end: 11, color: 'blue' },
  { date: '2026-12-20', user: 0, text: 'friendsmas dinner 🎁', start: 18, end: 22, shared: true, color: 'green' },
  { date: '2026-12-22', user: 0, text: 'flight to see family ✈️', start: 8, end: 11, shared: true, color: 'blue' },
  { date: '2026-12-24', user: 0, text: "Christmas Eve dinner 🕯️", start: 17, end: 21, shared: true, color: 'red' },
  { date: '2026-12-25', user: 0, text: 'Christmas Day with family 🎄', start: 9, end: 20, shared: true, color: 'green' },
  { date: '2026-12-27', user: 0, text: 'flight home', start: 14, end: 17, shared: true, color: 'blue' },
  { date: '2026-12-28', user: 0, text: 'year-in-review journaling 📔', start: 19, end: 20, shared: true, color: 'indigo' },
  { date: '2026-12-30', user: 0, text: 'new year resolutions planning', start: 18, end: 19.5, shared: true, color: 'indigo' },
  { date: '2026-12-31', user: 0, text: 'new year countdown 🎊', start: 21, end: 24, shared: true, color: 'indigo' },
];

// Recurring weekly patterns — expanded across the year to give every week a
// realistic, busy-but-livable rhythm on top of the one-off events above.
const DEMO_WEEKLY_PATTERNS = [
  // Alex's routine
  { from: '2026-01-01', to: '2026-12-31', weekdays: [1, 3, 5], user: 0, text: 'standup', start: 9, end: 9.5, color: 'blue' },
  { from: '2026-01-01', to: '2026-12-31', weekdays: [2, 4, 6], user: 0, text: 'gym 🏋️', start: 18, end: 19.5, color: 'green' },
  // Jamie's routine
  { from: '2026-01-01', to: '2026-12-31', weekdays: [1, 3, 5], user: 1, text: 'pilates', start: 7, end: 8, color: 'violet' },
  { from: '2026-01-01', to: '2026-12-31', weekdays: [2], user: 1, text: 'admin + errands block', start: 18, end: 19, color: 'yellow' },
  { from: '2026-01-01', to: '2026-12-31', weekdays: [3], user: 1, text: 'evening run 🏃', start: 18, end: 19, color: 'green' },
  // Shared weekly rhythm
  { from: '2026-01-01', to: '2026-12-31', weekdays: [5], user: 0, text: 'date night 🍷', start: 19, end: 21, shared: true, color: 'red' },
  { from: '2026-01-01', to: '2026-12-31', weekdays: [0], user: 0, text: 'meal prep Sunday 🥗', start: 15, end: 17, shared: true, color: 'yellow' },
  { from: '2026-01-01', to: '2026-12-31', weekdays: [6], user: 0, text: 'coffee + morning walk ☕', start: 9, end: 10, shared: true, color: 'green' },
  // Seasonal — spring semester
  { from: '2026-01-12', to: '2026-05-08', weekdays: [2, 4], user: 0, text: 'evening seminar', start: 18, end: 19.5, color: 'violet' },
  // Seasonal — summer internship
  { from: '2026-06-01', to: '2026-08-14', weekdays: [1, 3, 5], user: 1, text: 'internship work block', start: 9, end: 12, color: 'blue' },
  // Seasonal — fall semester
  { from: '2026-09-01', to: '2026-12-11', weekdays: [2, 4], user: 1, text: 'systems class', start: 11, end: 12.5, color: 'violet' },
  { from: '2026-09-07', to: '2026-12-11', weekdays: [1], user: 0, text: 'career prep block', start: 16, end: 17.5, color: 'blue' },
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

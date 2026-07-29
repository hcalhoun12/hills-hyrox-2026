// ===== Hill's Hyrox 2026 — Dashboard Logic =====

const LS_KEYS = {
  checkins: 'hh26_checkins',
  weight: 'hh26_weight_log',
  benchmarks: 'hh26_benchmarks',
  workoutLog: 'hh26_workout_log',
  dailyMetrics: 'hh26_daily_metrics',
};

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function saveLS(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
function fmtDateShort(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const RACE_DATE = '2026-12-10';

function daysBetween(a, b) {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / 86400000);
}

let PLAN = null;

fetch('plan.json')
  .then(r => r.json())
  .then(data => {
    PLAN = data;
    init();
  })
  .catch(err => {
    document.getElementById('missionTitle').textContent = "Couldn't load plan.json";
    document.getElementById('missionBody').textContent = 'Make sure plan.json is in the same folder as index.html.';
    console.error(err);
  });

function init() {
  const today = todayISO();
  renderCountdown(today);
  renderMission(today);
  renderWeekStrip(today);
  renderThisWeekSummary(today);
  renderCheckinForm(today);
  renderEodForm(today);
  renderWeight();
  renderBenchmarks();
  renderPlanAccordion();
  renderWorkoutLog();
  renderRaceCalendar();
  renderCoachNotes();
}

// ---------- Countdown Ring ----------
function renderCountdown(today) {
  const daysLeft = daysBetween(today, RACE_DATE);
  const totalDays = daysBetween(PLAN.startDate, RACE_DATE);
  const elapsed = daysBetween(PLAN.startDate, today);
  const pct = Math.max(0, Math.min(1, elapsed / totalDays));

  document.getElementById('daysLeftNum').textContent = daysLeft >= 0 ? daysLeft : 'Done!';
  const weeksLeft = daysLeft >= 0 ? Math.ceil(daysLeft / 7) : 0;
  document.getElementById('weeksLeftSub').textContent = daysLeft >= 0 ? `${weeksLeft} weeks to go` : 'Race day has passed';
  document.getElementById('weeksLeftNum2').textContent = daysLeft >= 0 ? weeksLeft : '—';

  const circumference = 2 * Math.PI * 98;
  const offset = circumference * (1 - pct);
  const ring = document.getElementById('ringProgress');
  ring.setAttribute('stroke-dasharray', circumference);
  ring.setAttribute('stroke-dashoffset', daysLeft >= 0 ? offset : 0);

  const week = findWeek(today);
  document.getElementById('phaseChip').innerHTML = `Phase: <b>${week ? week.phase : '—'}</b>`;
}

// ---------- Find today's data ----------
function findWeek(dateISO) {
  return PLAN.weeks.find(w => dateISO >= w.startDate && dateISO <= w.endDate);
}
function findDay(dateISO) {
  for (const w of PLAN.weeks) {
    const d = w.days.find(d => d.date === dateISO);
    if (d) return { day: d, week: w };
  }
  return null;
}

const TYPE_LABEL = {
  otf: 'Orangetheory', hyrox: 'Hyrox Stations', rest: 'Rest', strength: 'Strength',
  run: 'Run', partner: 'Partner Day', race: 'Race Day', travel: 'Travel', light: 'Light Session'
};
const TYPE_BADGE_CLASS = { rest: 'rest', race: 'race', partner: 'partner' };

// ---------- Today's Mission ----------
function renderMission(today) {
  document.getElementById('todayDateLabel').textContent = fmtDate(today);
  const found = findDay(today);
  const badge = document.getElementById('missionBadge');
  const title = document.getElementById('missionTitle');
  const body = document.getElementById('missionBody');
  const craftBox = document.getElementById('craftBox');
  const completeBtn = document.getElementById('completeBtn');

  if (!found) {
    const beforeStart = today < PLAN.startDate;
    badge.textContent = beforeStart ? 'Upcoming' : 'Complete';
    badge.className = 'badge';
    title.textContent = beforeStart ? `Plan starts ${fmtDate(PLAN.startDate)}` : 'Race day has passed — congrats!';
    body.textContent = beforeStart ? 'Get your gear sorted and rest up. First session lands on the start date above.' : 'Hope Nashville went great. Time to plan recovery and what comes next.';
    completeBtn.style.display = 'none';
    craftBox.innerHTML = '';
    return;
  }

  const { day } = found;
  badge.textContent = TYPE_LABEL[day.type] || day.type;
  badge.className = 'badge ' + (TYPE_BADGE_CLASS[day.type] || '');
  title.textContent = day.title;
  body.textContent = day.details;

  if (day.raceCraft) {
    craftBox.innerHTML = `
      <div class="craft-box">
        <h4>Race Craft — ${day.raceCraft.station}</h4>
        <div class="craft-row"><b>Rule:</b> ${day.raceCraft.officialRule}</div>
        <div class="craft-row"><b>Transition:</b> ${day.raceCraft.transitionTip}</div>
        <div class="craft-row"><b>Hand-off:</b> ${day.raceCraft.handoffStrategy}</div>
      </div>`;
  } else {
    craftBox.innerHTML = '';
  }

  // Adapt message based on today's check-in, if saved
  const checkins = loadLS(LS_KEYS.checkins, {});
  const c = checkins[today];
  const adaptBox = document.getElementById('adaptBox');
  if (c) {
    let msg = '';
    if (c.sleep <= 2 && c.soreness >= 4) {
      msg = "Low sleep + high soreness today — dial this session back. Cut intensity ~20%, drop a set or two, prioritize movement quality over load.";
    } else if (c.workload >= 4) {
      msg = "High workload/time crunch — do the condensed version: shorten to the essential movements, keep the pattern, skip the extras. Something is better than nothing today.";
    } else if (c.energy >= 4 && c.soreness <= 2) {
      msg = "Feeling good — run today's session as written, or nudge the effort up if it feels easy.";
    }
    if (msg) {
      adaptBox.style.display = 'block';
      adaptBox.textContent = msg;
    } else {
      adaptBox.style.display = 'none';
    }
  }

  if (day.type === 'race' || day.raceDay) {
    completeBtn.style.display = 'none';
  } else {
    completeBtn.style.display = 'block';
    const log = loadLS(LS_KEYS.workoutLog, {});
    const isDone = !!log[today];
    completeBtn.textContent = isDone ? '✓ Completed' : 'Mark Today Complete';
    completeBtn.className = 'complete-btn' + (isDone ? ' done' : '');
    completeBtn.onclick = () => {
      const log = loadLS(LS_KEYS.workoutLog, {});
      if (log[today]) {
        delete log[today];
      } else {
        log[today] = { title: day.title, type: day.type, date: today };
      }
      saveLS(LS_KEYS.workoutLog, log);
      renderMission(today);
      renderWorkoutLog();
    };
  }
}

// ---------- Week Strip ----------
function renderWeekStrip(today) {
  const week = findWeek(today);
  const strip = document.getElementById('weekStrip');
  const rangeLabel = document.getElementById('weekRangeLabel');
  if (!week) { strip.innerHTML = ''; rangeLabel.textContent = ''; return; }
  rangeLabel.textContent = `Week ${week.week} · ${fmtDateShort(week.startDate)}–${fmtDateShort(week.endDate)}`;
  strip.className = 'week-strip';
  strip.innerHTML = week.days.map(d => {
    const isToday = d.date === today;
    const dowShort = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
    const dnum = new Date(d.date + 'T12:00:00').getDate();
    const dotClass = d.type === 'rest' ? 'rest' : d.type === 'race' ? 'race' : d.type === 'partner' ? 'partner' : '';
    return `<div class="day-chip ${isToday ? 'today' : ''}">
      <div class="dow">${dowShort}</div>
      <div class="dnum">${dnum}</div>
      <div class="dtype">${TYPE_LABEL[d.type] || d.type}</div>
      <div class="dot ${dotClass}"></div>
    </div>`;
  }).join('');
}

// ---------- This Week Summary (Jeff-style) ----------
const LOCATION_MAP = {
  otf: 'Orangetheory Studio',
  hyrox: 'ATC / Crunch',
  strength: 'Home',
  run: 'Outside / Treadmill',
  partner: 'Gym w/ Corrie',
  rest: '—',
  race: 'Race Site',
  travel: 'On the Road',
  light: 'Hotel / Wherever You Are',
};

function renderThisWeekSummary(today) {
  const week = findWeek(today);
  const totalWeeks = PLAN.weeks.length;

  // "This Week" header card — mirrors Jeff's: title + week range + note only
  document.getElementById('twWeekNum').textContent = week ? `Week ${week.week} of ${totalWeeks}` : 'Week — of —';
  document.getElementById('twDateRange').textContent = week ? `${fmtDateShort(week.startDate)}–${fmtDateShort(week.endDate)}` : '—';

  // Quick stats strip under Today's Task — Phase / Week / Next Session / Location
  document.getElementById('qsPhase').textContent = week ? week.phase : '—';
  document.getElementById('qsWeek').textContent = week ? `${week.week} of ${totalWeeks}` : '—';

  // Find the next session: the next day strictly after today across all weeks
  let next = null;
  for (const w of PLAN.weeks) {
    for (const d of w.days) {
      if (d.date > today) { next = d; break; }
    }
    if (next) break;
  }

  if (next) {
    const dow = new Date(next.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    document.getElementById('qsNextSession').textContent = `${dow} — ${next.title}`;
    document.getElementById('qsLocation').textContent = LOCATION_MAP[next.type] || '—';
  } else {
    document.getElementById('qsNextSession').textContent = 'Plan complete';
    document.getElementById('qsLocation').textContent = '—';
  }
}

// ---------- Check-in Form ----------
function renderCheckinForm(today) {
  const checkins = loadLS(LS_KEYS.checkins, {});
  const existing = checkins[today] || { sleep: 3, energy: 3, soreness: 3, motivation: 3, workload: 3, note: '', restingHR: '', sleepHours: '' };
  ['sleep', 'energy', 'soreness', 'motivation', 'workload'].forEach(key => {
    const input = document.getElementById(key);
    const val = document.getElementById('val' + key.charAt(0).toUpperCase() + key.slice(1));
    input.value = existing[key];
    val.textContent = existing[key];
    input.addEventListener('input', () => { val.textContent = input.value; });
  });
  document.getElementById('restingHR').value = existing.restingHR || '';
  document.getElementById('valRestingHR').textContent = existing.restingHR ? 'bpm' : '';
  document.getElementById('sleepHours').value = existing.sleepHours || '';
  document.getElementById('valSleepHours').textContent = existing.sleepHours ? 'hrs' : '';
  document.getElementById('restingHR').addEventListener('input', (e) => {
    document.getElementById('valRestingHR').textContent = e.target.value ? 'bpm' : '';
  });
  document.getElementById('sleepHours').addEventListener('input', (e) => {
    document.getElementById('valSleepHours').textContent = e.target.value ? 'hrs' : '';
  });
  document.getElementById('checkinNote').value = existing.note || '';

  document.getElementById('saveCheckinBtn').onclick = () => {
    const checkins = loadLS(LS_KEYS.checkins, {});
    checkins[today] = {
      sleep: +document.getElementById('sleep').value,
      energy: +document.getElementById('energy').value,
      soreness: +document.getElementById('soreness').value,
      motivation: +document.getElementById('motivation').value,
      workload: +document.getElementById('workload').value,
      restingHR: document.getElementById('restingHR').value ? +document.getElementById('restingHR').value : null,
      sleepHours: document.getElementById('sleepHours').value ? +document.getElementById('sleepHours').value : null,
      note: document.getElementById('checkinNote').value,
    };
    saveLS(LS_KEYS.checkins, checkins);
    const btn = document.getElementById('saveCheckinBtn');
    btn.textContent = 'Saved ✓';
    btn.classList.add('saved');
    setTimeout(() => { btn.textContent = "Save Today's Check-In"; btn.classList.remove('saved'); }, 1800);
    renderMission(today);
  };
}

// ---------- End of Day Log ----------
function renderEodForm(today) {
  const log = loadLS(LS_KEYS.dailyMetrics, {});
  const existing = log[today] || {};
  document.getElementById('eodCalories').value = existing.calories || '';
  document.getElementById('eodSteps').value = existing.steps || '';
  document.getElementById('eodWorkoutMin').value = existing.workoutMin || '';

  const hist = document.getElementById('eodHistory');
  const renderHistory = () => {
    const log = loadLS(LS_KEYS.dailyMetrics, {});
    const entries = Object.entries(log).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
    if (!entries.length) {
      hist.innerHTML = '<div class="empty-state">No entries yet.</div>';
      return;
    }
    hist.innerHTML = entries.map(([date, e]) => `
      <div class="log-entry">
        <span class="ldate">${fmtDateShort(date)}</span>
        <span class="ltitle">${e.calories || '—'} cal · ${e.steps || '—'} steps · ${e.workoutMin || '—'} min</span>
      </div>
    `).join('');
  };
  renderHistory();

  document.getElementById('saveEodBtn').onclick = () => {
    const log = loadLS(LS_KEYS.dailyMetrics, {});
    log[today] = {
      calories: document.getElementById('eodCalories').value ? +document.getElementById('eodCalories').value : null,
      steps: document.getElementById('eodSteps').value ? +document.getElementById('eodSteps').value : null,
      workoutMin: document.getElementById('eodWorkoutMin').value ? +document.getElementById('eodWorkoutMin').value : null,
    };
    saveLS(LS_KEYS.dailyMetrics, log);
    const btn = document.getElementById('saveEodBtn');
    btn.textContent = 'Saved ✓';
    btn.classList.add('saved');
    setTimeout(() => { btn.textContent = 'Save End of Day Log'; btn.classList.remove('saved'); }, 1800);
    renderHistory();
  };
}

// ---------- Weight ----------
function renderWeight() {
  const log = loadLS(LS_KEYS.weight, []);
  const latest = log.length ? log[log.length - 1] : { weight: 160, date: null };
  document.getElementById('currentWeightNum').textContent = latest.weight;
  const delta = latest.weight - 160;
  const deltaEl = document.getElementById('weightDelta');
  if (log.length) {
    deltaEl.textContent = `${delta <= 0 ? '▼' : '▲'} ${Math.abs(delta).toFixed(1)} lb since start · goal 145–150`;
    deltaEl.className = 'stat-delta' + (delta <= 0 ? ' good' : '');
  } else {
    deltaEl.textContent = 'No entries yet — log your first weigh-in';
  }

  const hist = document.getElementById('weightHistory');
  if (!log.length) {
    hist.innerHTML = '<div class="empty-state">No weight entries yet.</div>';
  } else {
    const recent = log.slice(-6).reverse();
    hist.innerHTML = recent.map(e => `<div class="log-entry"><span class="ldate">${fmtDateShort(e.date)}</span><span class="ltitle">${e.weight} lb</span></div>`).join('');
  }

  document.getElementById('saveWeightBtn').onclick = () => {
    const val = parseFloat(document.getElementById('weightInput').value);
    if (!val) return;
    const log = loadLS(LS_KEYS.weight, []);
    const today = todayISO();
    const idx = log.findIndex(e => e.date === today);
    if (idx >= 0) log[idx].weight = val; else log.push({ date: today, weight: val });
    log.sort((a, b) => a.date.localeCompare(b.date));
    saveLS(LS_KEYS.weight, log);
    document.getElementById('weightInput').value = '';
    renderWeight();
  };
}

// ---------- Benchmarks ----------
function renderBenchmarks() {
  const log = loadLS(LS_KEYS.benchmarks, []);
  const hist = document.getElementById('benchHistory');
  if (!log.length) {
    hist.innerHTML = '<div class="empty-state">No logged benchmarks yet — baseline is above.</div>';
  } else {
    const recent = log.slice(-8).reverse();
    hist.innerHTML = recent.map(e => `<div class="log-entry"><span class="ldate">${fmtDateShort(e.date)}</span><span class="ltitle">${e.name}: ${e.value}</span></div>`).join('');
  }
  document.getElementById('saveBenchBtn').onclick = () => {
    const name = document.getElementById('benchName').value.trim();
    const value = document.getElementById('benchValue').value.trim();
    if (!name || !value) return;
    const log = loadLS(LS_KEYS.benchmarks, []);
    log.push({ date: todayISO(), name, value });
    saveLS(LS_KEYS.benchmarks, log);
    document.getElementById('benchName').value = '';
    document.getElementById('benchValue').value = '';
    renderBenchmarks();
  };
}

// ---------- Plan Accordion ----------
function renderPlanAccordion() {
  const acc = document.getElementById('planAccordion');
  const phases = [];
  const phaseMap = {};
  PLAN.weeks.forEach(w => {
    if (!phaseMap[w.phase]) {
      phaseMap[w.phase] = { name: w.phase, weeks: [] };
      phases.push(phaseMap[w.phase]);
    }
    phaseMap[w.phase].weeks.push(w);
  });
  const today = todayISO();
  const currentWeek = findWeek(today);

  acc.innerHTML = phases.map(p => {
    const isCurrentPhase = currentWeek && currentWeek.phase === p.name;
    return `
    <div class="phase-group ${isCurrentPhase ? 'open' : ''}" data-phase="${p.name}">
      <div class="phase-head">
        <div>
          <div class="ptitle">${p.name}</div>
          <div class="pdates">${fmtDateShort(p.weeks[0].startDate)} – ${fmtDateShort(p.weeks[p.weeks.length - 1].endDate)} · ${p.weeks.length} weeks</div>
        </div>
        <div class="chev">▾</div>
      </div>
      <div class="phase-body">
        ${p.weeks.map(w => `
          <div class="week-row" data-week="${w.week}" style="cursor:pointer;">
            <span class="wk">Week ${w.week}${currentWeek && currentWeek.week === w.week ? ' · Active Now' : ''}</span>
            <span class="wdates">${fmtDateShort(w.startDate)}–${fmtDateShort(w.endDate)}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
  }).join('');

  acc.querySelectorAll('.phase-head').forEach(h => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
  });
  acc.querySelectorAll('.week-row').forEach(row => {
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const wn = +row.getAttribute('data-week');
      openWeekModal(wn);
    });
  });
}

function openWeekModal(weekNum) {
  const week = PLAN.weeks.find(w => w.week === weekNum);
  if (!week) return;
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <div class="block-eyebrow">${week.phase}</div>
    <div class="block-title" style="margin-bottom:12px;">Week ${week.week} · ${fmtDateShort(week.startDate)}–${fmtDateShort(week.endDate)}</div>
    ${week.days.map(d => `
      <div class="card" style="margin-bottom:8px;">
        <span class="badge ${TYPE_BADGE_CLASS[d.type] || ''}">${new Date(d.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'})} ${fmtDateShort(d.date)}</span>
        <div style="font-weight:700;font-size:14px;margin-top:8px;">${d.title}</div>
        <div style="font-size:12.5px;color:var(--text-dim);margin-top:6px;line-height:1.5;">${d.details}</div>
      </div>
    `).join('')}
  `;
  document.getElementById('modalOverlay').classList.add('open');
}
document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('modalOverlay').classList.remove('open');
});
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') e.target.classList.remove('open');
});

// ---------- Workout Log ----------
function renderWorkoutLog() {
  const log = loadLS(LS_KEYS.workoutLog, {});
  const entries = Object.values(log).sort((a, b) => b.date.localeCompare(a.date));
  const el = document.getElementById('workoutLog');
  if (!entries.length) {
    el.innerHTML = '<div class="empty-state">Completed sessions will show up here.</div>';
    return;
  }
  el.innerHTML = entries.map(e => `
    <div class="log-entry">
      <span class="ldate">${fmtDateShort(e.date)}</span>
      <span class="ltitle">${e.title}</span>
    </div>
  `).join('');
}

// ---------- Race Calendar ----------
function renderRaceCalendar() {
  const tbody = document.getElementById('raceCalendarBody');
  const races = [];
  PLAN.weeks.forEach(w => w.days.forEach(d => {
    if (d.raceDay) races.push(d);
  }));
  tbody.innerHTML = races.map(r => `
    <tr><td class="hl">${fmtDate(r.date)}</td><td>${r.title.replace('RACE DAY — ', '').replace('Road Race — ','')}</td><td>${r.type === 'race' && r.title.includes('Hyrox') ? 'Hyrox' : ''}</td></tr>
  `).join('');
}

// ---------- Coach's Notes ----------
function renderCoachNotes() {
  const el = document.getElementById('coachNotes');
  const notes = (PLAN.coachNotes || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  if (!notes.length) {
    el.innerHTML = '<div class="empty-state">No notes yet — check back after your first weekly check-in.</div>';
    return;
  }
  el.innerHTML = notes.map(n => `
    <div class="card" style="margin-bottom:10px;">
      <div class="block-eyebrow" style="margin-bottom:8px;">${fmtDate(n.date)}</div>
      <div class="mission-body" style="line-height:1.6;">${n.text}</div>
    </div>
  `).join('');
}

/*
 * goals.js — the progression brain.
 *
 * Rules (all configurable via Store.getGoals()):
 *   - A day is "met" if that day's total in the goal metric >= current goal.
 *   - You level up (and the goal steps up the ladder) once you've met the goal
 *     on `daysRequired` days within the last `windowDays` days — the classic
 *     "5 of 7" rule, NOT an all-or-nothing streak.
 *   - After a level-up the qualifying count resets (only days after the last
 *     increase count again), so the same good week can't level you twice.
 *   - Once the goal reaches the top of the ladder you keep leveling for
 *     sustaining it — progression never dead-ends.
 *
 * The goal metric is either "minutes" or "pages". Sessions in the *other*
 * unit still count toward all-time stats, just not toward the daily goal.
 */
(function () {
  "use strict";

  var DAY_MS = 24 * 60 * 60 * 1000;

  function goals() { return Store.getGoals(); }

  function ladder() {
    var g = goals();
    return g.laddersByMetric[g.metric] || [10, 15, 20, 30, 45, 60];
  }

  function isMaxGoal() {
    var g = goals();
    var l = ladder();
    return g.current >= l[l.length - 1];
  }

  function nextGoalValue() {
    var g = goals();
    var l = ladder();
    var idx = l.indexOf(g.current);
    if (idx === -1) {
      // current isn't on the ladder (e.g. metric changed) — pick the next higher rung
      for (var i = 0; i < l.length; i++) if (l[i] > g.current) return l[i];
      return g.current;
    }
    return idx < l.length - 1 ? l[idx + 1] : g.current;
  }

  // ---- daily aggregation --------------------------------------------------

  // { "2026-07-19": { minutes: 25, pages: 12 }, ... }
  function dailyTotals() {
    var totals = {};
    Store.getSessions().forEach(function (s) {
      var t = totals[s.date] || (totals[s.date] = { minutes: 0, pages: 0 });
      t.minutes += s.minutes || 0;
      t.pages += s.pages || 0;
    });
    return totals;
  }

  function metricValue(dayTotal) {
    if (!dayTotal) return 0;
    return goals().metric === "pages" ? dayTotal.pages : dayTotal.minutes;
  }

  function valueForDate(dateStr, totals) {
    totals = totals || dailyTotals();
    return metricValue(totals[dateStr]);
  }

  // The goal value that was in effect on a given date (from goal history).
  // Lets past days stay "met" even after the goal steps up.
  function goalForDate(dateStr) {
    var hist = goals().history || [];
    var applicable = goals().current;
    for (var i = 0; i < hist.length; i++) {
      if (hist[i].date <= dateStr) applicable = hist[i].value;
    }
    return applicable;
  }

  // "met" for DISPLAY (week dots, streak): judged against that day's own goal.
  function isDateMet(dateStr, totals) {
    var v = valueForDate(dateStr, totals);
    return v > 0 && v >= goalForDate(dateStr);
  }

  // Record a goal change so history stays accurate. `effectiveDate` defaults
  // to today; auto level-ups pass tomorrow so the day you *earned* the level
  // still counts as met against the goal you actually hit. Collapses same-date.
  function recordGoalChange(newValue, effectiveDate) {
    var g = goals();
    var date = effectiveDate || Store.localDateStr(new Date());
    var hist = (g.history || []).slice();
    if (hist.length && hist[hist.length - 1].date === date) {
      hist[hist.length - 1] = { date: date, value: newValue };
    } else {
      hist.push({ date: date, value: newValue });
    }
    return hist;
  }

  function tomorrowStr() {
    return Store.localDateStr(new Date(Date.now() + 24 * 60 * 60 * 1000));
  }

  // ---- window / level progress -------------------------------------------

  // Array of the last N days (oldest -> newest) with met flags.
  function windowDays(n) {
    n = n || goals().windowDays;
    var totals = dailyTotals();
    var out = [];
    var today = startOfDay(new Date());
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(today.getTime() - i * DAY_MS);
      var ds = Store.localDateStr(d);
      out.push({
        date: ds,
        dateObj: d,
        value: valueForDate(ds, totals),
        met: isDateMet(ds, totals)
      });
    }
    return out;
  }

  // Days that count toward the *next* level: met, inside the window, and
  // dated after the last increase.
  function qualifyingDays() {
    var g = goals();
    var days = windowDays(g.windowDays);
    var since = g.lastIncreaseDate; // ISO date string or null
    return days.filter(function (d) {
      if (!d.met) return false;
      if (since && d.date <= since) return false;
      return true;
    });
  }

  function progressToNextLevel() {
    var g = goals();
    var have = qualifyingDays().length;
    var need = g.daysRequired;
    return {
      have: Math.min(have, need),
      rawHave: have,
      need: need,
      ratio: Math.max(0, Math.min(1, have / need))
    };
  }

  // Called after every logged session. Returns a summary if a level-up
  // happened, otherwise null. Can chain multiple level-ups in one call
  // (rare, but keeps state consistent).
  function evaluateProgression() {
    var result = null;
    var guard = 0;
    while (guard++ < 10) {
      var prog = progressToNextLevel();
      if (prog.rawHave < prog.need) break;

      var g = goals();
      var wasMax = isMaxGoal();
      var newGoal = wasMax ? g.current : nextGoalValue();
      var today = Store.localDateStr(new Date());

      // read values BEFORE mutating — getProgress() returns a live reference,
      // so compute the new numbers first to avoid double-counting.
      var p = Store.getProgress();
      var newLevel = p.level + 1;
      var newIncreases = p.goalIncreases + 1;

      var patch = { current: newGoal, lastIncreaseDate: today };
      if (!wasMax) patch.history = recordGoalChange(newGoal, tomorrowStr());
      Store.setGoals(patch);
      Store.setProgress({ level: newLevel, goalIncreases: newIncreases });

      result = {
        leveledUp: true,
        newLevel: newLevel,
        newGoal: newGoal,
        goalRaised: !wasMax,
        metric: g.metric
      };
      // after resetting lastIncreaseDate to today, qualifying days -> 0,
      // so the loop naturally stops unless there were future-dated days.
    }
    return result;
  }

  // Did we just cross today's goal with this session? (for the celebration)
  // Compare the day value before vs after adding `justAdded` of the metric.
  function crossedGoalToday(justAddedMetricValue) {
    var g = goals();
    var todayStr = Store.localDateStr(new Date());
    var after = valueForDate(todayStr);
    var before = after - justAddedMetricValue;
    return before < g.current && after >= g.current;
  }

  // ---- stats --------------------------------------------------------------

  function weekView() {
    var days = windowDays(7);
    var metCount = days.filter(function (d) { return d.met; }).length;
    var g = goals();
    var totalValue = days.reduce(function (a, d) { return a + d.value; }, 0);
    return {
      days: days,
      metCount: metCount,
      goal: g.current,
      metric: g.metric,
      totalValue: totalValue,
      weeklyTarget: g.current * 7
    };
  }

  function allTimeStats() {
    var sessions = Store.getSessions();
    var totalMinutes = 0, totalPages = 0;
    sessions.forEach(function (s) {
      totalMinutes += s.minutes || 0;
      totalPages += s.pages || 0;
    });
    var finished = Store.getBooks("finished").length;
    return {
      totalMinutes: totalMinutes,
      totalPages: totalPages,
      booksFinished: finished,
      sessions: sessions.length
    };
  }

  // Non-punishing streak: consecutive met days ending today OR yesterday
  // (a one-day grace so a single missed day doesn't feel like failure).
  function streak() {
    var totals = dailyTotals();
    var today = startOfDay(new Date());
    var count = 0;
    var start = 0;

    // allow the streak to "end" yesterday without breaking the vibe
    if (!isDateMet(Store.localDateStr(today), totals)) start = 1;

    for (var i = start; i < 400; i++) {
      var d = new Date(today.getTime() - i * DAY_MS);
      if (isDateMet(Store.localDateStr(d), totals)) count++;
      else break;
    }
    // longest-ever run (for a gentle "personal best")
    var best = longestRun(totals);
    return { current: count, best: best };
  }

  function longestRun(totals) {
    var dates = Object.keys(totals).filter(function (d) {
      return isDateMet(d, totals); // judge each day by its own goal
    }).sort();
    var best = 0, run = 0, prev = null;
    dates.forEach(function (ds) {
      var d = new Date(ds + "T00:00:00");
      if (prev && (d.getTime() - prev.getTime()) === DAY_MS) run++;
      else run = 1;
      if (run > best) best = run;
      prev = d;
    });
    return best;
  }

  function todayValue() {
    return valueForDate(Store.localDateStr(new Date()));
  }

  // ---- utils --------------------------------------------------------------

  function startOfDay(d) {
    var x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function metricLabel(plural) {
    var m = goals().metric;
    if (m === "pages") return plural ? "pages" : "page";
    return plural ? "minutes" : "minute";
  }

  function metricShort() {
    return goals().metric === "pages" ? "pg" : "min";
  }

  window.Goals = {
    ladder: ladder,
    isMaxGoal: isMaxGoal,
    nextGoalValue: nextGoalValue,
    dailyTotals: dailyTotals,
    valueForDate: valueForDate,
    goalForDate: goalForDate,
    recordGoalChange: recordGoalChange,
    isDateMet: isDateMet,
    windowDays: windowDays,
    qualifyingDays: qualifyingDays,
    progressToNextLevel: progressToNextLevel,
    evaluateProgression: evaluateProgression,
    crossedGoalToday: crossedGoalToday,
    weekView: weekView,
    allTimeStats: allTimeStats,
    streak: streak,
    todayValue: todayValue,
    metricLabel: metricLabel,
    metricShort: metricShort
  };
})();

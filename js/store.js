/*
 * store.js — localStorage data layer for PageStep.
 *
 * The shape below is intentionally flat and relational so it can move to a
 * real database (e.g. Supabase) later with almost no reshaping:
 *   - `books`    -> a `books` table (one row per book)
 *   - `sessions` -> a `sessions` table (one row per reading session, FK book_id)
 *   - `goals` / `progress` / `settings` -> a single per-user settings row
 *
 * Everything lives under one localStorage key as JSON. All reads/writes go
 * through this module so the storage format stays in one place.
 */
(function () {
  "use strict";

  var KEY = "pagestep.v1";
  var SCHEMA_VERSION = 1;

  // ---- defaults -----------------------------------------------------------

  function defaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      books: [],
      sessions: [],
      goals: {
        metric: "minutes",              // "minutes" | "pages"
        current: 10,                    // current daily goal value
        laddersByMetric: {
          minutes: [10, 15, 20, 30, 45, 60],
          pages: [5, 10, 15, 20, 30, 40]
        },
        daysRequired: 5,                // hit the goal this many days...
        windowDays: 7,                  // ...within this rolling window to level up
        lastIncreaseDate: null,         // ISO date of the last goal increase (gates re-counting)
        // Goal value over time so past days are judged by the goal that was
        // active then (non-punishing). Migrates cleanly to a `goal_changes` table.
        history: [{ date: "1970-01-01", value: 10 }]
      },
      progress: {
        level: 1,
        goalIncreases: 0                // level = goalIncreases + 1
      },
      settings: {
        createdAt: new Date().toISOString(),
        name: "Lucas"                   // used in the welcome greeting
      }
    };
  }

  // ---- persistence --------------------------------------------------------

  var _state = null;

  function load() {
    if (_state) return _state;
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        _state = migrate(JSON.parse(raw));
      } else {
        _state = defaultState();
        save();
      }
    } catch (e) {
      console.warn("PageStep: could not read storage, starting fresh.", e);
      _state = defaultState();
    }
    return _state;
  }

  function migrate(state) {
    // Merge onto defaults so newly-added fields always exist.
    var base = defaultState();
    var merged = Object.assign({}, base, state);
    merged.goals = Object.assign({}, base.goals, state.goals || {});
    merged.goals.laddersByMetric = Object.assign(
      {}, base.goals.laddersByMetric, (state.goals || {}).laddersByMetric || {}
    );
    if (!Array.isArray(merged.goals.history) || !merged.goals.history.length) {
      merged.goals.history = [{ date: "1970-01-01", value: merged.goals.current }];
    }
    merged.progress = Object.assign({}, base.progress, state.progress || {});
    merged.settings = Object.assign({}, base.settings, state.settings || {});
    merged.books = Array.isArray(state.books) ? state.books : [];
    merged.sessions = Array.isArray(state.sessions) ? state.sessions : [];
    merged.schemaVersion = SCHEMA_VERSION;
    return merged;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(_state));
    } catch (e) {
      console.error("PageStep: could not save (storage full or blocked).", e);
    }
    // let the app re-render
    document.dispatchEvent(new CustomEvent("pagestep:changed"));
  }

  function uid() {
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  // ---- books --------------------------------------------------------------

  function getBooks(status) {
    var s = load();
    if (!status) return s.books.slice();
    return s.books.filter(function (b) { return b.status === status; });
  }

  function getBook(id) {
    return load().books.find(function (b) { return b.id === id; }) || null;
  }

  function addBook(data) {
    var s = load();
    var book = {
      id: uid(),
      title: (data.title || "Untitled").trim(),
      author: (data.author || "").trim(),
      coverUrl: data.coverUrl || null,
      pageCount: data.pageCount || null,
      currentPage: 0,
      status: "reading",               // "reading" | "finished"
      source: data.source || "manual", // "openlibrary" | "manual"
      olKey: data.olKey || null,
      addedAt: new Date().toISOString(),
      finishedAt: null
    };
    s.books.push(book);
    save();
    return book;
  }

  function updateBook(id, patch) {
    var s = load();
    var b = s.books.find(function (x) { return x.id === id; });
    if (!b) return null;
    Object.assign(b, patch);
    save();
    return b;
  }

  function finishBook(id) {
    return updateBook(id, { status: "finished", finishedAt: new Date().toISOString() });
  }

  function reopenBook(id) {
    return updateBook(id, { status: "reading", finishedAt: null });
  }

  function deleteBook(id) {
    var s = load();
    s.books = s.books.filter(function (b) { return b.id !== id; });
    // keep sessions? They reference a deleted book; remove them to stay clean.
    s.sessions = s.sessions.filter(function (se) { return se.bookId !== id; });
    save();
  }

  // ---- sessions -----------------------------------------------------------

  // A session records EITHER minutes or pages (or both). `date` is a local
  // calendar date string (YYYY-MM-DD) used for grouping by day.
  function addSession(data) {
    var s = load();
    var session = {
      id: uid(),
      bookId: data.bookId || null,
      date: data.date || localDateStr(new Date()),
      minutes: data.minutes ? Math.round(data.minutes) : 0,
      pages: data.pages ? Math.round(data.pages) : 0,
      createdAt: new Date().toISOString()
    };
    s.sessions.push(session);

    // advance the book's currentPage if pages were logged
    if (session.pages && session.bookId) {
      var b = s.books.find(function (x) { return x.id === session.bookId; });
      if (b) b.currentPage = (b.currentPage || 0) + session.pages;
    }
    save();
    return session;
  }

  function deleteSession(id) {
    var s = load();
    s.sessions = s.sessions.filter(function (se) { return se.id !== id; });
    save();
  }

  function getSessions() {
    return load().sessions.slice().sort(function (a, b) {
      return a.createdAt < b.createdAt ? 1 : -1; // newest first
    });
  }

  // ---- goals / progress ---------------------------------------------------

  function getGoals() { return load().goals; }
  function getProgress() { return load().progress; }
  function getSettings() { return load().settings; }

  function setGoals(patch) {
    var s = load();
    Object.assign(s.goals, patch);
    save();
    return s.goals;
  }

  function setProgress(patch) {
    var s = load();
    Object.assign(s.progress, patch);
    save();
    return s.progress;
  }

  function setSettings(patch) {
    var s = load();
    Object.assign(s.settings, patch);
    save();
    return s.settings;
  }

  // ---- helpers ------------------------------------------------------------

  // Local (not UTC) YYYY-MM-DD so "today" matches the reader's clock.
  function localDateStr(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function exportJSON() {
    return JSON.stringify(load(), null, 2);
  }

  function importJSON(text) {
    var parsed = JSON.parse(text);
    _state = migrate(parsed);
    save();
  }

  function resetAll() {
    _state = defaultState();
    save();
  }

  // expose
  window.Store = {
    KEY: KEY,
    load: load,
    save: save,
    uid: uid,
    localDateStr: localDateStr,
    // books
    getBooks: getBooks,
    getBook: getBook,
    addBook: addBook,
    updateBook: updateBook,
    finishBook: finishBook,
    reopenBook: reopenBook,
    deleteBook: deleteBook,
    // sessions
    addSession: addSession,
    deleteSession: deleteSession,
    getSessions: getSessions,
    // goals/progress
    getGoals: getGoals,
    getProgress: getProgress,
    getSettings: getSettings,
    setSettings: setSettings,
    setGoals: setGoals,
    setProgress: setProgress,
    // data mgmt
    exportJSON: exportJSON,
    importJSON: importJSON,
    resetAll: resetAll
  };
})();

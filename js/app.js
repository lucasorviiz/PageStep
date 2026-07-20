/*
 * app.js — view rendering and navigation for PageStep.
 * Views: home (dashboard) · library · log/read · progress.
 */
(function () {
  "use strict";

  var el = UI.el, esc = UI.esc;
  var viewEl = document.getElementById("view");
  var currentView = "home";

  // ---------------------------------------------------------------- routing

  function navigate(view) {
    currentView = view;
    render();
    // reflect on tabbar
    document.querySelectorAll(".tab").forEach(function (t) {
      t.classList.toggle("is-active", t.dataset.view === view);
    });
    viewEl.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function render() {
    document.getElementById("header-level").textContent = "Lv " + Store.getProgress().level;
    var fn = ({
      home: renderHome,
      library: renderLibrary,
      log: renderLog,
      progress: renderProgress
    })[currentView] || renderHome;
    viewEl.innerHTML = "";
    viewEl.appendChild(fn());
  }

  // ---------------------------------------------------------------- HOME

  function renderHome() {
    var frag = document.createDocumentFragment();
    var g = Store.getGoals();
    var todayVal = Goals.todayValue();
    var metToday = todayVal >= g.current;
    var unit = Goals.metricLabel(true);

    // Today's goal card
    var pct = Math.min(100, Math.round((todayVal / g.current) * 100));
    var goalCard = el("div", { class: "card" }, [
      el("div", { class: "today-goal" }, [
        el("div", { class: "today-goal__value", html:
          todayVal + "<small> / " + g.current + " " + Goals.metricShort() + "</small>" }),
        el("div", { class: "today-goal__sub" + (metToday ? " today-goal__met" : ""), text:
          metToday ? "✓ Today's goal met — lovely." : "Today's reading so far" })
      ]),
      el("div", { class: "bar mt-8" }, [
        el("div", { class: "bar__fill" + (metToday ? " bar__fill--gold" : ""),
          style: "width:" + pct + "%" })
      ])
    ]);
    frag.appendChild(goalCard);

    // Big Start Reading button
    var start = el("button", { class: "hero-btn mt-16", onclick: function () { navigate("log"); } }, [
      el("span", { html: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>' }),
      "Start Reading"
    ]);
    frag.appendChild(start);

    // Level + progress to next level
    frag.appendChild(el("div", { class: "section-title", text: "Your progress" }));
    frag.appendChild(levelCard());

    // This week
    frag.appendChild(el("div", { class: "section-title", text: "This week" }));
    frag.appendChild(weekCard());

    // Currently reading quick list
    var reading = Store.getBooks("reading");
    frag.appendChild(el("div", { class: "row-between", style: "margin:22px 4px 10px" }, [
      el("div", { class: "section-title", style: "margin:0", text: "Currently reading" }),
      el("button", { class: "link", text: "Library →", onclick: function () { navigate("library"); } })
    ]));
    if (reading.length) {
      var card = el("div", { class: "card", style: "padding:6px" });
      reading.slice(0, 3).forEach(function (b) { card.appendChild(bookRow(b)); });
      frag.appendChild(card);
    } else {
      frag.appendChild(emptyState("📚", "No books yet", "Add one to start logging sessions.",
        "Find a book", function () { openSearchModal(); }));
    }

    return frag;
  }

  function levelCard() {
    var p = Store.getProgress();
    var prog = Goals.progressToNextLevel();
    var g = Store.getGoals();
    var C = 2 * Math.PI * 42; // ring circumference (r=42)
    var offset = C * (1 - prog.ratio);

    var atMax = Goals.isMaxGoal();
    var nextLine = atMax
      ? "Top goal reached — keep it up to keep leveling"
      : "Hit " + g.current + " " + Goals.metricShort() + " on " + prog.need +
        " days (any 7) to reach Level " + (p.level + 1);

    return el("div", { class: "card level-hero" }, [
      el("div", { class: "ring" }, [
        el("div", { class: "", html:
          '<svg width="96" height="96" viewBox="0 0 96 96">' +
          '<circle class="ring__track" cx="48" cy="48" r="42"/>' +
          '<circle class="ring__value" cx="48" cy="48" r="42" ' +
          'stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '"/>' +
          '</svg>' }),
        el("div", { class: "ring__label" }, [
          el("div", { class: "ring__lvl-num", text: p.level }),
          el("div", { class: "ring__lvl-cap", text: "Level" })
        ])
      ]),
      el("div", { style: "flex:1" }, [
        el("div", { class: "row-between" }, [
          el("strong", { text: atMax ? "Sustaining top goal" : "Progress to next level" }),
          el("span", { class: "pill", text: prog.have + "/" + prog.need + " days" })
        ]),
        el("p", { class: "book-sub", style: "margin-top:8px", text: nextLine })
      ])
    ]);
  }

  function weekCard() {
    var wv = Goals.weekView();
    var wd = ["S", "M", "T", "W", "T", "F", "S"];
    var todayStr = Store.localDateStr(new Date());
    var week = el("div", { class: "week" });
    wv.days.forEach(function (d) {
      var dotCls = "week__dot";
      if (d.met) dotCls += " week__dot--met";
      else if (d.value > 0) dotCls += " week__dot--partial";
      if (d.date === todayStr) dotCls += " week__dot--today";
      week.appendChild(el("div", { class: "week__day" }, [
        el("div", { class: dotCls, text: d.met ? "✓" : (d.value > 0 ? "·" : "") }),
        el("div", { class: "week__label", text: wd[d.dateObj.getDay()] })
      ]));
    });

    return el("div", { class: "card" }, [
      el("div", { class: "row-between" }, [
        el("strong", { text: "Goal met " + wv.metCount + " of 7 days" }),
        el("span", { class: "muted", style: "font-size:13px",
          text: wv.totalValue + " " + Goals.metricShort() + " total" })
      ]),
      week,
      el("p", { class: "book-sub center", style: "margin-top:6px",
        text: encourage(wv.metCount) })
    ]);
  }

  function encourage(metCount) {
    if (metCount >= 6) return "Wonderful rhythm this week. 🌿";
    if (metCount >= 4) return "You're building something steady.";
    if (metCount >= 1) return "Every day counts — nice start.";
    return "A fresh week. One session is all it takes to begin.";
  }

  // ---------------------------------------------------------------- LIBRARY

  function renderLibrary() {
    var frag = document.createDocumentFragment();

    var actions = el("div", { style: "display:flex; gap:10px; margin-top:8px" }, [
      el("button", { class: "btn btn--primary", style: "flex:1", onclick: openSearchModal }, [
        el("span", { html: '<svg width="18" height="18" viewBox="0 0 24 24" style="fill:currentColor"><path d="M10 2a8 8 0 1 0 4.9 14.32l5.39 5.39 1.42-1.42-5.39-5.39A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z"/></svg>' }),
        "Search books"
      ]),
      el("button", { class: "btn", onclick: openManualAddModal, text: "Add manually" })
    ]);
    frag.appendChild(actions);

    var reading = Store.getBooks("reading");
    frag.appendChild(el("div", { class: "section-title", text: "Currently reading (" + reading.length + ")" }));
    if (reading.length) {
      var c1 = el("div", { class: "card", style: "padding:6px" });
      reading.forEach(function (b) { c1.appendChild(bookRow(b)); });
      frag.appendChild(c1);
    } else {
      frag.appendChild(el("p", { class: "muted", style: "padding:10px 6px",
        text: "Nothing here yet — search for a book or add one manually." }));
    }

    var finished = Store.getBooks("finished");
    frag.appendChild(el("div", { class: "section-title", text: "Finished (" + finished.length + ")" }));
    if (finished.length) {
      var c2 = el("div", { class: "card", style: "padding:6px" });
      finished.forEach(function (b) { c2.appendChild(bookRow(b)); });
      frag.appendChild(c2);
    } else {
      frag.appendChild(el("p", { class: "muted", style: "padding:10px 6px",
        text: "Books you finish will collect here. 🌱" }));
    }

    return frag;
  }

  function bookRow(book) {
    var sub = [];
    if (book.author) sub.push(book.author);
    var meta = [];
    if (book.pageCount) {
      if (book.status === "reading" && book.currentPage) {
        meta.push("p." + book.currentPage + " / " + book.pageCount);
      } else {
        meta.push(book.pageCount + " pages");
      }
    }
    var row = el("div", { class: "book-row", onclick: function () { openBookDetail(book.id); } }, [
      UI.coverEl(book),
      el("div", { class: "book-meta" }, [
        el("div", { class: "book-title", text: book.title }),
        el("div", { class: "book-author", text: book.author || "Unknown author" }),
        meta.length ? el("div", { class: "book-sub", text: meta.join(" · ") }) : null
      ]),
      el("div", { class: "chevron", text: "›" })
    ]);
    return row;
  }

  // ---------------------------------------------------------------- SEARCH / ADD

  function openSearchModal() {
    var input = el("input", { class: "input", type: "search", placeholder: "Title, author, ISBN…",
      autocapitalize: "none", autocomplete: "off" });
    var results = el("div", { class: "result-list" });
    var hint = el("p", { class: "muted center", style: "padding:20px 10px",
      text: "Search millions of books via Open Library." });
    results.appendChild(hint);

    var manualLink = el("p", { class: "center mt-16" }, [
      el("button", { class: "link", text: "Can't find it? Add manually",
        onclick: function () { UI.closeModal(); openManualAddModal(); } })
    ]);

    var body = el("div", {}, [
      el("div", { class: "field" }, [input]),
      results, manualLink
    ]);
    UI.openModal("Search books", body);
    setTimeout(function () { input.focus(); }, 250);

    var timer = null, lastQ = "";
    input.addEventListener("input", function () {
      var q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 2) { results.innerHTML = ""; results.appendChild(hint); return; }
      timer = setTimeout(function () { doSearch(q); }, 350);
    });

    function doSearch(q) {
      lastQ = q;
      results.innerHTML = "";
      results.appendChild(el("div", { class: "spinner" }));
      BookAPI.search(q).then(function (list) {
        if (q !== lastQ) return; // stale
        renderResults(list);
      }).catch(function () {
        if (q !== lastQ) return;
        results.innerHTML = "";
        results.appendChild(el("p", { class: "muted center", style: "padding:20px" },
          ["Couldn't reach Open Library. Check your connection, or ",
           el("button", { class: "link", text: "add it manually",
             onclick: function () { UI.closeModal(); openManualAddModal(q); } }), "."]));
      });
    }

    function renderResults(list) {
      results.innerHTML = "";
      if (!list.length) {
        results.appendChild(el("p", { class: "muted center", style: "padding:20px",
          text: "No matches. Try a different spelling or add it manually." }));
        return;
      }
      list.forEach(function (r) {
        var row = el("div", { class: "book-row" }, [
          UI.coverEl(r),
          el("div", { class: "book-meta" }, [
            el("div", { class: "book-title", text: r.title }),
            el("div", { class: "book-author", text: r.author }),
            el("div", { class: "book-sub", text:
              [r.year, r.pageCount ? r.pageCount + " pages" : null].filter(Boolean).join(" · ") })
          ]),
          el("button", { class: "btn btn--primary", style: "padding:8px 14px", text: "Add",
            onclick: function (e) {
              e.stopPropagation();
              Store.addBook(r);
              UI.closeModal();
              UI.toast("Added to Currently Reading");
              if (currentView === "library" || currentView === "home") render();
            } })
        ]);
        results.appendChild(row);
      });
    }
  }

  function openManualAddModal(prefillTitle) {
    var title = el("input", { class: "input", placeholder: "Book title", value: prefillTitle || "" });
    var author = el("input", { class: "input", placeholder: "Author (optional)" });
    var pages = el("input", { class: "input", type: "number", inputmode: "numeric",
      placeholder: "Total pages (optional)", min: "1" });

    var body = el("div", {}, [
      el("div", { class: "field" }, [el("label", { text: "Title" }), title]),
      el("div", { class: "field" }, [el("label", { text: "Author" }), author]),
      el("div", { class: "field" }, [el("label", { text: "Page count" }), pages]),
      el("button", { class: "btn btn--primary btn--block", text: "Add to library",
        onclick: function () {
          if (!title.value.trim()) { UI.toast("Give it a title first"); title.focus(); return; }
          Store.addBook({
            title: title.value, author: author.value,
            pageCount: pages.value ? parseInt(pages.value, 10) : null,
            source: "manual"
          });
          UI.closeModal();
          UI.toast("Added to Currently Reading");
          if (currentView === "library" || currentView === "home") render();
        } })
    ]);
    UI.openModal("Add a book", body);
    setTimeout(function () { title.focus(); }, 250);
  }

  // ---------------------------------------------------------------- BOOK DETAIL

  function openBookDetail(id) {
    var book = Store.getBook(id);
    if (!book) return;
    var sessions = Store.getSessions().filter(function (s) { return s.bookId === id; });
    var mins = sessions.reduce(function (a, s) { return a + s.minutes; }, 0);
    var pgs = sessions.reduce(function (a, s) { return a + s.pages; }, 0);

    var body = el("div", {}, [
      el("div", { style: "display:flex; gap:14px; align-items:flex-start" }, [
        UI.coverEl(book, true),
        el("div", { style: "flex:1; min-width:0" }, [
          el("h2", { style: "font-size:18px", text: book.title }),
          el("p", { class: "muted", text: book.author || "Unknown author" }),
          book.pageCount ? el("p", { class: "book-sub mt-8",
            text: "p." + (book.currentPage || 0) + " of " + book.pageCount }) : null,
          el("div", { class: "mt-8" }, [
            el("span", { class: "pill" + (book.status === "finished" ? " pill--gold" : ""),
              text: book.status === "finished" ? "Finished" : "Reading" })
          ])
        ])
      ]),

      el("div", { class: "stat-grid mt-16" }, [
        el("div", { class: "stat" }, [
          el("div", { class: "stat__num", text: UI.fmtDuration(mins) }),
          el("div", { class: "stat__label", text: "time" })]),
        el("div", { class: "stat" }, [
          el("div", { class: "stat__num", text: pgs }),
          el("div", { class: "stat__label", text: "pages" })]),
        el("div", { class: "stat" }, [
          el("div", { class: "stat__num", text: sessions.length }),
          el("div", { class: "stat__label", text: "sessions" })])
      ]),

      el("div", { class: "mt-16", style: "display:flex; flex-direction:column; gap:10px" }, [
        book.status === "reading"
          ? el("button", { class: "btn btn--primary btn--block", text: "📖 Log a session",
              onclick: function () { UI.closeModal(); navigate("log"); openLogForBook(id); } })
          : null,
        book.status === "reading"
          ? el("button", { class: "btn btn--block", text: "✓ Mark as finished",
              onclick: function () {
                Store.finishBook(id); UI.closeModal();
                UI.toast("Finished — nicely done!"); render();
              } })
          : el("button", { class: "btn btn--block", text: "↩ Move back to reading",
              onclick: function () { Store.reopenBook(id); UI.closeModal(); render(); } }),
        el("button", { class: "btn btn--danger btn--block", text: "Remove from library",
          onclick: function () {
            if (confirm("Remove \"" + book.title + "\" and its sessions?")) {
              Store.deleteBook(id); UI.closeModal(); UI.toast("Removed"); render();
            }
          } })
      ])
    ]);
    UI.openModal(null, body);
  }

  // ---------------------------------------------------------------- LOG / READ

  var pendingBookId = null; // set when arriving from a specific book
  function openLogForBook(id) { pendingBookId = id; render(); }

  function renderLog() {
    var frag = document.createDocumentFragment();
    var reading = Store.getBooks("reading");

    if (!reading.length) {
      frag.appendChild(emptyState("📖", "Add a book first",
        "Pick something from the library, then log your reading here.",
        "Go to library", function () { navigate("library"); }));
      return frag;
    }

    // book picker
    var selectedId = pendingBookId && Store.getBook(pendingBookId) ? pendingBookId : reading[0].id;
    pendingBookId = null;

    frag.appendChild(el("div", { class: "section-title", text: "Reading" }));
    var select = el("select", { class: "input" });
    reading.forEach(function (b) {
      var o = el("option", { value: b.id, text: b.title + (b.author ? " — " + b.author : "") });
      if (b.id === selectedId) o.selected = true;
      select.appendChild(o);
    });
    frag.appendChild(el("div", { class: "card" }, [select]));

    // mode toggle: Timer / Manual
    var modeState = { mode: "timer" };
    var seg = el("div", { class: "seg mt-16", style: "display:flex; width:100%" }, [
      segBtn("timer", "Timer", true),
      segBtn("manual", "Manual entry")
    ]);
    var pane = el("div", { class: "mt-16" });
    frag.appendChild(el("div", { class: "center" }, [seg]));
    frag.appendChild(pane);

    function segBtn(mode, label, active) {
      return el("button", { class: active ? "is-active" : "", text: label, style: "flex:1",
        onclick: function () {
          modeState.mode = mode;
          seg.querySelectorAll("button").forEach(function (b) { b.classList.remove("is-active"); });
          this.classList.add("is-active");
          renderPane();
        } });
    }

    function renderPane() {
      pane.innerHTML = "";
      pane.appendChild(modeState.mode === "timer"
        ? timerPane(function () { return select.value; })
        : manualPane(function () { return select.value; }));
    }
    renderPane();

    return frag;
  }

  // --- timer ---
  var timer = { running: false, startTs: 0, elapsed: 0, interval: null };

  function timerPane(getBookId) {
    var display = el("div", { class: "timer-display", text: "00:00" });
    var book = Store.getBook(getBookId());
    var pane = el("div", { class: "card" }, [
      el("div", { class: "timer-book", text: book ? book.title : "" }),
      display
    ]);

    var actions = el("div", { class: "timer-actions" });
    var primary = el("button", { class: "btn btn--primary", text: "Start" });
    var stop = el("button", { class: "btn", text: "Finish & save", style: "display:none" });
    actions.appendChild(primary);
    actions.appendChild(stop);
    pane.appendChild(actions);
    pane.appendChild(el("p", { class: "muted center mt-16", style: "font-size:13px",
      text: "The timer keeps running if you lock your phone." }));

    function tick() {
      var ms = timer.elapsed + (timer.running ? Date.now() - timer.startTs : 0);
      var total = Math.floor(ms / 1000);
      var m = Math.floor(total / 60), s = total % 60;
      display.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    }

    // reset any prior timer when (re)entering
    timer = { running: false, startTs: 0, elapsed: 0, interval: null };
    tick();

    primary.addEventListener("click", function () {
      if (!timer.running) {
        timer.running = true;
        timer.startTs = Date.now();
        timer.interval = setInterval(tick, 250);
        primary.textContent = "Pause";
        primary.classList.remove("btn--primary");
        stop.style.display = "";
      } else {
        timer.running = false;
        timer.elapsed += Date.now() - timer.startTs;
        clearInterval(timer.interval);
        primary.textContent = "Resume";
        primary.classList.add("btn--primary");
      }
    });

    stop.addEventListener("click", function () {
      if (timer.running) timer.elapsed += Date.now() - timer.startTs;
      timer.running = false;
      clearInterval(timer.interval);
      var minutes = Math.max(1, Math.round(timer.elapsed / 60000));
      commitSession({ bookId: getBookId(), minutes: minutes });
    });

    return pane;
  }

  // --- manual entry ---
  function manualPane(getBookId) {
    var unitState = { unit: "minutes" };
    var value = el("input", { class: "input", type: "number", inputmode: "numeric",
      placeholder: "0", min: "1", style: "font-size:22px; text-align:center; padding:16px" });

    var unitSeg = el("div", { class: "seg", style: "display:flex; width:100%" }, [
      unitBtn("minutes", "Minutes", true),
      unitBtn("pages", "Pages")
    ]);

    function unitBtn(u, label, active) {
      return el("button", { class: active ? "is-active" : "", text: label, style: "flex:1",
        onclick: function () {
          unitState.unit = u;
          unitSeg.querySelectorAll("button").forEach(function (b) { b.classList.remove("is-active"); });
          this.classList.add("is-active");
        } });
    }

    var dateInput = el("input", { class: "input", type: "date", value: Store.localDateStr(new Date()) });

    return el("div", { class: "card" }, [
      el("div", { class: "center", style: "margin-bottom:14px" }, [unitSeg]),
      el("div", { class: "field" }, [value]),
      el("div", { class: "field" }, [el("label", { text: "Date" }), dateInput]),
      el("button", { class: "btn btn--primary btn--block", text: "Save session",
        onclick: function () {
          var v = parseInt(value.value, 10);
          if (!v || v < 1) { UI.toast("Enter a number first"); value.focus(); return; }
          var data = { bookId: getBookId(), date: dateInput.value };
          data[unitState.unit] = v;
          commitSession(data);
        } })
    ]);
  }

  // Save a session, then run progression + celebration.
  function commitSession(data) {
    var metricBefore = Goals.metricLabel(); // unused but keeps intent clear
    var g = Store.getGoals();
    // value added in the goal metric (0 if this session was in the other unit)
    var addedMetricValue = g.metric === "pages" ? (data.pages || 0) : (data.minutes || 0);
    var isToday = (data.date || Store.localDateStr(new Date())) === Store.localDateStr(new Date());

    Store.addSession(data);

    var crossed = isToday && addedMetricValue > 0 && Goals.crossedGoalToday(addedMetricValue);
    var levelResult = Goals.evaluateProgression();

    // feedback
    if (levelResult && levelResult.leveledUp) {
      UI.celebrate({
        emoji: "🌟",
        title: "Level " + levelResult.newLevel + "!",
        body: levelResult.goalRaised
          ? "Your daily goal just grew to " + levelResult.newGoal + " " + Goals.metricShort() +
            ". You've earned it."
          : "You're sustaining your top goal beautifully."
      });
    } else if (crossed) {
      UI.celebrate({
        emoji: "✨",
        title: "Goal met!",
        body: "That's today's reading done. Small steps, real progress."
      });
    } else {
      UI.toast("Session saved 🌿");
    }

    navigate("home");
  }

  // ---------------------------------------------------------------- PROGRESS

  function renderProgress() {
    var frag = document.createDocumentFragment();
    var stats = Goals.allTimeStats();
    var st = Goals.streak();
    var p = Store.getProgress();

    frag.appendChild(el("div", { class: "section-title", text: "Level" }));
    frag.appendChild(levelCard());

    frag.appendChild(el("div", { class: "section-title", text: "This week" }));
    frag.appendChild(weekCard());

    // streak — gentle, never shaming
    frag.appendChild(el("div", { class: "section-title", text: "Consistency" }));
    frag.appendChild(el("div", { class: "card row-between" }, [
      el("div", {}, [
        el("div", { style: "font-size:26px; font-weight:800", html:
          "🔥 " + st.current + " <span style='font-size:15px; font-weight:600; color:var(--muted)'>day" +
          (st.current === 1 ? "" : "s") + "</span>" }),
        el("div", { class: "book-sub", text: st.current === 0
          ? "Start a new run today — no pressure."
          : "Current run of hitting your goal" })
      ]),
      el("div", { class: "center" }, [
        el("div", { class: "pill pill--gold", text: "Best: " + st.best + "d" })
      ])
    ]));

    // all-time
    frag.appendChild(el("div", { class: "section-title", text: "All-time" }));
    frag.appendChild(el("div", { class: "stat-grid" }, [
      el("div", { class: "stat" }, [
        el("div", { class: "stat__num", text: UI.fmtDuration(stats.totalMinutes) }),
        el("div", { class: "stat__label", text: "total time" })]),
      el("div", { class: "stat" }, [
        el("div", { class: "stat__num", text: stats.totalPages }),
        el("div", { class: "stat__label", text: "pages read" })]),
      el("div", { class: "stat" }, [
        el("div", { class: "stat__num", text: stats.booksFinished }),
        el("div", { class: "stat__label", text: "books done" })])
    ]));

    // recent sessions
    var sessions = Store.getSessions().slice(0, 8);
    frag.appendChild(el("div", { class: "section-title", text: "Recent sessions" }));
    if (sessions.length) {
      var card = el("div", { class: "card", style: "padding:6px" });
      sessions.forEach(function (s) {
        var b = Store.getBook(s.bookId);
        var parts = [];
        if (s.minutes) parts.push(UI.fmtDuration(s.minutes));
        if (s.pages) parts.push(s.pages + " pg");
        card.appendChild(el("div", { class: "book-row" }, [
          el("div", { class: "book-meta" }, [
            el("div", { class: "book-title", text: b ? b.title : "(removed book)" }),
            el("div", { class: "book-author", text: UI.fmtDateShort(s.date) + " · " + parts.join(" · ") })
          ]),
          el("button", { class: "link", text: "Delete", onclick: function () {
            if (confirm("Delete this session?")) { Store.deleteSession(s.id); render(); }
          } })
        ]));
      });
      frag.appendChild(card);
    } else {
      frag.appendChild(el("p", { class: "muted", style: "padding:10px 6px",
        text: "Your logged sessions will appear here." }));
    }

    // settings
    frag.appendChild(el("div", { class: "section-title", text: "Settings" }));
    frag.appendChild(el("div", { class: "card", style: "display:flex; flex-direction:column; gap:8px" }, [
      el("button", { class: "btn btn--block", text: "⚙ Goal settings", onclick: openSettingsModal }),
      el("button", { class: "btn btn--block", text: "⭳ Export my data", onclick: exportData }),
      el("button", { class: "btn btn--block", text: "⭱ Import data", onclick: importData })
    ]));

    return frag;
  }

  function openSettingsModal() {
    var g = Store.getGoals();
    var metric = el("div", { class: "seg", style: "display:flex; width:100%" }, [
      mBtn("minutes", "Minutes"), mBtn("pages", "Pages")
    ]);
    var metricState = { metric: g.metric };
    function mBtn(m, label) {
      return el("button", { class: g.metric === m ? "is-active" : "", text: label, style: "flex:1",
        onclick: function () {
          metricState.metric = m;
          metric.querySelectorAll("button").forEach(function (b) { b.classList.remove("is-active"); });
          this.classList.add("is-active");
        } });
    }

    var goalVal = el("input", { class: "input", type: "number", value: g.current, min: "1" });
    var daysReq = el("input", { class: "input", type: "number", value: g.daysRequired, min: "1", max: "7" });
    var windowD = el("input", { class: "input", type: "number", value: g.windowDays, min: "1", max: "30" });

    var body = el("div", {}, [
      el("div", { class: "field" }, [el("label", { text: "Goal unit" }), metric]),
      el("p", { class: "muted", style: "font-size:13px; margin:-6px 2px 14px",
        text: "Days are counted in this unit toward your daily goal." }),
      el("div", { class: "field" }, [el("label", { text: "Current daily goal" }), goalVal]),
      el("div", { class: "field" }, [el("label", { text: "Days required to level up" }), daysReq]),
      el("div", { class: "field" }, [el("label", { text: "…within this many days (window)" }), windowD]),
      el("button", { class: "btn btn--primary btn--block", text: "Save settings",
        onclick: function () {
          var changingMetric = metricState.metric !== g.metric;
          var patch = {
            metric: metricState.metric,
            current: Math.max(1, parseInt(goalVal.value, 10) || g.current),
            daysRequired: Math.min(30, Math.max(1, parseInt(daysReq.value, 10) || g.daysRequired)),
            windowDays: Math.min(30, Math.max(1, parseInt(windowD.value, 10) || g.windowDays))
          };
          // if switching metric and the goal was left at the old default, snap to
          // the new ladder's first rung for a sensible starting point.
          if (changingMetric && parseInt(goalVal.value, 10) === g.current) {
            var ladder = g.laddersByMetric[metricState.metric];
            if (ladder && !ladder.includes(patch.current)) patch.current = ladder[0];
          }
          // keep goal history accurate so past days keep their old goal
          if (patch.current !== g.current || changingMetric) {
            patch.history = Goals.recordGoalChange(patch.current);
          }
          Store.setGoals(patch);
          UI.closeModal(); UI.toast("Settings saved"); render();
        } }),
      el("button", { class: "btn btn--danger btn--block mt-8", text: "Reset all data",
        onclick: function () {
          if (confirm("Erase all books, sessions and progress? This can't be undone.")) {
            Store.resetAll(); UI.closeModal(); navigate("home"); UI.toast("Fresh start 🌱");
          }
        } })
    ]);
    UI.openModal("Goal settings", body);
  }

  function exportData() {
    var data = Store.exportJSON();
    var blob = new Blob([data], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: "pagestep-backup.json" });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    UI.toast("Backup downloaded");
  }

  function importData() {
    var input = el("input", { type: "file", accept: "application/json", style: "display:none" });
    input.addEventListener("change", function () {
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try { Store.importJSON(reader.result); UI.toast("Data imported"); navigate("home"); }
        catch (e) { UI.toast("That file couldn't be read"); }
      };
      reader.readAsText(file);
    });
    document.body.appendChild(input); input.click(); input.remove();
  }

  // ---------------------------------------------------------------- shared

  function emptyState(emoji, title, body, cta, onCta) {
    return el("div", { class: "empty" }, [
      el("div", { class: "empty__emoji", text: emoji }),
      el("h3", { text: title }),
      el("p", { class: "mt-8", text: body }),
      cta ? el("button", { class: "btn btn--primary mt-16", text: cta, onclick: onCta }) : null
    ]);
  }

  // ---------------------------------------------------------------- boot

  document.getElementById("tabbar").addEventListener("click", function (e) {
    var btn = e.target.closest(".tab");
    if (btn) navigate(btn.dataset.view);
  });

  // re-render on data change only when a modal isn't capturing attention
  document.addEventListener("pagestep:changed", function () {
    document.getElementById("header-level").textContent = "Lv " + Store.getProgress().level;
  });

  navigate("home");

  // service worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function (e) {
        console.warn("SW registration failed", e);
      });
    });
  }
})();

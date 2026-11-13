(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var STILL = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var RING = 263.9;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var TYPES = { qc: "Quantitative comparison", mc: "Multiple choice" };
  var LETTERS = "ABCDEFGH";

  // shortcut: progress lives only in this phone's browser storage; stage 4 adds the realtime backup to the private repo.
  function load(k, fallback) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function clampTarget(n) { return Math.max(1, Math.min(30, Math.round(n) || 5)); }

  var settings = load("44d.settings", {});
  if (!settings || typeof settings !== "object") settings = {};
  settings.target = clampTarget(settings.target);
  if (typeof settings.name !== "string") settings.name = "ND";
  var log = load("44d.log", []);
  if (!Array.isArray(log)) log = [];

  var q = null, shown = 0, picked = -1, solved = false, answers = [];
  var shownAt = 0, startedAt = 0, tick = null, lock = null, introTimer = null;
  var sel = 5, firstPaint = true, eraseArmed = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function fmt(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
  }
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  // ---------- home ----------
  function render() {
    var today = new Date(), tk = Stats.key(today), target = settings.target;
    var days = Stats.byDay(log);
    var done = days[tk] ? days[tk].n : 0;
    var left = Math.max(0, target - done);

    $("hello").textContent = settings.name ? "Welcome, " + settings.name : "Welcome";
    $("left").textContent = left ? plural(left, "question") + " left today" : "Target hit for today";
    $("start").textContent = left ? (q && !solved ? "Continue session" : "Start session") : "Keep practising";
    $("ring-done").textContent = done;
    $("ring-target").textContent = target;
    $("ring-box").setAttribute("aria-label", "Today: " + done + " of " + target + " done");
    var off = RING * (1 - Math.min(1, done / target));
    setTimeout(function () { $("ring").style.strokeDashoffset = off; }, firstPaint ? 120 : 0);
    firstPaint = false;

    $("count").textContent = "Today: " + done + " of " + target;
    var dots = $("dots");
    dots.textContent = "";
    if (target <= 12) {
      for (var d = 0; d < target; d++) dots.appendChild(el("span", "dot" + (d < done ? " done" : d === done ? " now" : "")));
    }
    $("streak-n").textContent = Stats.streak(days, today, target);

    var strip = $("strip");
    strip.textContent = "";
    Stats.lastDays(today, 14).forEach(function (date, i) {
      var k = Stats.key(date), share = Stats.share(days, k, target, tk);
      var cell = el("span", "cell" + (k === tk ? " today" : ""));
      if (share > 0) {
        var fill = el("i");
        fill.style.opacity = share >= 1 ? 1 : (0.25 + 0.5 * share).toFixed(2);
        cell.appendChild(fill);
      }
      cell.style.setProperty("--i", i);
      strip.appendChild(cell);
    });

    var cal = $("cal");
    cal.textContent = "";
    ["M", "T", "W", "T", "F", "S", "S"].forEach(function (x) { cal.appendChild(el("span", "wd", x)); });
    Stats.weeks(today, 4).forEach(function (mon) {
      for (var i = 0; i < 7; i++) {
        var date = Stats.addDays(mon, i), k = Stats.key(date), share = Stats.share(days, k, target, tk);
        var cls = k === tk ? " today" : date > today ? " future" : share >= 1 ? " hit" : share > 0 ? " part" : "";
        cal.appendChild(el("span", "day" + cls, date.getDate()));
      }
    });

    var weeks = Stats.weeks(today, 6);
    var totals = weeks.map(function (mon) { return Stats.weekTotal(days, mon); });
    var names = weeks.map(function (mon) { return MONTHS[mon.getMonth()] + " " + mon.getDate(); });
    var weekly = target * 7;
    var max = Math.max.apply(null, totals.concat(weekly)) * 1.12;
    $("total-n").textContent = log.length;
    var plot = $("plot"), xl = $("xlabels");
    plot.textContent = "";
    xl.textContent = "";
    var line = el("div", "target");
    line.style.bottom = (weekly / max * 100) + "%";
    plot.appendChild(line);
    totals.forEach(function (t, i) {
      var col = el("button", "col");
      col.type = "button";
      col.setAttribute("aria-pressed", i === sel ? "true" : "false");
      col.setAttribute("aria-label", "Week of " + names[i] + ": " + plural(t, "question"));
      var bar = el("i");
      bar.style.height = (t / max * 100) + "%";
      bar.style.setProperty("--i", i);
      col.appendChild(bar);
      col.addEventListener("click", function () { sel = i; render(); $("plot").children[i + 1].focus(); });
      plot.appendChild(col);
      xl.appendChild(el("span", "", names[i]));
    });
    $("readout").textContent = "Week of " + names[sel] + ": " + plural(totals[sel], "question") + (sel === 5 ? " so far" : "");
    $("target-note").textContent = log.length
      ? "Dashed line is your weekly target of " + weekly + ". Tap a bar to see that week."
      : "Nothing logged yet. Your weeks fill in as you practise. Dashed line is your weekly target of " + weekly + ".";

    $("target-n").textContent = target;
    $("history-note").textContent = log.length
      ? plural(log.length, "question") + " logged on this phone. Erasing clears your streak, chart and log."
      : "Nothing logged yet.";
    $("erase").disabled = !log.length;
  }

  // ---------- question ----------
  function openQuestion() {
    // shortcut: cycles through the five samples in order; the question bank and spaced repeats arrive in stage 3.
    q = QUESTIONS[log.length % QUESTIONS.length];
    shown = 0; picked = -1; solved = false; answers = [];
    clearInterval(tick);
    startedAt = 0;
    shownAt = Date.now();

    $("q-label").textContent = q.area + " · " + TYPES[q.type];
    $("stem").textContent = q.stem;
    $("qty").hidden = q.type !== "qc";
    $("qa").textContent = q.qa || "";
    $("qb").textContent = q.qb || "";
    var box = $("choices");
    box.textContent = "";
    q.choices.forEach(function (text, i) {
      var b = el("button", "choice", text);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        if (solved) return;
        picked = i;
        Array.prototype.forEach.call(box.children, function (o, j) { o.setAttribute("aria-pressed", j === i ? "true" : "false"); });
        $("check").disabled = false;
        $("verdict").hidden = true;
      });
      box.appendChild(b);
    });
    $("verdict").hidden = true;
    $("check").hidden = false;
    $("check").disabled = true;
    $("timer").hidden = false;
    $("timer").disabled = false;
    $("timer").textContent = "Start timer";
    $("hints").textContent = "";
    $("hint-card").hidden = false;
    $("hint-btn").disabled = false;
    $("hint-btn").textContent = "Give me a hint";
    $("walk").hidden = true;
    $("log-card").hidden = true;
  }

  function finish() {
    var now = Date.now(), today = new Date();
    solved = true;
    clearInterval(tick);
    var row = {
      id: q.id,
      at: today.toISOString(),
      day: Stats.key(today),
      target: settings.target,
      area: q.area,
      type: q.type,
      beforeMs: (startedAt || now) - shownAt,
      timerMs: startedAt ? now - startedAt : null,
      answers: answers.slice(),
      firstTry: answers.length === 1,
      hints: shown
    };
    log.push(row);
    var ok = save("44d.log", log);

    if (startedAt) {
      $("timer").disabled = true;
      $("timer").textContent = fmt(row.timerMs);
    } else {
      $("timer").hidden = true;
    }
    Array.prototype.forEach.call($("choices").children, function (o, j) {
      o.disabled = true;
      if (j === q.answer) o.classList.add("right");
    });
    $("check").hidden = true;
    $("hint-card").hidden = true;

    var steps = $("steps");
    steps.textContent = "";
    q.steps.forEach(function (s) { steps.appendChild(el("li", "", s)); });
    $("takeaway").textContent = q.takeaway;
    $("walk").hidden = false;

    $("log-area").textContent = row.area;
    $("log-type").textContent = TYPES[row.type];
    $("log-before").textContent = fmt(row.beforeMs);
    $("log-timer").textContent = row.timerMs == null ? "Not started" : fmt(row.timerMs);
    $("log-answers").textContent = row.answers.join(", then ");
    $("log-hints").textContent = row.hints;
    $("saved").className = "label status" + (ok ? "" : " warn");
    $("saved-text").textContent = ok ? "Saved on this phone" : "Could not save on this phone";
    $("log-card").hidden = false;
    render();
  }

  $("check").addEventListener("click", function () {
    if (picked < 0 || solved) return;
    var v = $("verdict");
    v.hidden = false;
    answers.push(LETTERS.charAt(picked));
    if (picked === q.answer) {
      v.className = "msg good";
      v.textContent = "Correct.";
      finish();
    } else {
      v.className = "msg bad";
      v.textContent = (q.traps && q.traps[picked]) || "Not yet. Try a hint, then have another go.";
    }
  });

  $("hint-btn").addEventListener("click", function () {
    if (shown >= q.hints.length) return;
    var li = el("li");
    li.appendChild(el("b", "", "Hint " + (shown + 1) + " of " + q.hints.length));
    li.appendChild(document.createTextNode(q.hints[shown]));
    $("hints").appendChild(li);
    shown++;
    if (shown >= q.hints.length) {
      this.disabled = true;
      this.textContent = "No more hints";
    } else {
      this.textContent = "Another hint";
    }
  });

  $("timer").addEventListener("click", function () {
    if (startedAt || solved) return;
    startedAt = Date.now();
    var btn = this;
    btn.textContent = "0:00";
    tick = setInterval(function () { btn.textContent = fmt(Date.now() - startedAt); }, 1000);
  });

  $("next").addEventListener("click", function () {
    openQuestion();
    window.scrollTo(0, 0);
  });

  // ---------- screen stays on while a question is open ----------
  function keepAwake(on) {
    if (!on) {
      if (lock) { lock.release().catch(function () {}); lock = null; }
      $("awake").hidden = true;
      return;
    }
    if (lock || !("wakeLock" in navigator)) return;
    navigator.wakeLock.request("screen").then(function (l) {
      lock = l;
      $("awake").hidden = false;
      l.addEventListener("release", function () { lock = null; $("awake").hidden = true; });
    }).catch(function () {});
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    if (!$("session").hidden) keepAwake(true);
    render(); // the day may have changed while the app sat in the background
  });

  // ---------- navigation ----------
  function intro() {
    var h = $("home");
    h.classList.remove("intro");
    void h.offsetWidth;
    h.classList.add("intro");
    clearTimeout(introTimer);
    introTimer = setTimeout(function () { h.classList.remove("intro"); }, 1500);
  }
  function show(name) {
    ["home", "settings", "session"].forEach(function (v) { $(v).hidden = v !== name; });
    keepAwake(name === "session");
    if (name === "home") { render(); intro(); }
    window.scrollTo(0, 0);
  }
  $("start").addEventListener("click", function () {
    if (!q || solved) openQuestion();
    show("session");
  });
  $("back").addEventListener("click", function () { show("home"); });
  $("open-settings").addEventListener("click", function () {
    $("name").value = settings.name;
    show("settings");
  });
  $("close-settings").addEventListener("click", function () { show("home"); });
  $("cal-toggle").addEventListener("click", function () {
    var open = $("cal-wrap").hidden;
    $("cal-wrap").hidden = !open;
    this.setAttribute("aria-expanded", open ? "true" : "false");
    this.textContent = open ? "Hide calendar" : "Show calendar";
  });

  // ---------- settings ----------
  function setTarget(n) {
    settings.target = clampTarget(n);
    save("44d.settings", settings);
    render();
  }
  $("less").addEventListener("click", function () { setTarget(settings.target - 1); });
  $("more").addEventListener("click", function () { setTarget(settings.target + 1); });
  $("name").addEventListener("input", function () {
    settings.name = this.value.trim();
    save("44d.settings", settings);
    render();
  });
  $("erase").addEventListener("click", function () {
    var btn = this;
    if (!eraseArmed) { // first tap arms it; a second tap within four seconds erases
      btn.textContent = "Tap again to erase everything";
      eraseArmed = setTimeout(function () { eraseArmed = null; btn.textContent = "Erase practice history"; }, 4000);
      return;
    }
    clearTimeout(eraseArmed);
    eraseArmed = null;
    btn.textContent = "Erase practice history";
    log = [];
    save("44d.log", log);
    q = null;
    render();
  });

  // ---------- background: a sparse field of specks drifting slowly upward and twinkling ----------
  (function () {
    var c = $("bg"), ctx = c.getContext("2d"), W = 0, H = 0, specks = [], running = false;
    function size() {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      c.width = W * dpr;
      c.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      specks = [];
      var n = Math.round(W * H / 8000);
      for (var i = 0; i < n; i++) {
        specks.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.1 + 0.3, v: Math.random() * 5 + 2, p: Math.random() * 6.28, star: Math.random() < 0.08 });
      }
    }
    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < specks.length; i++) {
        var s = specks[i];
        var a = 0.16 + 0.24 * (0.5 + 0.5 * Math.sin(t / 1500 + s.p));
        var y = (s.y - t / 1000 * s.v) % H;
        if (y < 0) y += H;
        ctx.fillStyle = "rgba(233,242,255," + a.toFixed(3) + ")";
        ctx.beginPath();
        if (s.star) {
          var k = s.r * 3.4;
          ctx.moveTo(s.x, y - k);
          ctx.quadraticCurveTo(s.x, y, s.x + k, y);
          ctx.quadraticCurveTo(s.x, y, s.x, y + k);
          ctx.quadraticCurveTo(s.x, y, s.x - k, y);
          ctx.quadraticCurveTo(s.x, y, s.x, y - k);
        } else {
          ctx.arc(s.x, y, s.r, 0, 6.2832);
        }
        ctx.fill();
      }
    }
    function loop(t) {
      if (document.hidden) { running = false; return; }
      draw(t);
      requestAnimationFrame(loop);
    }
    function start() {
      if (STILL) { draw(0); return; }
      if (!running) { running = true; requestAnimationFrame(loop); }
    }
    window.addEventListener("resize", function () { size(); if (STILL) draw(0); });
    document.addEventListener("visibilitychange", start);
    size();
    start();
  })();

  render();
  introTimer = setTimeout(function () { $("home").classList.remove("intro"); }, 1500);
})();

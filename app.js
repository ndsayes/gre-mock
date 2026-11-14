(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var STILL = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var RING = 263.9;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var TYPES = { qc: "Quantitative comparison", mc: "Multiple choice", ms: "Select all that apply", num: "Numeric entry" };
  var LETTERS = "ABCDEFGH";

  // shortcut: progress lives only in this phone's browser storage; stage 4 adds the realtime backup to the private repo.
  function load(k, fallback) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function clampTarget(n) { return Math.max(1, Math.min(30, Math.round(n) || 5)); }

  // Which Claude model answers and how hard it thinks. Chosen in Settings so the speeds can be compared on real questions.
  var PRESETS = {
    "opus-medium": { model: "claude-opus-5-5", effort: "medium", label: "Opus medium" },
    "opus-fast": { model: "claude-opus-5-5", effort: "medium", speed: "fast", label: "Opus medium, fast mode" },
    "sonnet-high": { model: "claude-sonnet-5-5", effort: "high", label: "Sonnet high" },
    "opus-low": { model: "claude-opus-5-5", effort: "low", label: "Opus low" }
  };

  var settings = load("44d.settings", {});
  if (!settings || typeof settings !== "object") settings = {};
  // Fast mode became the default on 2026-11-14; move earlier installs onto it once, then respect any later choice.
  if (!PRESETS[settings.tutor] || !settings.fastDefault) settings.tutor = "opus-fast";
  settings.fastDefault = true;
  settings.target = clampTarget(settings.target);
  if (typeof settings.name !== "string") settings.name = "ND";
  var log = load("44d.log", []);
  if (!Array.isArray(log)) log = [];

  var q = null, shown = 0, picked = -1, solved = false, answers = [];
  var shownAt = 0, startedAt = 0, tick = null, lock = null, introTimer = null;
  var sel = 5, firstPaint = true, eraseArmed = null;
  // The Claude API key is typed in Settings and never leaves this phone except in requests to Anthropic.
  var apiKey = load("44d.key", "");
  if (typeof apiKey !== "string") apiKey = "";
  var turns = [], system = "", running = false, ctl = null, photoFile = null;
  // The question bank is fetched from the owner's private GitHub repo with a read-only token and kept on this phone.
  var ghToken = load("44d.gh", "");
  if (typeof ghToken !== "string") ghToken = "";
  var bank = load("44d.bank", null);
  if (!bank || !Array.isArray(bank.questions) || !bank.questions.length) bank = null;
  if (typeof settings.repo !== "string" || !settings.repo) settings.repo = "ndsayes/gre-mock-data";
  var picks = [];

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

    var strip = $("strip"), WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    strip.textContent = "";
    Stats.lastDays(today, 5).forEach(function (date, i) {
      var k = Stats.key(date), share = Stats.share(days, k, target, tk), isToday = k === tk;
      if (i) strip.appendChild(el("span", "join"));
      var block = el("div", "dayblock"), cell = el("span", "cell");
      if (share > 0) {
        var fill = el("i");
        fill.style.opacity = share >= 1 ? 1 : (0.25 + 0.5 * share).toFixed(2);
        cell.appendChild(fill);
      }
      cell.style.setProperty("--i", i);
      block.appendChild(cell);
      var cap = el("span", "cap" + (isToday ? " now" : ""));
      if (isToday) cap.appendChild(el("i", "pointer"));
      cap.appendChild(document.createTextNode(isToday ? "Today" : WEEKDAYS[date.getDay()]));
      block.appendChild(cap);
      strip.appendChild(block);
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
      ? plural(log.length, "question") + " logged. Erasing clears your streak, chart and log, on this phone and in the backup."
      : "Nothing logged yet.";
    $("erase").disabled = !log.length;
    backupNote("");
    $("bank-note").textContent = bank
      ? plural(bank.questions.length, "question") + " on this phone, last synced " + new Date(bank.syncedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + "."
      : "Not connected yet. Until then the app uses its five built-in sample questions.";
    $("stage-note").textContent = (bank ? plural(bank.questions.length, "question") + " in your bank" : "sample questions") + " · progress saved on this phone only";

    var hasKey = !!apiKey;
    $("chat-on").hidden = !hasKey;
    $("work-on").hidden = !hasKey;
    Array.prototype.forEach.call(document.querySelectorAll(".need-key"), function (b) { b.hidden = hasKey; });
  }

  // ---------- question ----------
  function openQuestion() {
    // Questions come from the private bank once it has been synced; until then, the five built-in samples.
    q = Stats.pick(bank ? bank.questions : QUESTIONS, log, new Date()) || QUESTIONS[0];
    shown = 0; picked = -1; picks = []; solved = false; answers = [];
    clearInterval(tick);
    startedAt = 0;
    shownAt = Date.now();

    $("q-label").textContent = q.area + " · " + TYPES[q.type];
    $("stem").textContent = q.stem || "";
    $("stem").hidden = !q.stem;
    var fig = q.figure ? cleanSvg(q.figure) : null;
    $("figure").textContent = "";
    if (fig) {
      if (q.figdesc) fig.setAttribute("aria-label", q.figdesc);
      $("figure").appendChild(fig);
    }
    $("figure").hidden = !fig;
    $("qty").hidden = q.type !== "qc";
    $("qa").textContent = q.qa || "";
    $("qb").textContent = q.qb || "";
    var box = $("choices");
    box.textContent = "";
    box.hidden = q.type === "num";
    choicesOf(q).forEach(function (text, i) {
      var b = el("button", "choice", text);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        if (solved) return;
        if (q.type === "ms") { // any number of choices can be on
          var on = b.getAttribute("aria-pressed") !== "true";
          b.setAttribute("aria-pressed", on ? "true" : "false");
          picks = picks.filter(function (p) { return p !== i; });
          if (on) picks.push(i);
          picks.sort(function (x, y) { return x - y; });
          $("check").disabled = !picks.length;
        } else {
          picked = i;
          Array.prototype.forEach.call(box.children, function (o, j) { o.setAttribute("aria-pressed", j === i ? "true" : "false"); });
          $("check").disabled = false;
        }
        $("verdict").hidden = true;
      });
      box.appendChild(b);
    });
    $("multi-note").hidden = q.type !== "ms";
    $("num-row").hidden = q.type !== "num";
    $("num").value = "";
    $("num").disabled = false;
    $("num-unit").textContent = q.unit || "";
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

    if (ctl) ctl.abort();
    turns = [];
    system = buildSystem(q);
    photoFile = null;
    $("thread").textContent = "";
    $("ask").value = "";
    $("work").value = "";
    $("photo").value = "";
    $("thumb").hidden = true;
    $("work-reply").hidden = true;
    $("dock-work").hidden = false;
    $("dot").hidden = true;
    closeSheets();
    var peek = q.stem + (q.type === "qc" ? " Quantity A: " + q.qa + ". Quantity B: " + q.qb + "." : "");
    Array.prototype.forEach.call(document.querySelectorAll(".peek"), function (p) {
      p.textContent = peek;
      p.classList.remove("open");
    });
  }

  function finish() {
    var now = Date.now(), today = new Date();
    solved = true;
    clearInterval(tick);
    var row = {
      id: q.id,
      src: q.src || q.id,
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
      if (q.type === "ms" ? q.answer.indexOf(j) >= 0 : j === q.answer) o.classList.add("right");
    });
    $("num").disabled = true;
    $("check").hidden = true;
    $("hint-card").hidden = true;
    $("dock-work").hidden = true;

    var steps = $("steps");
    steps.textContent = "";
    q.steps.forEach(function (s) { steps.appendChild(el("li", "", s)); });
    $("takeaway").textContent = q.takeaway;
    $("fast").hidden = !q.fast;
    $("fast-text").textContent = q.fast || "";
    $("walk").hidden = false;

    $("log-area").textContent = row.area;
    $("log-type").textContent = TYPES[row.type];
    $("log-before").textContent = fmt(row.beforeMs);
    $("log-timer").textContent = row.timerMs == null ? "Not started" : fmt(row.timerMs);
    $("log-answers").textContent = row.answers.join(", then ");
    $("log-hints").textContent = row.hints;
    $("saved").className = "label status" + (ok ? "" : " warn");
    $("saved-text").textContent = ok ? "Saved on this phone" : "Could not save on this phone";
    setDirty(true);
    backup();
    $("log-card").hidden = false;
    render();
  }

  function choicesOf(q) { return q.type === "qc" ? QC_CHOICES : (q.choices || []); }
  // Reads a typed answer: 12, 0.4, 1,250 or a fraction such as 3/8. Returns null if it is not a number.
  function parseNum(text) {
    var s = String(text).replace(/[\s,$%]/g, ""), parts = s.split("/");
    if (!s || parts.length > 2) return null;
    var n = Number(parts[0]), d = parts.length === 2 ? Number(parts[1]) : 1;
    if (parts[0] === "" || parts[parts.length - 1] === "" || !isFinite(n) || !isFinite(d) || d === 0) return null;
    return n / d;
  }
  function near(a, b) { return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)); }

  $("num").addEventListener("input", function () {
    $("check").disabled = !this.value.trim();
    $("verdict").hidden = true;
  });
  $("check").addEventListener("click", function () {
    if (solved) return;
    var v = $("verdict"), right, said, trap = "";
    if (q.type === "ms") {
      if (!picks.length) return;
      said = picks.map(function (p) { return LETTERS.charAt(p); }).join("+");
      right = picks.join(",") === q.answer.join(",");
      trap = "Not yet. Test each choice on its own: one of your picks does not fit, or one that fits is missing.";
    } else if (q.type === "num") {
      var n = parseNum($("num").value);
      if (n === null) {
        v.hidden = false;
        v.className = "msg bad";
        v.textContent = "Enter a number, such as 12, 0.4 or 3/8.";
        return;
      }
      said = $("num").value.trim();
      right = near(n, q.answer);
      (Array.isArray(q.traps) ? q.traps : []).forEach(function (t) { if (near(n, t.value)) trap = t.msg; });
    } else {
      if (picked < 0) return;
      said = LETTERS.charAt(picked);
      right = picked === q.answer;
      trap = q.traps && q.traps[picked];
    }
    v.hidden = false;
    answers.push(said);
    if (right) {
      v.className = "msg good";
      v.textContent = "Correct.";
      finish();
    } else {
      v.className = "msg bad";
      v.textContent = trap || "Not yet. Try a hint, then have another go.";
    }
  });

  $("hint-btn").addEventListener("click", function () {
    if (shown >= q.hints.length) return;
    var li = el("li");
    li.appendChild(el("b", "", "Hint " + (shown + 1) + " of " + q.hints.length));
    li.appendChild(document.createTextNode(q.hints[shown]));
    var w = el("button", "why", "But why?"), idx = shown;
    w.type = "button";
    w.addEventListener("click", function () { why(idx); });
    li.appendChild(w);
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

  // ---------- tutor ----------
  // The system prompt is built once per question and never changes during that conversation; anything
  // that changes (hints opened, solved or not) travels as an app note at the start of each new message.
  function buildSystem(q) {
    var lines = [
      "You are the tutor inside 44 Days, a GRE quant practice app. The student is rusty at maths and is working through the question below on their phone. They want to understand the maths, not memorise it. A good explanation leaves them able to point at every number and every operation and say where it came from, as if they could have invented the method themselves. Your job is to help them think, never to do the thinking for them, because working it out themselves is what makes it stick for the real test.",
      "",
      "<question>",
      "Area: " + q.area,
      "Type: " + TYPES[q.type],
      q.stem || ""
    ];
    var list = choicesOf(q), right;
    if (q.figure) lines.push("Figure shown to the student: " + (q.figdesc || "see the markup"), "Figure markup (SVG): " + q.figure);
    if (q.type === "qc") lines.push("Quantity A: " + q.qa, "Quantity B: " + q.qb);
    list.forEach(function (c, i) { lines.push(LETTERS.charAt(i) + ". " + c); });
    if (q.type === "ms") lines.push("The student selects every choice that applies.");
    if (q.type === "num") lines.push("The student types a number into a box" + (q.unit ? " followed by the word " + q.unit : "") + ". There are no answer choices.");
    if (q.type === "ms") right = "Correct choices: " + q.answer.map(function (a) { return LETTERS.charAt(a) + ". " + list[a]; }).join("; ");
    else if (q.type === "num") right = "Correct answer: " + q.answer + (q.unit ? " " + q.unit : "");
    else right = "Correct choice: " + LETTERS.charAt(q.answer) + ". " + list[q.answer];
    lines.push("</question>", "", "<hints>");
    q.hints.forEach(function (h, i) { lines.push((i + 1) + ". " + h); });
    lines.push("</hints>", "", "<checked_solution>", right);
    q.steps.forEach(function (s) { lines.push("- " + s); });
    if (q.fast) lines.push("Faster route: " + q.fast);
    lines.push(
      "Key idea: " + q.takeaway,
      "</checked_solution>",
      "",
      "What you may reveal:",
      "- The checked solution is for your eyes only. Until an app note says the student has answered correctly, never say which choice is correct, never state the final result, and never carry out the last step for them. If they ask for the answer, kindly decline and offer the next small step instead. Once an app note says they have answered correctly, you may discuss the full solution openly.",
      "- When you teach an idea before they have solved the question, teach it on a parallel example with different numbers and a different story, so the method transfers and the answer stays theirs to find.",
      "- A message may begin with an app note in square brackets. It comes from the app, not the student. It says which of the numbered hints they have opened and whether they have solved the question. Use it, but do not mention it.",
      "",
      "How to teach, from first principles:",
      "1. Concrete before abstract. Open with real numbers, never with a formula or a definition. Pick numbers that make the arithmetic easy to see.",
      "2. One new idea per step. If a step needs two realisations, split it.",
      "3. Show every arithmetic and algebra move and name the rule in plain words. When an operation could plausibly have been a different one, say why it is this one (why divide and not multiply).",
      "4. Colour-link. Give each quantity one colour and keep it everywhere: in the picture, in the formula line and in the sentence.",
      "5. Make each quantity visible as a shape before it appears as a symbol.",
      "6. The rule or formula comes last, as a one-line summary of what they just watched, then restated as a plain sentence.",
      "7. Predict before reveal. Once in a walkthrough, ask what they expect before you show it.",
      "8. Compute every number you show and check it. A wrong number destroys trust in the whole explanation.",
      "9. Do exactly what you say. If the text says average, the picture and the formula show the add and the divide.",
      "10. When something is a convention or a choice, name the obvious alternative and show on the same numbers why it falls short.",
      "Words like clearly, simply and obviously mark a skipped step, so leave them out. Answer the exact question they asked, however basic: they are relearning this and chose to ask.",
      "",
      "Test-day habits. These come second: understanding first, speed after. Bring one in only when it fits this question's type and the idea itself has landed, as the faster route for next time.",
      "- Comparisons: when both quantities are plain numbers, the relationship can always be determined. To show it cannot be determined, two cases with different outcomes are enough, so test different kinds of number: negative, zero, a fraction between 0 and 1, 1, something large.",
      "- Comparisons: compare rather than compute. Do the same thing to both quantities, or compare them piece by piece.",
      "- An unknown total with percents or fractions: call it 100, or a multiple of the denominators. Variables in the answer choices: pick small numbers and test the choices.",
      "- Numbers in the choices and one value asked for: work backwards from a middle choice, which also shows which way to move.",
      "- Select-all questions: judge each choice on its own. Numeric entry: no choices will catch a slip, so reread what is asked and the units before answering.",
      "- Charts: read the title, axes, units and key before the question, then estimate. A percent change in an amount is not a change in percentage points. Geometry figures are not drawn to scale; charts and coordinate grids are.",
      "",
      "There are two kinds of reply. Choose the one that fits.",
      "A. Quick reply, for a small specific question. Write 2 to 4 short plain sentences and end with one small question that moves them forward.",
      "B. Walkthrough, when they ask why a hint points them a certain way, ask you to explain a concept (for example, explain ratios), ask for a picture, or seem lost. Write one short plain sentence saying what the walkthrough will show, then one final block in exactly this form with nothing after it:",
      "WALKTHROUGH:",
      "{\"legend\":[[\"blue\",\"what blue stands for\"],[\"yellow\",\"what yellow stands for\"]],\"steps\":[{\"svg\":\"<svg viewBox='0 0 320 180'>...</svg>\",\"formula\":\"{blue|100} + {yellow|20} = 120\",\"text\":\"Two to four sentences saying why.\"}],\"next\":\"One natural follow-up question\"}",
      "",
      "Walkthrough rules:",
      "- 3 to 6 steps. Each step has a picture, a formula line and 2 to 4 sentences of text. If they asked about one piece, cover just that piece.",
      "- Each picture is an SVG with viewBox='0 0 320 180', shown on a dark background. Write every SVG attribute with single quotes so the JSON stays valid, and use the plain characters & < > only as XML allows. Use only these elements: svg, g, rect, circle, ellipse, line, polyline, polygon, path, text, tspan. No style attributes, CSS, links or images: the app removes anything else.",
      "- Colours: blue #30aad6, yellow #ffe500, orange #f37f5b, green #43cfa1, at most three in one walkthrough. Neutral shapes #3a3a41, guide lines #6b6b73. Text is light by default, so leave fill off text unless it names a coloured quantity. Text that sits on a blue, yellow, orange or green shape is dark: fill='#0e0e10'.",
      "- Text in pictures: font-size 12 to 14, short labels, nothing overlapping, nothing outside the frame, at least 8 units of margin on every side.",
      "- Choose the picture that fits the idea. Parts of a whole, ratios and percents: bars cut into equal slices. Products: an area model, a rectangle cut into pieces. Repeated change over time: a row of boxes. Averages and spread: dots on a number line, or a balance beam. Probability: a square split by outcomes. A pattern: a small table of values.",
      "- Carry the previous step's picture forward and add one thing, so they see exactly what changed.",
      "- In formula and text, mark each coloured quantity as {blue|20%}, with the same colour names as the legend. Everything else is plain text: no Markdown, no LaTeX. Write maths as 3/4, x^2 or 20% of 120.",
      "- next is a door, not a wall: the one question a curious student would ask next.",
      "Outside a walkthrough the app shows plain text only, so the same no-Markdown, no-LaTeX rule applies to quick replies."
    );
    return lines.join("\n");
  }
  function note() {
    return "[App note: " + (shown ? "the student has opened hints 1 to " + shown + " of " + q.hints.length : "the student has not opened any hints") +
      ". They have " + (solved ? "now answered correctly" : "not answered correctly yet") + ".]";
  }
  // Splits a reply into its plain text and, if present, the step-by-step walkthrough that follows it.
  function splitReply(text) {
    var s = String(text || ""), i = s.indexOf("WALKTHROUGH:");
    if (i < 0) return { text: s.trim(), walk: null, building: false, steps: 0 };
    var tail = s.slice(i + 12), a = tail.indexOf("{"), b = tail.lastIndexOf("}"), walk = null;
    if (a >= 0 && b > a) { try { walk = JSON.parse(tail.slice(a, b + 1)); } catch (e) { walk = null; } }
    return { text: s.slice(0, i).trim(), walk: walk, building: true, steps: (tail.match(/"svg"\s*:/g) || []).length };
  }
  function textOf(message) {
    return (message.content || []).filter(function (b) { return b.type === "text"; }).map(function (b) { return b.text; }).join("");
  }
  // The tutor's pictures arrive as SVG text. Nothing from it is inserted as markup: each allowed shape and
  // attribute is copied across by name, and everything else (scripts, links, styles, images) is dropped.
  var SVG_NS = "http://www.w3.org/2000/svg";
  var SVG_TAGS = { svg: 1, g: 1, rect: 1, circle: 1, ellipse: 1, line: 1, polyline: 1, polygon: 1, path: 1, text: 1, tspan: 1 };
  var SVG_ATTRS = {
    viewBox: 1, x: 1, y: 1, x1: 1, y1: 1, x2: 1, y2: 1, cx: 1, cy: 1, r: 1, rx: 1, ry: 1, width: 1, height: 1, d: 1, points: 1,
    fill: 1, stroke: 1, "stroke-width": 1, "stroke-dasharray": 1, "stroke-linecap": 1, "stroke-linejoin": 1,
    opacity: 1, "fill-opacity": 1, "stroke-opacity": 1, transform: 1, "text-anchor": 1, "dominant-baseline": 1,
    "font-size": 1, "font-weight": 1, "font-style": 1, dx: 1, dy: 1
  };
  function cleanSvg(markup) {
    if (typeof markup !== "string" || !markup) return null;
    var doc = new DOMParser().parseFromString(markup, "image/svg+xml"), root = doc.documentElement;
    if (!root || root.nodeName !== "svg" || doc.getElementsByTagName("parsererror").length) return null;
    function copy(src) {
      if (!SVG_TAGS[src.nodeName]) return null;
      var out = document.createElementNS(SVG_NS, src.nodeName);
      for (var i = 0; i < src.attributes.length; i++) {
        var a = src.attributes[i];
        if (SVG_ATTRS[a.name] && !/url\s*\(|javascript:|[<>]/i.test(a.value)) out.setAttribute(a.name, a.value);
      }
      for (var c = src.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) out.appendChild(document.createTextNode(c.nodeValue));
        else if (c.nodeType === 1) { var kid = copy(c); if (kid) out.appendChild(kid); }
      }
      return out;
    }
    var svg = copy(root);
    if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", "0 0 320 180");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("class", "walk-svg");
    svg.setAttribute("role", "img");
    return svg;
  }
  // Turns {blue|20%} marks into coloured spans; everything else stays plain text.
  var INK = { blue: "c-blue", yellow: "c-yellow", orange: "c-orange", green: "c-green" };
  function marked(node, text) {
    var s = String(text == null ? "" : text), re = /\{(blue|yellow|orange|green)\|([^{}]*)\}/g, last = 0, m;
    node.textContent = "";
    while ((m = re.exec(s))) {
      if (m.index > last) node.appendChild(document.createTextNode(s.slice(last, m.index)));
      node.appendChild(el("span", INK[m[1]], m[2]));
      last = re.lastIndex;
    }
    if (last < s.length) node.appendChild(document.createTextNode(s.slice(last)));
  }
  // The first-principles step-through: one picture, one colour-coded formula line and a few sentences per step.
  function stepper(walk) {
    var steps = (walk && Array.isArray(walk.steps) ? walk.steps : []).filter(function (s) { return s && (s.text || s.svg); }).slice(0, 8);
    if (!steps.length) return null;
    var box = el("div", "walkthrough"), i = 0;
    var legend = el("div", "walk-legend");
    (Array.isArray(walk.legend) ? walk.legend : []).slice(0, 4).forEach(function (pair) {
      if (!Array.isArray(pair) || !INK[pair[0]]) return;
      var item = el("span");
      item.appendChild(el("i", INK[pair[0]]));
      item.appendChild(document.createTextNode(String(pair[1] == null ? "" : pair[1]).slice(0, 60)));
      legend.appendChild(item);
    });
    var art = el("div", "walk-art"), formula = el("p", "walk-formula"), text = el("p", "walk-text");
    var nav = el("div", "walk-nav"), back = el("button", "btn soft", "Back"), next = el("button", "btn", "Next step"), count = el("span", "label");
    back.type = "button";
    next.type = "button";
    nav.appendChild(back);
    nav.appendChild(next);
    nav.appendChild(count);
    var door = null;
    if (typeof walk.next === "string" && walk.next.trim()) {
      door = el("button", "chip door", walk.next.trim().slice(0, 160));
      door.type = "button";
      door.addEventListener("click", function () { chat(door.textContent, door.textContent); });
    }
    function show() {
      var st = steps[i], svg = cleanSvg(st.svg);
      art.textContent = "";
      if (svg) art.appendChild(svg);
      art.hidden = !svg;
      marked(formula, st.formula);
      formula.hidden = !st.formula;
      marked(text, st.text);
      count.textContent = "Step " + (i + 1) + " of " + steps.length;
      back.disabled = i === 0;
      next.textContent = i < steps.length - 1 ? "Next step" : "Start over";
      if (door) door.hidden = i < steps.length - 1;
    }
    back.addEventListener("click", function () { if (i > 0) { i--; show(); } });
    next.addEventListener("click", function () { i = (i + 1) % steps.length; show(); });
    if (legend.firstChild) box.appendChild(legend);
    box.appendChild(art);
    box.appendChild(formula);
    box.appendChild(text);
    box.appendChild(nav);
    if (door) box.appendChild(door);
    show();
    return box;
  }
  function bubble(cls, label, text) {
    var b = el("div", "bubble " + cls);
    if (label) b.appendChild(el("b", "", label));
    b.appendChild(el("span", "t", text));
    return b;
  }
  function view(node) { node.scrollIntoView({ block: "nearest", behavior: STILL ? "auto" : "smooth" }); }
  function setBusy(on) {
    running = on;
    $("send").textContent = on ? "Stop" : "Send";
    $("work-send").textContent = on ? "Stop" : "Check my work";
  }
  // Sends `messages` to Claude and streams the reply into `box`. Calls ok(message) or fail().
  function ask(messages, box, ok, fail) {
    var out = box.querySelector(".t"), mode = PRESETS[settings.tutor], began = Date.now(), stale = box.querySelector(".took");
    if (stale) stale.remove();
    if (!window.Tutor) {
      out.textContent = "The tutor could not load. Check your connection, then close and reopen the app.";
      setBusy(false);
      fail();
      return;
    }
    setBusy(true);
    out.textContent = "Thinking…";
    ctl = new AbortController();
    window.Tutor.reply({
      key: apiKey, model: mode.model, effort: mode.effort, speed: mode.speed, system: system, messages: messages, signal: ctl.signal,
      onText: function (t) {
        var r = splitReply(t);
        out.textContent = (r.text + (r.building ? "\n\nDrawing step " + Math.max(1, r.steps) + "…" : "")).trim() || "Thinking…";
        view(box);
      }
    }).then(function (message) {
      var r = splitReply(textOf(message)), lesson = r.walk ? stepper(r.walk) : null;
      if (message.stop_reason === "refusal" || (!r.text && !lesson)) {
        out.textContent = "The tutor could not answer that one. Try asking it a different way.";
        fail();
        return;
      }
      out.textContent = r.text + (r.building && !lesson ? (r.text ? "\n\n" : "") + "The pictures did not come through. Ask again and I will redraw them." : "");
      if (lesson) {
        box.classList.add("wide");
        box.appendChild(lesson);
      }
      box.appendChild(el("span", "label took", Math.round((Date.now() - began) / 1000) + " s · " + mode.label));
      ok(message);
    }, function (e) {
      var info = window.Tutor.explain(e);
      var kept = out.textContent === "Thinking…" ? "" : out.textContent;
      out.textContent = info.cancelled ? (kept || "Stopped.") : (kept ? kept + "\n\n" : "") + info.text;
      fail();
    }).then(function () {
      setBusy(false);
      view(box);
      // A reply that lands while the tutor panel is closed gets a dot on the Ask tutor button.
      if (box.parentNode === $("thread") && !$("tutor-sheet").open) $("dot").hidden = false;
    });
  }
  // shortcut: the whole conversation for a question is resent each turn; fine for a short chat, trim if chats get long.
  function chat(shownText, sentText) {
    if (running || !apiKey) return;
    $("thread").appendChild(bubble("me", "", shownText));
    var box = bubble("tutor", "Tutor", "");
    $("thread").appendChild(box);
    view(box);
    var mine = turns; // stays with this question even if the student moves on mid-reply
    mine.push({ role: "user", content: note() + "\n\n" + sentText });
    ask(mine.slice(), box, function (message) {
      // Claude's reply goes back exactly as it arrived, so its reasoning stays valid on the next turn.
      mine.push({ role: "assistant", content: message.content });
    }, function () { mine.pop(); });
  }
  function why(i) {
    openSheet("tutor-sheet");
    if (i < 0) chat("But why?", "But why? I have not opened a hint yet, and I do not know where to start. Walk me through the idea this question rests on.");
    else chat("But why? (hint " + (i + 1) + ")", "Why does hint " + (i + 1) + " ask me to think this way? Walk me through the idea behind it.");
  }
  Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (chip) {
    chip.addEventListener("click", function () {
      var k = chip.getAttribute("data-q");
      if (k === "why") why(shown - 1);
      else if (k === "simple") chat("Explain it simpler", "Explain it more simply, please.");
      else chat("Walk me through the idea", "Walk me through the idea behind this question, step by step with pictures.");
    });
  });
  $("send").addEventListener("click", function () {
    if (running) { if (ctl) ctl.abort(); return; }
    var text = $("ask").value.trim();
    if (!text) { $("ask").focus(); return; }
    $("ask").value = "";
    chat(text, text);
  });

  $("photo").addEventListener("change", function () {
    var f = this.files && this.files[0];
    if (!f) return;
    photoFile = f;
    var r = new FileReader();
    r.onload = function () { $("thumb").src = r.result; $("thumb").hidden = false; };
    r.readAsDataURL(f);
  });
  $("speak").addEventListener("click", function () {
    var t = $("work");
    t.placeholder = "Tap the microphone on your keyboard and talk. Your words appear here.";
    t.focus();
  });
  $("work-send").addEventListener("click", function () {
    if (running) { if (ctl) ctl.abort(); return; }
    var text = $("work").value.trim(), file = photoFile;
    if (!apiKey) return;
    if (!text && !file) { $("work").focus(); return; }
    var box = $("work-reply"), out = box.querySelector(".t"), old = box.querySelector(".walkthrough");
    if (old) old.remove();
    box.hidden = false;
    out.textContent = "Thinking…";
    setBusy(true);
    var ready = file && window.Tutor ? window.Tutor.photo(file) : Promise.resolve(null);
    ready.then(function (img) {
      var content = [];
      if (img) content.push({ type: "image", source: { type: "base64", media_type: img.media_type, data: img.data } });
      content.push({
        type: "text",
        text: note() + "\n\nThe student is showing you their working" + (img ? " in the attached photo of their handwritten notes" : "") +
          (text ? ', and says: "' + text + '"' : "") +
          ". Say what is right so far, then point to the first step that goes off track by asking a question about it. If nothing is wrong yet, say so and ask what comes next. If you cannot read the photo, say so and ask them to retake it or type the step. Give a quick reply here, not a walkthrough."
      });
      ask([{ role: "user", content: content }], box, function () {}, function () {});
    }, function () {
      out.textContent = "That photo could not be read. Try taking it again.";
      setBusy(false);
    });
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
    if (dirty || wipe) backup();
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
  // ---------- pop-up panels for the tutor and Show your work ----------
  function openSheet(id) {
    var d = $(id);
    if (d.open) return;
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
    document.documentElement.classList.add("locked");
    if (id === "tutor-sheet") {
      $("dot").hidden = true;
      var last = $("thread").lastElementChild;
      if (last) last.scrollIntoView({ block: "nearest" });
    }
  }
  function closeSheets() {
    ["tutor-sheet", "work-sheet"].forEach(function (id) {
      var d = $(id);
      if (!d.open) return;
      if (d.close) d.close(); else d.removeAttribute("open");
    });
    document.documentElement.classList.remove("locked");
  }
  ["tutor-sheet", "work-sheet"].forEach(function (id) {
    var d = $(id);
    d.addEventListener("close", function () { document.documentElement.classList.remove("locked"); });
    d.addEventListener("click", function (e) { if (e.target === d) closeSheets(); }); // a tap on the dimmed area
    d.querySelector(".sheet-close").addEventListener("click", closeSheets);
    d.querySelector(".peek").addEventListener("click", function () { this.classList.toggle("open"); });
  });
  $("dock-tutor").addEventListener("click", function () { openSheet("tutor-sheet"); });
  $("dock-work").addEventListener("click", function () { openSheet("work-sheet"); });
  // Keep the panel above the on-screen keyboard: size it to the part of the screen that is actually visible.
  if (window.visualViewport) {
    var vv = window.visualViewport, root = document.documentElement;
    var fit = function () {
      root.style.setProperty("--vvh", vv.height + "px");
      root.style.setProperty("--vvb", Math.max(0, window.innerHeight - vv.height - vv.offsetTop) + "px");
    };
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    fit();
  }

  function show(name) {
    ["home", "settings", "session"].forEach(function (v) { $(v).hidden = v !== name; });
    closeSheets();
    $("dock").hidden = name !== "session";
    keepAwake(name === "session");
    if (name === "home") { render(); intro(); }
    window.scrollTo(0, 0);
  }
  $("start").addEventListener("click", function () {
    if (!q || solved) openQuestion();
    show("session");
  });
  $("back").addEventListener("click", function () { show("home"); });
  function openSettings() {
    $("name").value = settings.name;
    $("key").value = apiKey;
    $("tutor-mode").value = settings.tutor;
    $("repo").value = settings.repo;
    $("gh-token").value = ghToken;
    $("bank-status").hidden = true;
    $("key-status").hidden = true;
    show("settings");
  }
  $("open-settings").addEventListener("click", openSettings);
  Array.prototype.forEach.call(document.querySelectorAll(".need-key"), function (b) {
    b.addEventListener("click", function () { closeSheets(); openSettings(); });
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
  $("key").addEventListener("input", function () {
    apiKey = this.value.trim();
    save("44d.key", apiKey);
    $("key-status").hidden = true;
    render();
  });
  // ---------- question bank ----------
  // Reads bank.json from the private repo. The token is sent only to api.github.com.
  function syncBank(done) {
    if (!ghToken) { done(false, "Paste your GitHub token first"); return; }
    fetch("https://api.github.com/repos/" + settings.repo + "/contents/bank.json", {
      headers: { Authorization: "Bearer " + ghToken, Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store"
    }).then(function (r) {
      if (r.status === 401) throw new Error("GitHub did not accept the token");
      if (r.status === 403 || r.status === 404) throw new Error("This token cannot read " + settings.repo);
      if (!r.ok) throw new Error("GitHub answered with an error (" + r.status + ")");
      return r.json();
    }).then(function (data) {
      var good = (data && Array.isArray(data.questions) ? data.questions : []).filter(function (x) {
        return x && x.id && TYPES[x.type] && Array.isArray(x.hints) && Array.isArray(x.steps) && x.answer != null;
      });
      if (!good.length) throw new Error("The question bank is empty");
      bank = { questions: good, syncedAt: new Date().toISOString() };
      var kept = save("44d.bank", bank);
      done(true, plural(good.length, "question") + " synced" + (kept ? "" : ", but too large to keep offline"));
    }).catch(function (e) {
      done(false, e instanceof TypeError ? "No connection to GitHub" : e.message);
    });
  }
  $("repo").addEventListener("input", function () {
    settings.repo = this.value.trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/+$/, "");
    save("44d.settings", settings);
  });
  $("gh-token").addEventListener("input", function () {
    ghToken = this.value.trim();
    save("44d.gh", ghToken);
    $("bank-status").hidden = true;
  });
  $("sync").addEventListener("click", function () {
    var btn = this, st = $("bank-status");
    function say(ok, text) {
      st.hidden = false;
      st.className = "label status" + (ok ? "" : " warn");
      $("bank-text").textContent = text;
    }
    btn.disabled = true;
    say(true, "Syncing…");
    syncBank(function (ok, text) {
      say(ok, text);
      btn.disabled = false;
      render();
      if (ok) backup(); // on a fresh install this is also what brings the practice history back
    });
  });

  // ---------- progress backup ----------
  // The whole practice log is kept as log.csv in the private repo. Every save first reads the copy there
  // and merges it with the phone's, so a reinstall or a second device never loses rows; each save is a
  // commit, so GitHub also keeps the history. shortcut: reads the file through the JSON contents API,
  // which stops at 1 MB (roughly 8,000 questions); switch to the raw form plus a tree lookup if it gets there.
  var backing = false, again = false, tries = 0;
  var dirty = load("44d.dirty", false) === true, wipe = load("44d.wipe", false) === true, backedAt = load("44d.backedAt", "");
  function b64encode(text) {
    var bytes = new TextEncoder().encode(text), bin = "";
    for (var i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(bin);
  }
  function b64decode(b64) {
    var bin = atob(String(b64 || "").replace(/\s/g, "")), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function setDirty(on) {
    dirty = on;
    save("44d.dirty", on);
  }
  function showBackup(state, why) {
    var line = $("backup");
    line.hidden = !ghToken;
    line.className = "label status" + (state === "fail" ? " warn" : "");
    $("backup-text").textContent = state === "ok" ? "Backed up to your private repo"
      : state === "busy" ? "Backing up…"
      : "Not backed up yet: " + why + ". It will retry";
    if (state === "ok") {
      backedAt = new Date().toISOString();
      save("44d.backedAt", backedAt);
    }
    backupNote(state === "fail" ? why : "");
  }
  function backupNote(problem) {
    $("backup-note").textContent = !ghToken ? "Your progress is backed up to the same repository once a token is added."
      : problem ? "Progress backup is not working: " + problem + "."
      : dirty || wipe ? "Progress backup: changes waiting to be sent."
      : backedAt ? "Progress backed up " + new Date(backedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + "."
      : "Progress backup has not run yet.";
  }
  function backup() {
    if (!ghToken) return;
    if (backing) { again = true; return; }
    backing = true;
    showBackup("busy");
    var url = "https://api.github.com/repos/" + settings.repo + "/contents/log.csv";
    var headers = { Authorization: "Bearer " + ghToken, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    fetch(url, { headers: headers, cache: "no-store" }).then(function (r) {
      if (r.status === 404) return null; // no backup file yet
      if (r.status === 401) throw new Error("GitHub did not accept the token");
      if (!r.ok) throw new Error("GitHub answered with an error (" + r.status + ")");
      return r.json();
    }).then(function (file) {
      var there = file ? b64decode(file.content) : "";
      if (!wipe) { // normal case: fold in anything the repo has that this phone does not
        var before = log.length;
        log = Stats.mergeLogs(log, Stats.fromCsv(there));
        if (log.length !== before) {
          save("44d.log", log);
          render();
        }
      }
      var text = Stats.toCsv(log);
      if (file && text === there) return true; // the repo already has everything
      return fetch(url, {
        method: "PUT", headers: headers,
        body: JSON.stringify({ message: "Practice log: " + plural(log.length, "question"), content: b64encode(text), sha: file ? file.sha : undefined })
      }).then(function (r) {
        if (r.status === 409 || r.status === 422) return false; // the file changed under us: read it again
        if (r.status === 403 || r.status === 404) throw new Error("this token cannot write to " + settings.repo + " (it needs Contents: Read and write)");
        if (!r.ok) throw new Error("GitHub answered with an error (" + r.status + ")");
        return true;
      });
    }).then(function (sent) {
      if (!sent) {
        if (++tries < 3) again = true;
        else throw new Error("GitHub kept refusing the save");
        return;
      }
      tries = 0;
      if (wipe) { wipe = false; save("44d.wipe", false); }
      setDirty(false);
      showBackup("ok");
    }).catch(function (e) {
      tries = 0;
      showBackup("fail", e instanceof TypeError ? "no connection to GitHub" : e.message);
    }).then(function () {
      backing = false;
      if (again) { again = false; backup(); }
    });
  }
  window.addEventListener("online", function () { if (dirty || wipe) backup(); });

  $("tutor-mode").addEventListener("change", function () {
    if (PRESETS[this.value]) settings.tutor = this.value;
    save("44d.settings", settings);
  });
  $("test-key").addEventListener("click", function () {
    var btn = this, st = $("key-status");
    function say(ok, text) {
      st.hidden = false;
      st.className = "label status" + (ok ? "" : " warn");
      $("key-text").textContent = text;
    }
    if (!apiKey) { say(false, "Paste a key first"); return; }
    if (!window.Tutor) { say(false, "The tutor did not load. Check your connection"); return; }
    btn.disabled = true;
    say(true, "Checking…");
    window.Tutor.testKey(apiKey).then(function () { say(true, "Key works"); }, function (e) {
      say(false, window.Tutor.explain(e).text);
    }).then(function () { btn.disabled = false; });
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
    // Erase the backup too, or the next sync would bring the old history straight back.
    wipe = true;
    save("44d.wipe", true);
    render();
    backup();
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
  // Pick up new questions quietly when the app opens, at most every six hours.
  if (ghToken && (!bank || Date.now() - Date.parse(bank.syncedAt) > 6 * 3600 * 1000)) syncBank(function () { render(); });
  // Every open: send anything waiting and pick up history saved from another install.
  backup();
})();

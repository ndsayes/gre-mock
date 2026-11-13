// Pure date and streak maths for the home screen. No DOM, so test.js can run it in Node.
var Stats = (function () {
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function key(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function monday(d) { return addDays(d, -((d.getDay() + 6) % 7)); }

  // log rows -> { "2026-11-13": { n: questions done, target: the daily target in force that day } }
  function byDay(log) {
    var days = {};
    log.forEach(function (row) {
      var e = days[row.day] || (days[row.day] = { n: 0, target: row.target });
      e.n++;
      e.target = row.target;
    });
    return days;
  }
  // Share of the target done on a day, 0 to 1. Past days keep the target they were done under;
  // today uses the current setting.
  function share(days, k, target, todayKey) {
    var e = days[k];
    if (!e) return 0;
    var t = k === todayKey ? target : (e.target || target);
    return Math.min(1, e.n / t);
  }
  // Days in a row with the target hit. Today still in progress does not break the streak.
  function streak(days, today, target) {
    var tk = key(today), d = today, n = 0;
    if (share(days, tk, target, tk) < 1) d = addDays(d, -1);
    while (share(days, key(d), target, tk) >= 1) { n++; d = addDays(d, -1); }
    return n;
  }
  function lastDays(today, count) {
    var out = [];
    for (var i = count - 1; i >= 0; i--) out.push(addDays(today, -i));
    return out;
  }
  function weeks(today, count) {
    var out = [], m = monday(today);
    for (var i = count - 1; i >= 0; i--) out.push(addDays(m, -7 * i));
    return out;
  }
  function weekTotal(days, mondayDate) {
    var sum = 0;
    for (var i = 0; i < 7; i++) {
      var e = days[key(addDays(mondayDate, i))];
      if (e) sum += e.n;
    }
    return sum;
  }
  // Chooses the next question from the bank. Each question has an id and a src (its blueprint); the two
  // variants of a blueprint share a src. Order of preference among questions not yet done:
  //   0. the sibling of one the learner struggled with (wrong first try, or 2+ hints), once 2 days have passed;
  //   1. a blueprint never seen before;
  //   2. anything else.
  // Within a tier it avoids repeating the previous question's area. When everything is done, the one done
  // longest ago comes round again.
  function pick(bank, log, today, rand) {
    if (!bank || !bank.length) return null;
    rand = rand || Math.random;
    var doneAt = {}, seen = {}, struggled = {};
    log.forEach(function (row, i) {
      var src = row.src || row.id;
      doneAt[row.id] = i;
      seen[src] = true;
      if (!row.firstTry || row.hints >= 2) struggled[src] = row.day;
    });
    var fresh = bank.filter(function (q) { return !(q.id in doneAt); });
    if (!fresh.length) return bank.slice().sort(function (a, b) { return doneAt[a.id] - doneAt[b.id]; })[0];
    function age(day) {
      var p = String(day).split("-");
      return Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - new Date(+p[0], p[1] - 1, +p[2])) / 86400000);
    }
    function tier(q) {
      var src = q.src || q.id;
      if (struggled[src] && age(struggled[src]) >= 2) return 0;
      return seen[src] ? 2 : 1;
    }
    var best = Math.min.apply(null, fresh.map(tier));
    var pool = fresh.filter(function (q) { return tier(q) === best; });
    var lastArea = log.length ? log[log.length - 1].area : null;
    var other = pool.filter(function (q) { return q.area !== lastArea; });
    if (other.length) pool = other;
    return pool[Math.floor(rand() * pool.length)];
  }
  return { key: key, addDays: addDays, monday: monday, byDay: byDay, share: share, streak: streak, lastDays: lastDays, weeks: weeks, weekTotal: weekTotal, pick: pick };
})();
if (typeof module !== "undefined") module.exports = Stats;

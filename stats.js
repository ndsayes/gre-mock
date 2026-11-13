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
  return { key: key, addDays: addDays, monday: monday, byDay: byDay, share: share, streak: streak, lastDays: lastDays, weeks: weeks, weekTotal: weekTotal };
})();
if (typeof module !== "undefined") module.exports = Stats;

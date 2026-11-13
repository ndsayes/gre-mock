// Self-check: run with `node test.js`. Verifies the sample answers by computing them, and the streak maths.
var assert = require("assert");
var Q = require("./questions.js");
var S = require("./stats.js");

function right(id) {
  var q = Q.filter(function (x) { return x.id === id; })[0];
  return q.choices[q.answer];
}
Q.forEach(function (q) {
  assert(q.answer >= 0 && q.answer < q.choices.length, q.id + ": answer position");
  assert(q.hints.length >= 3 && q.steps.length >= 3 && q.takeaway, q.id + ": hints, steps, takeaway");
  Object.keys(q.traps || {}).forEach(function (k) { assert(+k !== q.answer && +k < q.choices.length, q.id + ": trap position"); });
});
assert(100 * 1.2 * 0.8 < 100 && right("s1-percents") === "Quantity B is greater.");
assert.strictEqual(String(40 / 5 * 3 + 40), right("s1-ratios"));
assert(Math.pow(2, 2) < Math.pow(2, 3) && Math.pow(0.5, 2) > Math.pow(0.5, 3) && right("s1-exponents") === "It cannot be determined.");
assert.strictEqual(String(82 * 5 - 80 * 4), right("s1-averages"));
assert.strictEqual(String((24 - 4) / 2.5), right("s1-algebra"));

// Streak: Fri Nov 13 2026 is "today" with 2 of 5 done; the six days before hit 5; Nov 6 had 3.
var today = new Date(2026, 10, 13), log = [];
function add(day, n, target) { for (var i = 0; i < n; i++) log.push({ day: day, target: target }); }
add("2026-11-06", 3, 5);
["2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"].forEach(function (d) { add(d, 5, 5); });
add("2026-11-13", 2, 5);
var days = S.byDay(log);
assert.strictEqual(S.streak(days, today, 5), 6, "today in progress keeps the streak");
assert.strictEqual(S.streak(days, today, 2), 7, "hitting today's target extends it");
assert.strictEqual(S.streak(days, today, 10), 6, "raising the target later does not erase past days");
assert.strictEqual(S.share(days, "2026-11-06", 5, "2026-11-13"), 0.6);
assert.strictEqual(S.key(S.monday(today)), "2026-11-09");
assert.strictEqual(S.weekTotal(days, S.monday(today)), 22);
assert.strictEqual(S.lastDays(today, 14).length, 14);
assert.strictEqual(S.key(S.weeks(today, 6)[0]), "2026-10-05");
assert.strictEqual(S.streak({}, today, 5), 0);
console.log("all checks passed");

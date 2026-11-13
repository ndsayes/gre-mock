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

// Choosing the next question.
var bank = [
  { id: "p1-a", src: "p1", area: "Percents" }, { id: "p1-b", src: "p1", area: "Percents" },
  { id: "r1-a", src: "r1", area: "Ratios" }, { id: "r1-b", src: "r1", area: "Ratios" }
];
var first = function () { return 0; };
assert.strictEqual(S.pick([], [], today), null);
assert.strictEqual(S.pick(bank, [], today, first).id, "p1-a", "nothing done: a new blueprint");
var done1 = [{ id: "p1-a", src: "p1", area: "Percents", day: "2026-11-13", firstTry: false, hints: 3 }];
assert.strictEqual(S.pick(bank, done1, today, first).src, "r1", "struggled today: its sibling waits, a new blueprint comes first");
var done2 = [{ id: "p1-a", src: "p1", area: "Percents", day: "2026-11-11", firstTry: false, hints: 3 }];
assert.strictEqual(S.pick(bank, done2, today, first).id, "p1-b", "struggled two days ago: the sibling is due");
var done3 = [{ id: "p1-a", src: "p1", area: "Percents", day: "2026-11-11", firstTry: true, hints: 0 }];
assert.strictEqual(S.pick(bank, done3, today, first).src, "r1", "solved cleanly: no early repeat");
var all = bank.map(function (q, i) { return { id: q.id, src: q.src, area: q.area, day: "2026-11-1" + i, firstTry: true, hints: 0 }; });
assert.strictEqual(S.pick(bank, all, today, first).id, "p1-a", "everything done: the oldest comes round again");
console.log("all checks passed");

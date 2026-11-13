// Stage 1 sample questions. These are original, written for this app, and stand in until the
// private question bank is connected. `answer` and the keys of `traps` are positions in `choices`.
var QC_CHOICES = [
  "Quantity A is greater.",
  "Quantity B is greater.",
  "The two quantities are equal.",
  "It cannot be determined."
];
var QUESTIONS = [
  {
    id: "s1-percents",
    area: "Percents",
    type: "qc",
    stem: "A store raises the price of a jacket by 20%. A week later it cuts the new price by 20%.",
    qa: "The final price",
    qb: "The original price",
    choices: QC_CHOICES,
    answer: 1,
    traps: { 2: "Not yet. This is the classic trap: the two 20%s are taken from different amounts. Try a hint." },
    hints: [
      "You are not told the price. What is the easiest price you could make up to test this?",
      "Try $100. After the 20% raise, what does the tag say? Write it down before the next hint.",
      "The 20% cut is taken from the new price, not the original. Is 20% of the new price bigger or smaller than the 20% that was added?",
      "Compare the dollars added with the dollars taken away. Whichever is larger tells you which side wins."
    ],
    steps: [
      "Make up an easy price: $100.",
      "Raise it 20%. 20% of 100 is 20, so the tag says $120.",
      "Cut 20% of the new price. 20% of 120 is 24, so you take off $24, more than the $20 you added.",
      "Final price: 120 − 24 = $96, below the $100 you started with.",
      "For any price: up 20% means × 1.2, down 20% means × 0.8, and 1.2 × 0.8 = 0.96."
    ],
    takeaway: "A percent is always a percent of something. Up 20% then down 20% does not bring you back."
  },
  {
    id: "s1-ratios",
    area: "Ratios",
    type: "mc",
    stem: "In a school club, the ratio of students who walk to school to students who take the bus is 3 to 5. If 40 students take the bus, how many students are in the club in total?",
    choices: ["24", "48", "56", "64", "72"],
    answer: 3,
    traps: { 0: "Not yet. Check what the question asks for: one side of the ratio, or everyone?" },
    hints: [
      "A ratio of 3 to 5 means the students come in identical groups: for every 3 walkers there are 5 bus riders. Picture one such group.",
      "The 40 bus riders are made of the 5s in those groups. How many groups do you need to make 40 bus riders?",
      "Each group also holds 3 walkers. With that many groups, how many walkers are there?",
      "The question asks for everyone, not one side. What do you add together?"
    ],
    steps: [
      "Picture the club as identical groups: 3 walkers and 5 bus riders in each.",
      "40 bus riders ÷ 5 per group = 8 groups.",
      "8 groups × 3 walkers = 24 walkers.",
      "Total = 24 walkers + 40 bus riders = 64.",
      "Shortcut: each group holds 8 students, and 8 groups × 8 = 64."
    ],
    takeaway: "A ratio describes identical groups. Find how many groups there are, then count what you need."
  },
  {
    id: "s1-exponents",
    area: "Exponents",
    type: "qc",
    stem: "x is a positive number.",
    qa: "x²",
    qb: "x³",
    choices: QC_CHOICES,
    answer: 3,
    traps: { 1: "Not yet. You may have only tried numbers bigger than 1. What other positive numbers are allowed?" },
    hints: [
      "You cannot see x, so try a real number. Start with an easy one like x = 2. Which quantity is bigger?",
      "One test is never enough in a comparison. x only has to be positive. What kinds of positive numbers have you not tried?",
      "Try x = 1/2. Multiplying by a half makes a number smaller. Work out both quantities and compare.",
      "You now have two tests. Do they agree? What does it mean for the answer if they do not?"
    ],
    steps: [
      "Try x = 2: x² = 4 and x³ = 8, so Quantity B is bigger.",
      "Try x = 1/2: x² = 1/4 and x³ = 1/8, so Quantity A is bigger.",
      "Why: x³ is x² multiplied by x once more. Multiplying by a number above 1 grows it; multiplying by a number between 0 and 1 shrinks it.",
      "Two allowed values of x give opposite results, so the relationship cannot be determined."
    ],
    takeaway: "When a comparison has a variable, test a number above 1, a fraction between 0 and 1, and 1 itself."
  },
  {
    id: "s1-averages",
    area: "Averages",
    type: "mc",
    stem: "The average (arithmetic mean) of four test scores is 80. After a fifth test, the average of all five scores is 82. What was the fifth score?",
    choices: ["82", "84", "88", "90", "92"],
    answer: 3,
    traps: {
      0: "Not yet. 82 is the new average of all five, not the fifth score. What do the five scores add up to?",
      1: "Not yet. The fifth score has to pull up all five tests, not just itself."
    },
    hints: [
      "An average is the total shared out equally. If four scores average 80, what must the four scores add up to?",
      "Do the same for all five tests: if five scores average 82, what do they add up to?",
      "You now have two totals, one for four tests and one for five. What accounts for the difference between them?",
      "Subtract the smaller total from the larger one."
    ],
    steps: [
      "Average = total ÷ count, so total = average × count.",
      "Four tests: 80 × 4 = 320.",
      "Five tests: 82 × 5 = 410.",
      "The fifth score is the only thing added: 410 − 320 = 90.",
      "Check: the fifth score had to lift five tests by 2 points each, so it sits 10 above 80."
    ],
    takeaway: "Turn every average into a total (average × count). Totals can be added and subtracted; averages cannot."
  },
  {
    id: "s1-algebra",
    area: "Algebra",
    type: "mc",
    stem: "A taxi charges a flat fee of $4 plus $2.50 for each kilometre. A ride cost $24. How many kilometres was the ride?",
    choices: ["6", "8", "9.6", "10", "11.2"],
    answer: 1,
    traps: { 2: "Not yet. Dividing all $24 by 2.50 treats the flat fee as distance. Which part of the $24 was not for kilometres?" },
    hints: [
      "The $24 is made of two parts: a fee you pay just for getting in, and a part that grows with distance. How much is the getting-in part?",
      "Take that fee away from $24. What is left is what the distance itself cost.",
      "Each kilometre costs $2.50. How many $2.50s fit into what is left?",
      "Check yourself: multiply your kilometres by 2.50, add the fee, and see whether you get $24."
    ],
    steps: [
      "Total = flat fee + (price per kilometre × kilometres).",
      "Remove the flat fee: 24 − 4 = 20 dollars paid for distance.",
      "20 ÷ 2.50 = 8 kilometres.",
      "Check: 8 × 2.50 = 20, plus the $4 fee = 24."
    ],
    takeaway: "Undo a cost in reverse order: subtract the fixed part first, then divide by the rate."
  }
];
if (typeof module !== "undefined") module.exports = QUESTIONS;

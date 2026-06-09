// Quick validation for grade thresholds (mirrors grades.ts logic)
const GRADE_ORDER = ["F", "E", "D", "C", "B", "A", "S", "S+"];

function getRecordGrade(wins, isPerfect) {
  if (isPerfect || wins === 27) return "S+";
  if (wins >= 24) return "S";
  if (wins >= 20) return "A";
  if (wins >= 15) return "B";
  if (wins >= 11) return "C";
  if (wins >= 7) return "D";
  if (wins >= 4) return "E";
  return "F";
}

function capGradeByWins(grade, wins) {
  let maxGrade;
  if (wins <= 3) maxGrade = "F";
  else if (wins <= 6) maxGrade = "E";
  else if (wins <= 10) maxGrade = "D";
  else if (wins <= 14) maxGrade = "C";
  else if (wins <= 19) maxGrade = "B";
  else if (wins <= 23) maxGrade = "A";
  else if (wins <= 26) maxGrade = "S";
  else maxGrade = "S+";
  const gradeIdx = GRADE_ORDER.indexOf(grade);
  const maxIdx = GRADE_ORDER.indexOf(maxGrade);
  return GRADE_ORDER[Math.min(gradeIdx, maxIdx)];
}

const cases = [
  [27, 0, "S+"],
  [25, 2, "S"],
  [22, 5, "A"],
  [17, 10, "B"],
  [13, 14, "C"],
  [9, 18, "D"],
  [5, 22, "E"],
  [3, 25, "F"],
  [0, 27, "F"],
];

let ok = true;
for (const [w, l, expected] of cases) {
  const g = capGradeByWins(getRecordGrade(w, w === 27), w);
  if (g !== expected) {
    console.log(`FAIL ${w}-${l}: got ${g}, expected ${expected}`);
    ok = false;
  }
}
console.log(ok ? "ALL PASS" : "SOME FAILED");

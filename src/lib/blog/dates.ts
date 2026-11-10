/**
 * The dates the blog prints, in WordPress's format for this site ("F j, Y"), from the post's own
 * date (as WordPress stores it: the site's local time, e.g. "2026-07-01T09:12:44"). Checked against
 * every date the live pages print by src/lib/blog/blog.test.ts.
 */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-07-01T09:12:44" -> [2026, 7, 1] (read as written: no time zone conversion). */
function parts(date: string): [number, number, number] {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  return [year, month, day];
}

/** "November 2, 2026" */
export function longDate(date: string): string {
  const [year, month, day] = parts(date);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/** The day (two digits, WordPress's "d") and short month on a post card's picture: { day: "01", month: "Nov" }. */
export function cardDate(date: string): { day: string; month: string } {
  const [, month, day] = parts(date);
  return { day: String(day).padStart(2, "0"), month: MONTHS[month - 1].slice(0, 3) };
}

// Local calendar day as YYYY-MM-DD; toISOString() would give the UTC day, which is wrong near midnight.
export function todayIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// Adds calendar months keeping the original day, clamped to the month end (31 Jan + 1 month = 28 Feb, not 3 Mar).
export function addMonthsClamped(date: Date, months: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(date.getDate(), lastDay))
  return target
}

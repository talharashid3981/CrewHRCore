export function getAttendanceWeekDates(date) {
  const [year, month, day] = date.split("-").map(Number);
  const monday = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const weekday = new Date(monday);
    weekday.setUTCDate(monday.getUTCDate() + index);
    return weekday.toISOString().slice(0, 10);
  });
}

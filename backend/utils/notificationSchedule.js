export const addCalendarDays = (dateKey, days) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

export const previousWeekRange = (dateKey) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const currentWeekMonday = addCalendarDays(dateKey, -daysSinceMonday);
  const from = addCalendarDays(currentWeekMonday, -7);
  return { from, to: addCalendarDays(currentWeekMonday, -1) };
};

export const isWithinReminderWindow = (currentMinutes, dueMinutes, windowMinutes = 15) =>
  currentMinutes >= dueMinutes && currentMinutes < dueMinutes + windowMinutes;

export const isWeeklySummaryWindow = ({ dateKey, hour, minute }) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const isMonday = new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 1;
  return isMonday && hour === 9 && minute < 15;
};

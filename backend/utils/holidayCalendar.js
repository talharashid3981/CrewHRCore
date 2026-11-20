export const holidayStart = (holiday) => holiday.date || holiday.from;
export const holidayEnd = (holiday) => holiday.to || holiday.date || holiday.from;

export const holidayCovers = (holiday, date) =>
  holidayStart(holiday) <= date && holidayEnd(holiday) >= date;

export const holidayRangeQuery = (from, to) => ({
  date: { $lte: to },
  $or: [
    { to: { $gte: from } },
    { to: { $exists: false }, date: { $gte: from } },
  ],
});

export const holidayOnDateQuery = (date) => ({
  date: { $lte: date },
  $or: [
    { to: { $gte: date } },
    { to: { $exists: false }, date },
  ],
});

export const expandHolidayDates = (holidays, from, to) => {
  const result = new Set();
  for (const holiday of holidays) {
    let current = holidayStart(holiday);
    const end = holidayEnd(holiday);
    if (!current || !end || end < from || current > to) continue;
    if (current < from) current = from;
    const last = end > to ? to : end;
    while (current <= last) {
      result.add(current);
      const [year, month, day] = current.split("-").map(Number);
      current = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
    }
  }
  return result;
};

export const defaultShiftSchedules = {
  AM: { shiftStart: "09:00", shiftEnd: "18:00" },
  PM: { shiftStart: "11:00", shiftEnd: "20:00" },
};

export const shiftSchedulesFrom = (settings) => ({
  AM: {
    shiftStart: settings?.amShiftStart || defaultShiftSchedules.AM.shiftStart,
    shiftEnd: settings?.amShiftEnd || defaultShiftSchedules.AM.shiftEnd,
  },
  PM: {
    shiftStart: settings?.pmShiftStart || defaultShiftSchedules.PM.shiftStart,
    shiftEnd: settings?.pmShiftEnd || defaultShiftSchedules.PM.shiftEnd,
  },
});

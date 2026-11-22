export const defaultNotificationPreferences = Object.freeze({
  leaveUpdates: true,
  attendanceReminders: true,
  weeklySummary: false,
});

export const normalizeNotificationPreferences = (preferences) => ({
  leaveUpdates: preferences?.leaveUpdates ?? defaultNotificationPreferences.leaveUpdates,
  attendanceReminders: preferences?.attendanceReminders
    ?? defaultNotificationPreferences.attendanceReminders,
  weeklySummary: preferences?.weeklySummary ?? defaultNotificationPreferences.weeklySummary,
});

export const onboardingStatuses = Object.freeze([
  "incomplete",
  "pending",
  "approved",
  "rejected",
]);

export const isValidOnboardingStatus = (status) => onboardingStatuses.includes(status);

const validDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const inferOnboardingStatus = (employee) => {
  const submittedAt = validDate(employee.onboardingSubmittedAt);
  const approvedAt = validDate(employee.approvedAt);
  if (approvedAt && (!submittedAt || approvedAt >= submittedAt)) return "approved";
  if (employee.rejectionNote) return "rejected";
  if (submittedAt) return "pending";
  return "incomplete";
};

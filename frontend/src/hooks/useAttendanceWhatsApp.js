import { useCallback } from "react";
import { toast } from "react-toastify";
import {
  formatAttendanceMessage,
  shareWhatsAppMessage,
} from "../utils/whatsappAttendance";

export default function useAttendanceWhatsApp(employee) {
  const shareAttendance = useCallback(
    async (action, attendance) => {
      try {
        const message = formatAttendanceMessage(action, employee, attendance);
        const result = await shareWhatsAppMessage(message);

        if (result === "cancelled") {
          toast.info("Attendance saved. WhatsApp sharing was cancelled.");
        } else if (result === "copied") {
          toast.success("Attendance saved. The report was copied to your clipboard.");
        } else if (typeof result === "object" && result.status === "failed") {
          toast.warning(
            "Attendance saved, but WhatsApp sharing and copying were unavailable.",
          );
          console.error("Unable to share attendance report:", result.error);
        } else {
          toast.info("Review the attendance report in WhatsApp and press Send.");
        }
      } catch (error) {
        console.error("Unable to prepare attendance report:", error);
        toast.warning("Attendance saved, but the WhatsApp report could not be prepared.");
      }
    },
    [employee],
  );

  return { shareAttendance };
}

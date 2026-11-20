import { useEffect, useRef } from "react";
import { toast } from "react-toastify";

const toastMethods = {
  error: toast.error,
  info: toast.info,
  success: toast.success,
  warning: toast.warning,
};

export default function useToastMessage(message, type = "info") {
  const lastToastId = useRef("");

  useEffect(() => {
    if (!message) {
      lastToastId.current = "";
      return;
    }

    const toastId = `${type}:${message}`;
    if (lastToastId.current === toastId) return;

    toastMethods[type](message, { toastId });
    lastToastId.current = toastId;
  }, [message, type]);
}

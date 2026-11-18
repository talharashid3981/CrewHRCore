import {
  checkInAttendance,
  checkOutAttendance,
} from "../api/auth.api";

function readBestLocation() {
  return new Promise((resolve, reject) => {
    const attempts = 3;
    let bestPosition = null;
    let lastError = null;

    const read = (attempt) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (
            !bestPosition ||
            position.coords.accuracy < bestPosition.coords.accuracy
          ) {
            bestPosition = position;
          }
          if (bestPosition.coords.accuracy <= 100 || attempt >= attempts) {
            resolve(bestPosition);
          } else {
            window.setTimeout(() => read(attempt + 1), 1200);
          }
        },
        (geoError) => {
          lastError = geoError;
          if (
            geoError.code === geoError.PERMISSION_DENIED ||
            attempt >= attempts
          ) {
            reject(lastError);
          } else {
            window.setTimeout(() => read(attempt + 1), 1200);
          }
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    };

    read(1);
  });
}

export async function submitAttendanceAction(action) {
  if (action !== "in" && action !== "out") {
    throw new Error("This attendance action is not available.");
  }
  if (!navigator.geolocation) {
    throw new Error("Your browser does not support GPS location.");
  }

  let position;
  try {
    position = await readBestLocation();
  } catch (geoError) {
    if (geoError?.code === 1) {
      throw new Error(
        "Location permission is required. Allow location access in your browser site settings and try again.",
        { cause: geoError },
      );
    }
    if (geoError?.code === 2) {
      throw new Error(
        "GPS signal is unavailable. Move to an open area and try again.",
        { cause: geoError },
      );
    }
    if (geoError?.code === 3) {
      throw new Error("The GPS request timed out. Please try again.", {
        cause: geoError,
      });
    }
    throw new Error("Unable to read your GPS location.", { cause: geoError });
  }

  const accuracy = Math.round(position.coords.accuracy);
  if (accuracy > 100) {
    throw new Error(
      `GPS accuracy is currently ${accuracy} meters. Move to an open area, wait for a stronger GPS lock, and try again.`,
    );
  }

  const coordinates = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };
  try {
    return action === "in"
      ? await checkInAttendance(coordinates)
      : await checkOutAttendance(coordinates);
  } catch (requestError) {
    throw new Error(
      requestError.response?.data?.message ||
        "Attendance action could not be completed.",
      { cause: requestError },
    );
  }
}

export const profileImageMaxSize = 5 * 1024 * 1024;
export const profileImageAccept = "image/jpeg,image/png,image/webp";

export function validateProfileImage(file) {
  if (!file) return "Choose an image to upload.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Choose a JPEG, PNG, or WebP image.";
  }
  if (file.size > profileImageMaxSize) {
    return "Profile images must be 5 MB or smaller.";
  }
  return "";
}

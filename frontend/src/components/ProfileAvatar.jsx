import { useState } from "react";

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "U";

export default function ProfileAvatar({
  name = "",
  src,
  alt = "",
  className = "size-10",
  imageClassName = "",
  fallbackClassName = "",
}) {
  const imageUrl = typeof src === "string"
    ? src.trim().replace(/^http:\/\//i, "https://")
    : "";
  const [failedUrl, setFailedUrl] = useState("");
  const showImage = Boolean(imageUrl && imageUrl !== failedUrl);

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`}
      aria-hidden={!alt}
    >
      {showImage ? (
        <img
          alt={alt}
          className={`absolute inset-0 h-full w-full object-cover ${imageClassName}`}
          onError={() => setFailedUrl(imageUrl)}
          src={imageUrl}
        />
      ) : (
        <span className={`flex h-full w-full items-center justify-center ${fallbackClassName}`}>
          {getInitials(name)}
        </span>
      )}
    </span>
  );
}

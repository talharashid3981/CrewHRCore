import logo from "../assets/logo-transparent.webp";

export default function BrandLogo({ alt = "Crew HRCore", className = "" }) {
  return (
    <img
      alt={alt}
      className={`h-full w-full object-contain ${className}`}
      src={logo}
    />
  );
}

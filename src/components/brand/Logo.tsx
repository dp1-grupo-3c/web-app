import Image from "next/image";

type LogoVariant = "mark" | "mark-navy" | "app-tile";

/**
 * Logos oficiales de /public/brand (copiados de svg-resources).
 * "mark" para fondos oscuros; "mark-navy" para fondos claros.
 * En tamaños ≤ 48 px se usa la variante -88, de trazo más grueso.
 */
export function Logo({ size = 48, variant = "mark", className }: { size?: number; variant?: LogoVariant; className?: string }) {
  const file = variant === "app-tile" ? "kindbox-app-tile" : size <= 48 ? `kindbox-${variant}-88` : `kindbox-${variant}`;
  return <Image src={`/brand/${file}.svg`} alt="KindBox" width={size} height={size} unoptimized priority className={className} />;
}

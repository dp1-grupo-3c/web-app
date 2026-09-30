/** Une clases condicionales: cn("a", cond && "b") → "a b". */
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

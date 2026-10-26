import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge class names with Tailwind CSS support（域内自包含副本，同 frontend 版） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

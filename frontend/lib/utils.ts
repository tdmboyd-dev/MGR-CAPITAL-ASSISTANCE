import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Basic HTML sanitizer to prevent XSS attacks
 * Removes script tags, event handlers, and dangerous protocols
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  // Create a temporary element to parse HTML
  const temp = document.createElement("div");
  temp.innerHTML = html;

  // Remove script tags
  const scripts = temp.querySelectorAll("script");
  scripts.forEach((s) => s.remove());

  // Remove event handlers and dangerous attributes
  const allElements = temp.querySelectorAll("*");
  allElements.forEach((el) => {
    // Remove event handlers (onclick, onerror, etc.)
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith("on") || attr.name === "srcdoc") {
        el.removeAttribute(attr.name);
      }
      // Remove javascript: and data: URLs from href/src
      if (["href", "src", "action"].includes(attr.name)) {
        const val = attr.value.toLowerCase().trim();
        if (val.startsWith("javascript:") || val.startsWith("data:text/html")) {
          el.removeAttribute(attr.name);
        }
      }
    });
  });

  // Remove iframe, object, embed, form tags
  ["iframe", "object", "embed", "form", "base"].forEach((tag) => {
    temp.querySelectorAll(tag).forEach((el) => el.remove());
  });

  return temp.innerHTML;
}

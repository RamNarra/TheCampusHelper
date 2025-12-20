import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeExternalHttpUrl(rawUrl: string | undefined | null): string | null {
  const value = (rawUrl || '').trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const protocol = url.protocol.toLowerCase();
    if (protocol !== 'https:' && protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}
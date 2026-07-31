import { env } from '../config/env.js';

export const APP_TIMEZONE = env.TIMEZONE;

const DATE_TIME: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

const DATE_ONLY: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

export function formatDateTime(date: Date): string {
  return date.toLocaleString('uk-UA', DATE_TIME);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('uk-UA', DATE_ONLY);
}

export function formatIsoDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return parts;
}

import { getAllSettings } from '../db/queries';
import { syncNotifications } from './notifications';

export const NOTIFY_DEFAULTS = {
  morningHour: 7,
  morningMinute: 0,
  eveningHour: 21,
  eveningMinute: 0,
  eveningEnabled: true,
  kickoffEnabled: true,
};

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value, fallback) {
  if (value === undefined || value === null) return fallback;
  return value === 'true';
}

/** Map the raw settings key/value map onto the shape syncNotifications expects. */
export function readNotifySettings(settings = {}) {
  return {
    enabled: bool(settings.notify_enabled, false),
    morningHour: num(settings.notify_hour, NOTIFY_DEFAULTS.morningHour),
    morningMinute: num(settings.notify_minute, NOTIFY_DEFAULTS.morningMinute),
    eveningEnabled: bool(settings.evening_enabled, NOTIFY_DEFAULTS.eveningEnabled),
    eveningHour: num(settings.evening_hour, NOTIFY_DEFAULTS.eveningHour),
    eveningMinute: num(settings.evening_minute, NOTIFY_DEFAULTS.eveningMinute),
    kickoffEnabled: bool(settings.kickoff_enabled, NOTIFY_DEFAULTS.kickoffEnabled),
  };
}

/** Re-read settings from the database and bring the OS schedule in line with them. */
export async function resyncNotifications(db) {
  const settings = await getAllSettings(db);
  const config = readNotifySettings(settings);
  await syncNotifications(config);
  return config;
}

export function formatTime(hour, minute) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** Shift an hour/minute pair by `delta` minutes, wrapping within a day. */
export function shiftTime(hour, minute, delta) {
  const total = (((hour * 60 + minute + delta) % 1440) + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

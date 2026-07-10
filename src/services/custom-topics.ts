// Persists user-added ("custom") topics so they survive a page reload.
//
// NATS core subjects are ephemeral: they only show up in the UI while they
// have an active subscription or recent traffic. Topics a user adds manually
// are bookmarks with no server-side presence, so we keep them in localStorage.
// Entries are scoped per server URL so bookmarks never bleed across connections.
import { loadJSON, saveJSON } from '@/lib/storage';

const STORAGE_KEY = 'nats-ui-custom-topics';

type CustomTopicsByServer = Record<string, string[]>;

function readAll(): CustomTopicsByServer {
  const data = loadJSON<CustomTopicsByServer>(STORAGE_KEY, {});
  return data && typeof data === 'object' ? data : {};
}

export function getCustomTopics(server: string): string[] {
  if (!server) return [];
  const topics = readAll()[server];
  return Array.isArray(topics) ? topics : [];
}

export function addCustomTopic(server: string, topic: string): string[] {
  const trimmed = topic.trim();
  if (!server || !trimmed) return getCustomTopics(server);

  const all = readAll();
  const existing = Array.isArray(all[server]) ? all[server] : [];
  const next = [...new Set([...existing, trimmed])].sort();
  all[server] = next;
  saveJSON(STORAGE_KEY, all);
  return next;
}

export function removeCustomTopic(server: string, topic: string): string[] {
  if (!server) return [];

  const all = readAll();
  const existing = Array.isArray(all[server]) ? all[server] : [];
  const next = existing.filter((t) => t !== topic);
  all[server] = next;
  saveJSON(STORAGE_KEY, all);
  return next;
}

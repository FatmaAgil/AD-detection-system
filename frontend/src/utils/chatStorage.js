export const CHAT_KEY = "chat_history";

export function loadChats() {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChat(chat) {
  try {
    const current = loadChats();
    // ensure unique id
    const entry = { ...chat, id: chat.id ?? Date.now() };
    current.unshift(entry);
    localStorage.setItem(CHAT_KEY, JSON.stringify(current));
    return true;
  } catch (e) {
    console.error("saveChat error", e);
    return false;
  }
}

export function clearChats() {
  localStorage.removeItem(CHAT_KEY);
  return true;
}
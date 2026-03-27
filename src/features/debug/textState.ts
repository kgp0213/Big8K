const DEBUG_MULTI_COMMANDS_KEY = "big8k.debug.multiCommands";

export const loadMultiCommands = (count = 4): string[] => {
  try {
    const raw = window.localStorage.getItem(DEBUG_MULTI_COMMANDS_KEY);
    if (!raw) {
      return Array.from({ length: count }, () => "");
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return Array.from({ length: count }, () => "");
    }
    const values = parsed.map((item) => (typeof item === "string" ? item : ""));
    while (values.length < count) values.push("");
    return values.slice(0, count);
  } catch {
    return Array.from({ length: count }, () => "");
  }
};

export const saveMultiCommands = (items: string[]) => {
  window.localStorage.setItem(DEBUG_MULTI_COMMANDS_KEY, JSON.stringify(items));
};

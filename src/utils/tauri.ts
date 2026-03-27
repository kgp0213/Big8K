// 检查是否在 Tauri 环境中运行
// Tauri dev 模式常见为 http://localhost:1421，因此不能只靠协议/域名判断。
export const isTauri = () => {
  if (typeof window === 'undefined') return false;
  const w = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
    __TAURI_IPC__?: unknown;
  };
  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__ || w.__TAURI_IPC__);
};

// 安全调用 Tauri invoke，如果明确不在 Tauri 环境中则返回 mock 结果
export const tauriInvoke = async <T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (error) {
    if (!isTauri()) {
      console.warn(`[Browser] Skipping Tauri command: ${cmd}`);
      return { success: false, message: 'Browser mode', error: 'Not in Tauri environment' } as T;
    }

    throw error;
  }
};

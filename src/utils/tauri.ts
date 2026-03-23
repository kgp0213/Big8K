// 检查是否在 Tauri 环境中运行
// Tauri 2 桌面端不可靠地暴露 window.__TAURI__，不要用它做硬判断。
export const isTauri = () => {
  return typeof window !== 'undefined' && (window.location.protocol === 'tauri:' || window.location.hostname === 'tauri.localhost');
};

// 安全调用 Tauri invoke，如果在浏览器中则返回 mock 结果
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

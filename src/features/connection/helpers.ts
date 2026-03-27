export const getAdbStatusLabel = (status: string) => {
  switch (status) {
    case "device":
      return "已连接";
    case "offline":
      return "设备已连接但离线";
    case "unauthorized":
      return "设备未授权，请在设备上确认调试授权";
    case "recovery":
      return "设备处于 Recovery 模式";
    case "sideload":
      return "设备处于 Sideload 模式";
    case "bootloader":
      return "设备处于 Bootloader 模式";
    default:
      return status || "未知状态";
  }
};

export const getAdbStatusTone = (status: string) => {
  switch (status) {
    case "device":
      return "success";
    case "offline":
    case "unauthorized":
    case "recovery":
    case "sideload":
    case "bootloader":
      return "warning";
    default:
      return "error";
  }
};

export const getAdbStatusBadgeClass = (status: string) => {
  const tone = getAdbStatusTone(status);
  if (tone === "success") {
    return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
  }
  if (tone === "warning") {
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";
  }
  return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
};

import { Play, RefreshCw, Settings2, TerminalSquare, Upload, type LucideIcon } from "lucide-react";

export type DeployAction = {
  label: string;
  description: string;
  icon: LucideIcon;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  command?: string;
};

export type DeployActionGroup = {
  title: string;
  description: string;
  actions: string[];
};

export type HostNetworkCard = {
  name: string;
  ipv4: string;
};

export type LocalNetworkInfo = {
  success: boolean;
  cards: HostNetworkCard[];
  error?: string;
};

export type StaticIpPreset = {
  label: string;
  ip: string;
  gateway: string;
  description: string;
};

export const deployActions: DeployAction[] = [
  { label: "Install tools", description: "部署 Python 库和工具", icon: Upload, command: "deploy_install_tools" },
  { label: "Install App", description: "部署刷图应用", icon: Upload, command: "deploy_install_app" },
  { label: "Set default pattern L128", description: "设置默认灰阶画面", icon: Play, command: "deploy_set_default_pattern" },
  { label: "CMD line: multi-user", description: "命令行模式", icon: TerminalSquare, command: "deploy_set_multi_user" },
  { label: "graphical 图形界面", description: "图形界面模式（执行后自动重启）", icon: RefreshCw, command: "deploy_set_graphical" },
  { label: "开启SSH登录", description: "配置 SSH 并设置 root 密码", icon: Settings2, tone: "warning", command: "deploy_enable_ssh" },
];

export const STATIC_IP_PRESETS: StaticIpPreset[] = [
  { label: "192.168.1.100", ip: "192.168.1.100", gateway: "192.168.1.1", description: "对应旧版 SetStaticIPaddress1p100ToolStripMenuItem_Click" },
  { label: "192.168.137.100", ip: "192.168.137.100", gateway: "192.168.137.1", description: "对应旧版 SetStaticIPaddress137100ToolStripMenuItem_Click" },
];

export const DEPLOY_ACTION_GROUPS: DeployActionGroup[] = [
  {
    title: "基础环境",
    description: "先把脚本和依赖装齐，后续画面同步、应用下发都依赖这里。",
    actions: ["deploy_install_tools", "deploy_install_app"],
  },
  {
    title: "默认显示与模式",
    description: "部署后把平台切到适合联调的默认显示内容与运行模式；需要远程排查时也可先开启 SSH。",
    actions: ["deploy_set_default_pattern", "deploy_set_multi_user", "deploy_enable_ssh"],
  },
  {
    title: "系统UI",
    description: "图形界面模式切换。执行后会自动重启。",
    actions: ["deploy_set_graphical"],
  },
];

export function getButtonToneClass(tone?: DeployAction["tone"]) {
  switch (tone) {
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300";
    case "danger":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300";
    default:
      return "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-200";
  }
}

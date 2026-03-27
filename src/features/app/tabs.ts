import type { LucideIcon } from "lucide-react";
import { Cpu, Home, Image, Monitor, Terminal, Wifi } from "lucide-react";
import type { TabType } from "./types";

export const tabs: { id: TabType; label: string; icon: LucideIcon }[] = [
  { id: "mipi", label: "点屏配置", icon: Monitor },
  { id: "debug", label: "命令调试", icon: Terminal },
  { id: "fb", label: "显示画面", icon: Image },
  { id: "power", label: "电源读取", icon: Cpu },
  { id: "network", label: "网络配置", icon: Wifi },
  { id: "home", label: "总览", icon: Home },
];

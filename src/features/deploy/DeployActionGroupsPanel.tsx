import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { DEPLOY_ACTION_GROUPS, deployActions, getButtonToneClass } from "./types";
import type { DeployAction } from "./types";

type DeployActionGroupsPanelProps = {
  actionMap: Map<string | undefined, DeployAction>;
  runningAction: string | null;
  completedActions: string[];
  adbReady: boolean;
  browserPreview: boolean;
  onRunAction: (action: DeployAction) => Promise<void> | void;
};

export function DeployActionGroupsPanel({
  actionMap,
  runningAction,
  completedActions,
  adbReady,
  browserPreview,
  onRunAction,
}: DeployActionGroupsPanelProps) {
  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <Upload className="w-4 h-4" />
        刷机后依次点击
      </div>
      <div className="panel-body space-y-4">
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
          刷机后的快速初始化流程，按顺序执行更稳妥。
        </div>
        <div className="space-y-4">
          {DEPLOY_ACTION_GROUPS.map((group) => (
            <div key={group.title} className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div>
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{group.title}</div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{group.description}</div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {group.actions.map((command) => {
                  const item = actionMap.get(command);
                  if (!item) return null;

                  const Icon = item.icon;
                  const isRunning = runningAction === item.command;
                  const isDone = Boolean(item.command && completedActions.includes(item.command));
                  const itemIndex = deployActions.findIndex((candidate) => candidate.command === item.command);
                  const displayIndex = itemIndex === 4 ? 6 : itemIndex === 5 ? 5 : itemIndex + 1;

                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => void onRunAction(item)}
                      disabled={(!adbReady && !browserPreview) || Boolean(runningAction)}
                      className={`rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${getButtonToneClass(item.tone)}`}
                      title={adbReady || browserPreview ? item.description : "请先连接 8K 平台"}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/5 text-xs font-semibold dark:bg-white/10">
                          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> : displayIndex}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <Icon className="w-4 h-4" />
                              {item.label}
                            </div>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full ${isDone ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                              {isDone ? "已完成" : "待执行"}
                            </span>
                          </div>
                          <div className="mt-1 text-xs opacity-80">{item.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

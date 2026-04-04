import { Wrench } from "lucide-react";
import { DeployActionGroupsPanel, DeployNetworkPanel, useDeployTabModel } from "../features/deploy";

export default function DeployTab() {
  const {
    browserPreview,
    adbReady,
    actionMap,
    stepSummary,
    readyHint,
    networkCards,
    localNetworkInfo,
    lastActionMessage,
    runningAction,
    completedActions,
    isLoadingLocalIp,
    isSettingIp,
    selectedPresetIp,
    handleViewLocalIp,
    handleSetStaticIp,
    handleDeployAction,
  } = useDeployTabModel();

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-header flex items-center gap-2">
          <Wrench className="w-4 h-4" />
          配置部署
        </div>
        <div className="panel-body space-y-3">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-3 items-stretch">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-900/30">
              <div className="text-xs text-gray-500 dark:text-gray-400">部署进度</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{stepSummary.done} / {stepSummary.total}</div>
                <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className="h-full bg-primary-500 transition-all" style={{ width: `${stepSummary.percent}%` }} />
                </div>
                <div className="text-xs text-gray-500">{stepSummary.percent}%</div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-900/30">
              <div className="text-xs text-gray-500 dark:text-gray-400">执行前提</div>
              <div className={`mt-2 text-sm font-semibold ${adbReady ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>{readyHint}</div>
            </div>
          </div>

          {lastActionMessage ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
              {lastActionMessage}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_340px] gap-4 items-start">
        <DeployActionGroupsPanel
          actionMap={actionMap}
          runningAction={runningAction}
          completedActions={completedActions}
          adbReady={adbReady}
          browserPreview={browserPreview}
          onRunAction={handleDeployAction}
        />

        <DeployNetworkPanel
          adbReady={adbReady}
          isSettingIp={isSettingIp}
          isLoadingLocalIp={isLoadingLocalIp}
          selectedPresetIp={selectedPresetIp}
          localNetworkInfo={localNetworkInfo}
          networkCards={networkCards}
          onSetStaticIp={handleSetStaticIp}
          onViewLocalIp={handleViewLocalIp}
        />
      </div>
    </div>
  );
}

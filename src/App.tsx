import { useState, useEffect } from 'react';
import { Crosshair, Target } from 'lucide-react';
import {
  CombatReport,
  LoadoutConfig,
  MAP_ZONES,
  OPERATOR_ROLES,
  OPTICS,
  WEAPONS,
} from './types/tactical';
import { ArmoryWorkbench } from './components/ArmoryWorkbench';
import { TacticalBriefing } from './components/TacticalBriefing';
import { DeltaArena3D } from './components/DeltaArena3D';

const STORAGE_KEY = 'delta_tactical_combat_reports_v1';

export default function App() {
  const [inArena, setInArena] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const [loadout, setLoadout] = useState<LoadoutConfig>({
    weaponId: 'm4a1',
    opticId: 'red_dot',
    muzzleId: 'suppressor',
    magazineId: 'std_mag',
    operatorRole: 'assault',
    mapId: 'zero_dam',
  });

  const [reports, setReports] = useState<CombatReport[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CombatReport[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(0, 12)));
    } catch {
      // ignore storage quota errors
    }
  }, [reports]);

  const handleMissionComplete = (report: CombatReport) => {
    setReports((prev) => [report, ...prev].slice(0, 12));
  };

  if (inArena) {
    return (
      <DeltaArena3D
        loadout={loadout}
        onExit={() => setInArena(false)}
        onMissionComplete={handleMissionComplete}
      />
    );
  }

  const activeWeapon = WEAPONS[loadout.weaponId];
  const activeOptic = OPTICS.find((o) => o.id === loadout.opticId) ?? OPTICS[0];
  const activeMap = MAP_ZONES[loadout.mapId];
  const activeOperator =
    OPERATOR_ROLES.find((r) => r.id === loadout.operatorRole) ?? OPERATOR_ROLES[0];

  return (
    <div className="min-h-screen bg-[#0B0E11] text-[#E6EAEF]">
      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-30 bg-[#0B0E11]/95 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#briefing"
            className="font-display text-lg font-bold tracking-wide text-white whitespace-nowrap shrink-0"
          >
            三角洲行動
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a
              href="#briefing"
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              作戰簡報
            </a>
            <a
              href="#armory"
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              武器改裝
            </a>
            <a
              href="#zones"
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              戰場地圖
            </a>
            <a
              href="#records"
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              戰績紀錄
            </a>
          </nav>

          <button
            type="button"
            onClick={() => setInArena(true)}
            className="px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            進入實戰
          </button>
        </div>
      </header>

      <main>
        {/* Hero Operational Briefing */}
        <section id="briefing" className="relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-6 pt-12 pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center py-4">
                <div className="flex items-center gap-2 text-xs text-amber-400 font-medium mb-3">
                  <span>戰術撤離行動</span>
                  <span aria-hidden="true">·</span>
                  <span>即時 3D 網頁實戰演練</span>
                </div>

                <h1 className="text-4xl md:text-5xl font-bold text-white leading-[1.12] tracking-tight text-balance mb-5">
                  三角洲特戰突擊與戰術撤離系統
                </h1>

                <p className="text-base text-slate-300 leading-relaxed max-w-xl mb-7">
                  在瀏覽器中直接完成槍械模組化改裝，並於即時 3D 戰場進行第一人稱交火演練。突破巡邏防線、擷取加密情報箱，並在時限內抵達撤離停機坪。
                </p>

                <div className="flex flex-wrap items-center gap-4 mb-6">
                  <button
                    type="button"
                    onClick={() => setInArena(true)}
                    className="flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <Crosshair className="w-4 h-4" />
                    進入 3D 實戰演練
                  </button>
                  <a
                    href="#armory"
                    className="px-5 py-3 text-sm font-medium text-slate-200 hover:text-white bg-[#141920] hover:bg-[#1B222C] border border-white/10 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    調校武器配置
                  </a>
                </div>

                <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>目前整備：{activeWeapon.name}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeOptic.name}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeOperator.name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-200">{activeMap.name}</span>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="relative h-full min-h-[280px] lg:min-h-[380px] rounded-md overflow-hidden bg-[#141920] border border-white/10">
                  {!heroImgFailed ? (
                    <img
                      src="/src/assets/images/delta_hero_dam_1794898536146.jpg"
                      alt="三角洲零號大壩作戰前線景觀"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#19212C] to-[#0E1217] p-8 text-center">
                      <Target className="w-10 h-10 text-amber-400 mb-3" />
                      <div className="text-base font-semibold text-white">零號大壩作戰區</div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E11]/85 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between text-xs text-slate-200">
                    <span>前沿偵察影像 · 零號大壩區域</span>
                    <span className="font-mono-tabular text-amber-300">WASD + 滑鼠瞄準</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Full-Width 4-Column Operational Summary Strip */}
            <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 border border-white/10 rounded-md bg-[#11151B] divide-y lg:divide-y-0 lg:divide-x divide-white/10">
              <div className="p-5">
                <div className="text-xs text-slate-400 mb-1">模組化主武器</div>
                <div className="text-2xl font-bold font-mono-tabular text-white">4 款平台</div>
                <div className="text-xs text-slate-400 mt-1">突擊步槍 / 衝鋒槍 / 狙擊槍</div>
              </div>
              <div className="p-5">
                <div className="text-xs text-slate-400 mb-1">實戰部署戰區</div>
                <div className="text-2xl font-bold font-mono-tabular text-white">2 張地圖</div>
                <div className="text-xs text-slate-400 mt-1">零號大壩外圍 · 長弓溪谷前哨</div>
              </div>
              <div className="p-5">
                <div className="text-xs text-slate-400 mb-1">即時彈道判定</div>
                <div className="text-2xl font-bold font-mono-tabular text-amber-400">2.4× 爆頭</div>
                <div className="text-xs text-slate-400 mt-1">距離衰減與開鏡後座控制</div>
              </div>
              <div className="p-5">
                <div className="text-xs text-slate-400 mb-1">戰術撤離目標</div>
                <div className="text-2xl font-bold font-mono-tabular text-emerald-400">情報 + 撤離</div>
                <div className="text-xs text-slate-400 mt-1">支援破片手榴彈與雙武器切換</div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Weapon & Operator Workbench */}
        <ArmoryWorkbench
          loadout={loadout}
          onChange={setLoadout}
          onDeploy={() => setInArena(true)}
        />

        {/* Map Zones & Tactical Deployment Briefing */}
        <TacticalBriefing
          selectedMapId={loadout.mapId}
          onSelectMap={(mapId) => setLoadout((prev) => ({ ...prev, mapId }))}
          onDeploy={() => setInArena(true)}
        />

        {/* Combat Reports Section */}
        <section id="records" className="py-20 border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-xs font-medium text-amber-400 tracking-wide mb-2">
                  03. 戰績紀錄
                </p>
                <h2 className="text-2xl font-bold text-white">歷次實戰演練結算</h2>
              </div>
              {reports.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReports([])}
                  className="text-xs text-slate-400 hover:text-white transition-colors self-start sm:self-auto"
                >
                  清除紀錄
                </button>
              )}
            </div>

            {reports.length === 0 ? (
              <div className="border border-white/10 rounded-md bg-[#11151B] p-8 text-center">
                <p className="text-sm text-slate-300 mb-4">
                  尚未完成任何實戰撤離行動。點擊「進入實戰」即可體驗 3D 第一人稱對抗並自動記錄作戰表現。
                </p>
                <button
                  type="button"
                  onClick={() => setInArena(true)}
                  className="px-5 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md transition-colors"
                >
                  開始首次行動
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-white/10 rounded-md bg-[#11151B]">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-xs text-slate-400">
                    <tr>
                      <th className="py-3.5 px-4 font-medium">任務結果</th>
                      <th className="py-3.5 px-4 font-medium">作戰戰區</th>
                      <th className="py-3.5 px-4 font-medium">主戰武器</th>
                      <th className="py-3.5 px-4 font-medium">肅清 / 爆頭</th>
                      <th className="py-3.5 px-4 font-medium">命中率</th>
                      <th className="py-3.5 px-4 font-medium">加密情報</th>
                      <th className="py-3.5 px-4 font-medium">歷時</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {reports.map((rep, idx) => {
                      const acc =
                        rep.shotsFired > 0
                          ? Math.round((rep.shotsHit / rep.shotsFired) * 100)
                          : 0;
                      const zone = MAP_ZONES[rep.mapId];
                      return (
                        <tr key={`${rep.timestamp}-${idx}`} className="text-slate-200">
                          <td
                            className={`py-3.5 px-4 font-medium ${
                              rep.extracted ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {rep.extracted ? '成功撤離' : '行動陣亡'}
                          </td>
                          <td className="py-3.5 px-4">{zone?.name ?? rep.mapId}</td>
                          <td className="py-3.5 px-4 text-slate-300">{rep.weaponName}</td>
                          <td className="py-3.5 px-4 font-mono-tabular">
                            {rep.eliminations} / {rep.headshots}
                          </td>
                          <td className="py-3.5 px-4 font-mono-tabular">{acc}%</td>
                          <td className="py-3.5 px-4 font-mono-tabular">
                            {rep.intelCollected}/{rep.intelTotal}
                          </td>
                          <td className="py-3.5 px-4 font-mono-tabular text-slate-400">
                            {rep.durationSec}s
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>三角洲行動 · 網頁端 3D 戰術槍戰演練系統</span>
          <span>操作提示：WASD 移動 · 滑鼠射擊與開鏡 · R 換彈 · G 手榴彈 · E 互動</span>
        </div>
      </footer>
    </div>
  );
}

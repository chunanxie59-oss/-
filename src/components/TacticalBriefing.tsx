import React, { useState } from 'react';
import { MAP_ZONES, MapId } from '../types/tactical';
import { MapPin } from 'lucide-react';

interface TacticalBriefingProps {
  selectedMapId: MapId;
  onSelectMap: (mapId: MapId) => void;
  onDeploy: () => void;
}

export const TacticalBriefing: React.FC<TacticalBriefingProps> = ({
  selectedMapId,
  onSelectMap,
  onDeploy,
}) => {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const mapList = Object.values(MAP_ZONES);

  return (
    <section id="zones" className="py-20 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs font-medium text-amber-400 tracking-wide mb-2">
              02. 戰場地圖部署
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white text-balance">
              選擇交戰戰區與撤離任務路線
            </h2>
          </div>
          <p className="text-sm text-slate-400 max-w-md leading-relaxed">
            每張戰區具備獨立地形遮蔽結構、能見度天候與巡邏敵軍配置。蒐集散落於掩體間的加密情報箱，並抵達北部停機坪完成撤離。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {mapList.map((zone) => {
            const active = selectedMapId === zone.id;
            const imgBroken = failedImages[zone.id];
            return (
              <div
                key={zone.id}
                className={`rounded-md overflow-hidden border transition-colors bg-[#12161C] ${
                  active ? 'border-amber-500' : 'border-white/10'
                }`}
              >
                <div className="relative aspect-[16/10] bg-[#161B22] overflow-hidden">
                  {!imgBroken ? (
                    <img
                      src={zone.imageUrl}
                      alt={`${zone.name} 空拍偵察圖`}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [zone.id]: true }))
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#19202A] to-[#0E1217] text-slate-400">
                      <MapPin className="w-8 h-8 text-amber-400 mb-2" />
                      <span className="text-sm font-medium text-white">{zone.name}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#12161C] via-[#12161C]/20 to-transparent" />
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                    <span>{zone.terrainType}</span>
                    <span aria-hidden="true">·</span>
                    <span>{zone.visibility}</span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">{zone.name}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed mb-5">
                    {zone.briefing}
                  </p>

                  <div className="grid grid-cols-3 gap-3 py-3 border-y border-white/10 text-xs mb-5">
                    <div>
                      <div className="text-slate-400">敵軍巡邏</div>
                      <div className="font-mono-tabular font-semibold text-white mt-0.5">
                        {zone.hostileCount} 名
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">情報目標</div>
                      <div className="font-mono-tabular font-semibold text-emerald-400 mt-0.5">
                        {zone.intelCount} 處
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">撤離時限</div>
                      <div className="font-mono-tabular font-semibold text-amber-400 mt-0.5">
                        {zone.timeLimitSec} 秒
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectMap(zone.id)}
                      className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/50'
                          : 'bg-[#191F28] hover:bg-[#222A36] text-slate-200 border border-white/10'
                      }`}
                    >
                      {active ? '已鎖定此戰區' : '選擇此戰區'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectMap(zone.id);
                        onDeploy();
                      }}
                      className="px-5 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      立即部署
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

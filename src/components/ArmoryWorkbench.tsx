import React, { useState } from 'react';
import {
  LoadoutConfig,
  MAGAZINES,
  MUZZLES,
  OPERATOR_ROLES,
  OPTICS,
  WEAPONS,
  WeaponId,
  computeBallistics,
} from '../types/tactical';
import { Crosshair, Shield } from 'lucide-react';

interface ArmoryWorkbenchProps {
  loadout: LoadoutConfig;
  onChange: (next: LoadoutConfig) => void;
  onDeploy: () => void;
}

export const ArmoryWorkbench: React.FC<ArmoryWorkbenchProps> = ({
  loadout,
  onChange,
  onDeploy,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const selectedWeapon = WEAPONS[loadout.weaponId];
  const ballistics = computeBallistics(loadout);
  const weaponKeys = Object.keys(WEAPONS) as WeaponId[];

  const statRows: { label: string; value: string; percent: number }[] = [
    {
      label: '單發基礎傷害',
      value: `${ballistics.damage}`,
      percent: Math.min(100, Math.round((ballistics.damage / 100) * 100)),
    },
    {
      label: '理論射速 (RPM)',
      value: `${ballistics.rpm}`,
      percent: Math.min(100, Math.round((ballistics.rpm / 900) * 100)),
    },
    {
      label: '後座力控制',
      value: `${ballistics.recoilControl} / 100`,
      percent: ballistics.recoilControl,
    },
    {
      label: '有效射程',
      value: `${ballistics.effectiveRange} m`,
      percent: Math.min(100, Math.round((ballistics.effectiveRange / 200) * 100)),
    },
  ];

  return (
    <section id="armory" className="py-20 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs font-medium text-amber-400 tracking-wide mb-2">
              01. 武器改裝工坊
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white text-balance">
              模組化槍械調校與幹員兵種配置
            </h2>
          </div>
          <p className="text-sm text-slate-400 max-w-md leading-relaxed">
            所有光學瞄具、槍口抑制與擴容彈匣改裝皆會即時改變實戰彈道數值，並直接套用至 3D 演練場的第一人稱槍械模型。
          </p>
        </div>

        {/* Weapon Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-8 pb-4 border-b border-white/10">
          {weaponKeys.map((wId) => {
            const w = WEAPONS[wId];
            const active = loadout.weaponId === wId;
            return (
              <button
                key={wId}
                type="button"
                onClick={() => onChange({ ...loadout, weaponId: wId })}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'bg-[#151A21] text-slate-300 hover:text-white border border-white/10'
                }`}
              >
                {w.name}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Weapon Visual + Live Ballistics */}
          <div className="lg:col-span-5">
            <div className="relative aspect-[16/9] rounded-md overflow-hidden bg-[#151A21] border border-white/10 mb-6">
              {!imgFailed ? (
                <img
                  src="/src/assets/images/delta_armory_rifle_1794898537087.jpg"
                  alt="模組化戰術突擊步槍工坊實拍"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#181E27] to-[#0E1217] text-slate-400 p-6">
                  <Crosshair className="w-8 h-8 text-amber-400 mb-2" />
                  <span className="text-sm font-medium text-white">{selectedWeapon.name}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E11]/90 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-slate-300">
                <span>{selectedWeapon.category}</span>
                <span className="font-mono-tabular">{selectedWeapon.caliber}</span>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                <span>{selectedWeapon.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">彈匣容量 {ballistics.magCapacity} 發</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">換彈 {ballistics.reloadSec} 秒</span>
                {ballistics.suppressed && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-400">低聲紋消音</span>
                  </>
                )}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {selectedWeapon.description}
              </p>
            </div>

            {/* Ballistic Metrics */}
            <div className="space-y-3.5 pt-4 border-t border-white/10">
              {statRows.map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-400">{row.label}</span>
                    <span className="font-mono-tabular font-semibold text-white">{row.value}</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#191F28] rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-200"
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Modular Attachments & Operator Selection */}
          <div className="lg:col-span-7 space-y-8">
            {/* Optic Slot */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">光學瞄具槽位</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {OPTICS.map((opt) => {
                  const active = loadout.opticId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChange({ ...loadout, opticId: opt.id })}
                      className={`text-left p-3.5 rounded-md border transition-colors ${
                        active
                          ? 'bg-[#1A2029] border-amber-500 text-white'
                          : 'bg-[#12161C] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="text-sm font-semibold mb-1">{opt.name}</div>
                      <div className="text-xs text-slate-400 leading-snug">{opt.summary}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Muzzle Slot */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">槍口抑制與制退器</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {MUZZLES.map((muz) => {
                  const active = loadout.muzzleId === muz.id;
                  return (
                    <button
                      key={muz.id}
                      type="button"
                      onClick={() => onChange({ ...loadout, muzzleId: muz.id })}
                      className={`text-left p-3.5 rounded-md border transition-colors ${
                        active
                          ? 'bg-[#1A2029] border-amber-500 text-white'
                          : 'bg-[#12161C] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="text-sm font-semibold mb-1">{muz.name}</div>
                      <div className="text-xs text-slate-400 leading-snug">{muz.summary}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Magazine & Operator Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-white/10">
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">彈匣供彈系統</h3>
                <div className="space-y-2.5">
                  {MAGAZINES.map((mag) => {
                    const active = loadout.magazineId === mag.id;
                    return (
                      <button
                        key={mag.id}
                        type="button"
                        onClick={() => onChange({ ...loadout, magazineId: mag.id })}
                        className={`w-full text-left p-3 rounded-md border transition-colors ${
                          active
                            ? 'bg-[#1A2029] border-amber-500 text-white'
                            : 'bg-[#12161C] border-white/10 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <div className="text-sm font-semibold">{mag.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{mag.summary}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                  特戰幹員兵種
                </h3>
                <div className="space-y-2.5">
                  {OPERATOR_ROLES.map((op) => {
                    const active = loadout.operatorRole === op.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => onChange({ ...loadout, operatorRole: op.id })}
                        className={`w-full text-left p-3 rounded-md border transition-colors ${
                          active
                            ? 'bg-[#1A2029] border-amber-500 text-white'
                            : 'bg-[#12161C] border-white/10 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <div className="text-sm font-semibold">{op.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{op.specialty}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-400">
                當前配置：{selectedWeapon.name} · {OPTICS.find((o) => o.id === loadout.opticId)?.name}
              </div>
              <button
                type="button"
                onClick={onDeploy}
                className="px-6 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                以此配置投入實戰
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

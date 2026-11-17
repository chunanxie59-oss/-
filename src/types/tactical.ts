export type WeaponId = 'm4a1' | 'ak12' | 'mp5sd' | 'awm';
export type OpticId = 'iron' | 'red_dot' | 'acog_25x';
export type MuzzleId = 'standard' | 'suppressor' | 'brake';
export type MagazineId = 'std_mag' | 'ext_mag';
export type MapId = 'zero_dam' | 'longbow_valley';
export type OperatorRole = 'assault' | 'recon' | 'support';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  category: string;
  caliber: string;
  baseDamage: number;
  rpm: number;
  baseRecoil: number;
  baseRange: number;
  magSize: number;
  reloadSec: number;
  auto: boolean;
  muzzleVelocity: number;
  description: string;
}

export interface AttachmentOption<T extends string> {
  id: T;
  name: string;
  summary: string;
  damageDelta: number;
  recoilDelta: number;
  rangeDelta: number;
  adsFov: number;
  suppressed?: boolean;
  magBonus?: number;
}

export interface LoadoutConfig {
  weaponId: WeaponId;
  opticId: OpticId;
  muzzleId: MuzzleId;
  magazineId: MagazineId;
  operatorRole: OperatorRole;
  mapId: MapId;
}

export interface ComputedBallistics {
  damage: number;
  rpm: number;
  recoilControl: number;
  effectiveRange: number;
  magCapacity: number;
  reloadSec: number;
  adsFov: number;
  suppressed: boolean;
  auto: boolean;
}

export interface CombatReport {
  mapId: MapId;
  weaponName: string;
  extracted: boolean;
  eliminations: number;
  headshots: number;
  shotsFired: number;
  shotsHit: number;
  intelCollected: number;
  intelTotal: number;
  durationSec: number;
  timestamp: string;
}

export interface MapZoneSpec {
  id: MapId;
  name: string;
  terrainType: string;
  visibility: string;
  hostileCount: number;
  intelCount: number;
  timeLimitSec: number;
  imageUrl: string;
  briefing: string;
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  groundColor: number;
  accentColor: number;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  m4a1: {
    id: 'm4a1',
    name: 'M4A1 戰術突擊步槍',
    category: '突擊步槍',
    caliber: '5.56×45mm NATO',
    baseDamage: 28,
    rpm: 750,
    baseRecoil: 24,
    baseRange: 85,
    magSize: 30,
    reloadSec: 1.85,
    auto: true,
    muzzleVelocity: 880,
    description: '高模組化特戰主力步槍，彈道穩定、近中距離連射表現均衡。',
  },
  ak12: {
    id: 'ak12',
    name: 'AK-12 重型突擊步槍',
    category: '突擊步槍',
    caliber: '5.45×39mm',
    baseDamage: 35,
    rpm: 650,
    baseRecoil: 34,
    baseRange: 95,
    magSize: 30,
    reloadSec: 2.05,
    auto: true,
    muzzleVelocity: 900,
    description: '單發穿透力突出，對抗重甲敵兵具備壓倒性停滯效能。',
  },
  mp5sd: {
    id: 'mp5sd',
    name: 'MP5-SD 特種衝鋒槍',
    category: '衝鋒槍',
    caliber: '9×19mm',
    baseDamage: 22,
    rpm: 860,
    baseRecoil: 16,
    baseRange: 52,
    magSize: 30,
    reloadSec: 1.55,
    auto: true,
    muzzleVelocity: 400,
    description: '極低後座與高速射擊節奏，適合大壩貨櫃區近身突入。',
  },
  awm: {
    id: 'awm',
    name: 'AWM 戰術狙擊步槍',
    category: '精確射手',
    caliber: '.338 Lapua',
    baseDamage: 92,
    rpm: 52,
    baseRecoil: 58,
    baseRange: 180,
    magSize: 8,
    reloadSec: 2.45,
    auto: false,
    muzzleVelocity: 936,
    description: '遠距離高精準單發武器，命中頭部可一擊瓦解任何目標。',
  },
};

export const OPTICS: AttachmentOption<OpticId>[] = [
  {
    id: 'iron',
    name: '戰術機械準星',
    summary: '最快開鏡反應與寬闊視野',
    damageDelta: 0,
    recoilDelta: 0,
    rangeDelta: 0,
    adsFov: 56,
  },
  {
    id: 'red_dot',
    name: '全像紅點瞄具',
    summary: '清晰光學準心，中近距鎖定穩定',
    damageDelta: 0,
    recoilDelta: -3,
    rangeDelta: 8,
    adsFov: 46,
  },
  {
    id: 'acog_25x',
    name: '2.5× 戰術倍率鏡',
    summary: '遠距離精準識別與彈著修正',
    damageDelta: 2,
    recoilDelta: -4,
    rangeDelta: 22,
    adsFov: 28,
  },
];

export const MUZZLES: AttachmentOption<MuzzleId>[] = [
  {
    id: 'standard',
    name: '標準防火帽',
    summary: '保留原始彈道特性與機動重量',
    damageDelta: 0,
    recoilDelta: 0,
    rangeDelta: 0,
    adsFov: 0,
    suppressed: false,
  },
  {
    id: 'suppressor',
    name: '特戰一體消音器',
    summary: '大幅降低槍口火光與聲學特徵',
    damageDelta: -1,
    recoilDelta: -5,
    rangeDelta: 6,
    adsFov: 0,
    suppressed: true,
  },
  {
    id: 'brake',
    name: '雙室制退器',
    summary: '顯著抑制連發上揚，提升壓槍精度',
    damageDelta: 2,
    recoilDelta: -8,
    rangeDelta: 4,
    adsFov: 0,
    suppressed: false,
  },
];

export const MAGAZINES: AttachmentOption<MagazineId>[] = [
  {
    id: 'std_mag',
    name: '標準彈匣',
    summary: '輕量化快速換彈配置',
    damageDelta: 0,
    recoilDelta: 0,
    rangeDelta: 0,
    adsFov: 0,
    magBonus: 0,
  },
  {
    id: 'ext_mag',
    name: '高容量擴容彈匣',
    summary: '彈藥續戰提升 50%，持續火力壓制',
    damageDelta: 0,
    recoilDelta: 2,
    rangeDelta: 0,
    adsFov: 0,
    magBonus: 0.5,
  },
];

export const OPERATOR_ROLES: {
  id: OperatorRole;
  name: string;
  specialty: string;
  armorBonus: number;
  speedMultiplier: number;
}[] = [
  {
    id: 'assault',
    name: '突擊兵 · 紅狼',
    specialty: '機動速度 +12%，衝刺與切槍節奏更快',
    armorBonus: 0,
    speedMultiplier: 1.12,
  },
  {
    id: 'recon',
    name: '偵察兵 · 露娜',
    specialty: '開鏡穩定度提升，戰場情報擷取加速',
    armorBonus: 10,
    speedMultiplier: 1.04,
  },
  {
    id: 'support',
    name: '工程支援 · 威龍',
    specialty: '防彈插板強化，額外獲得 +35 點護甲值',
    armorBonus: 35,
    speedMultiplier: 0.96,
  },
];

export const MAP_ZONES: Record<MapId, MapZoneSpec> = {
  zero_dam: {
    id: 'zero_dam',
    name: '零號大壩外圍',
    terrainType: '混凝土壩區與貨櫃調度場',
    visibility: '薄霧陰天 · 中近距交火',
    hostileCount: 10,
    intelCount: 3,
    timeLimitSec: 180,
    imageUrl: '/src/assets/images/delta_hero_dam_1794898536146.jpg',
    briefing:
      '重型水壩下游的貨櫃集散平台，掩體密集且存在多條側翼通道。收集 3 份加密情報箱並抵達北部撤離停機坪。',
    skyColor: 0x3b444e,
    fogColor: 0x3b444e,
    fogDensity: 0.011,
    groundColor: 0x3f4347,
    accentColor: 0xd97706,
  },
  longbow_valley: {
    id: 'longbow_valley',
    name: '長弓溪谷前哨',
    terrainType: '乾旱峽谷與雷達通訊站',
    visibility: '晴朗強光 · 中遠距對槍',
    hostileCount: 12,
    intelCount: 4,
    timeLimitSec: 210,
    imageUrl: '/src/assets/images/delta_map_valley_1794898536477.jpg',
    briefing:
      '高地荒漠雷達哨所，視野開闊且敵方巡邏兵力較高。善用沙包掩體與倍鏡火力壓制，取得 4 份情報後撤離。',
    skyColor: 0x7c8f9e,
    fogColor: 0x9aa4a8,
    fogDensity: 0.0085,
    groundColor: 0x87775f,
    accentColor: 0x10b981,
  },
};

export function computeBallistics(loadout: LoadoutConfig): ComputedBallistics {
  const weapon = WEAPONS[loadout.weaponId];
  const optic = OPTICS.find((o) => o.id === loadout.opticId) ?? OPTICS[0];
  const muzzle = MUZZLES.find((m) => m.id === loadout.muzzleId) ?? MUZZLES[0];
  const mag = MAGAZINES.find((m) => m.id === loadout.magazineId) ?? MAGAZINES[0];

  const rawRecoil = Math.max(
    8,
    weapon.baseRecoil + optic.recoilDelta + muzzle.recoilDelta + mag.recoilDelta
  );
  const recoilControl = Math.min(98, Math.max(20, Math.round(100 - rawRecoil)));
  const magBonusCount = Math.round(weapon.magSize * (mag.magBonus ?? 0));

  return {
    damage: Math.max(10, weapon.baseDamage + optic.damageDelta + muzzle.damageDelta),
    rpm: weapon.rpm,
    recoilControl,
    effectiveRange: weapon.baseRange + optic.rangeDelta + muzzle.rangeDelta,
    magCapacity: weapon.magSize + magBonusCount,
    reloadSec:
      loadout.magazineId === 'ext_mag'
        ? Number((weapon.reloadSec * 1.15).toFixed(2))
        : weapon.reloadSec,
    adsFov: loadout.weaponId === 'awm' && loadout.opticId === 'acog_25x' ? 20 : optic.adsFov,
    suppressed: Boolean(muzzle.suppressed || loadout.weaponId === 'mp5sd'),
    auto: weapon.auto,
  };
}

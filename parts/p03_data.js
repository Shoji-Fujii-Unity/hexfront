/* ===== HEXFRONT :: data tables (terrain, units, pixel-art sprites) — DOM-free ===== */

HF.SIDES = [0, 1];              /* 0 = player (BLUE), 1 = enemy (RED) */
HF.SIDECOL = [
  { d: '#17324f', m: '#2f6bad', l: '#74b4e8', w: '#cfe6f7' },
  { d: '#4f1a1f', m: '#b03a3a', l: '#e8836f', w: '#f8d5cb' }
];
HF.CLASSES = ['INF', 'SOFT', 'ARM', 'AIR'];
HF.DOMS = ['F', 'W', 'T', 'A'];

/* ---------- terrain ----------
   cost: movement points x10 per domain (x = impassable), def: defence pips,
   inc: funds/turn when owned, cap: can be captured, sup: supply source,
   build: production kind, flyCost: cost for aircraft                        */
HF.TERR = {
  PLAIN:    { n: { ja: '平野', en: 'Plain', zh: '平原' }, d: { ja: '見通しの良い開けた地', en: 'Open ground, no cover', zh: '开阔地，无掩体' }, cost: { F: 10, W: 10, T: 10 }, def: 0, inc: 0, cap: 0, sup: 0, fly: 5 },
  ROAD:     { n: { ja: '道', en: 'Road', zh: '公路' }, d: { ja: '輪・履帯で高速移動', en: 'Fast for wheels and tracks', zh: '轮履高速通行' }, cost: { F: 10, W: 5, T: 6 }, def: 0, inc: 0, cap: 0, sup: 0, fly: 5 },
  FOREST:   { n: { ja: '森', en: 'Forest', zh: '森林' }, d: { ja: '防御+3 車両はやや遅い', en: 'Def +3, slows vehicles', zh: '防御+3，车辆减速' }, cost: { F: 10, W: 16, T: 14 }, def: 3, inc: 0, cap: 0, sup: 0, fly: 5 },
  HILL:     { n: { ja: '丘陵', en: 'Hill', zh: '丘陵' }, d: { ja: '防御+2 見晴らしの良い高台', en: 'Def +2, high ground', zh: '防御+2 高地' }, cost: { F: 14, W: 18, T: 14 }, def: 2, inc: 0, cap: 0, sup: 0, fly: 5 },
  MOUNTAIN: { n: { ja: '山', en: 'Mountain', zh: '山地' }, d: { ja: '防御+4 車両は入れない', en: 'Def +4, vehicles blocked', zh: '防御+4，车辆不可通行' }, cost: { F: 16, W: -1, T: -1 }, def: 4, inc: 0, cap: 0, sup: 0, fly: 5 },
  RIVER:    { n: { ja: '河', en: 'River', zh: '河流' }, d: { ja: '歩兵のみ渡れる(移動大)', en: 'Foot only, costly', zh: '仅步兵可渡（消耗大）' }, cost: { F: 24, W: -1, T: -1 }, def: 0, inc: 0, cap: 0, sup: 0, fly: 5 },
  BRIDGE:   { n: { ja: '橋', en: 'Bridge', zh: '桥梁' }, d: { ja: '車両が河を渡れる唯一の道', en: 'Only way for vehicles across', zh: '车辆过河的通道' }, cost: { F: 10, W: 10, T: 10 }, def: 0, inc: 0, cap: 0, sup: 0, fly: 5 },
  LAKE:     { n: { ja: '湖', en: 'Lake', zh: '湖泊' }, d: { ja: '航空機のみ通過', en: 'Aircraft only', zh: '仅航空机通过' }, cost: { F: -1, W: -1, T: -1 }, def: 0, inc: 0, cap: 0, sup: 0, fly: 5 },
  CITY:     { n: { ja: '都市', en: 'City', zh: '城市' }, d: { ja: '収入5・補給・占領可', en: 'Income 5, supply, capture', zh: '收入5·补给·可占领' }, cost: { F: 10, W: 10, T: 10 }, def: 2, inc: 5, cap: 2, sup: 1, fly: 5 },
  FARM:     { n: { ja: '農場', en: 'Farm', zh: '农场' }, d: { ja: '収入3・補給・占領可', en: 'Income 3, supply, capture', zh: '收入3·补给·可占领' }, cost: { F: 10, W: 10, T: 10 }, def: 0, inc: 3, cap: 2, sup: 1, fly: 5 },
  AIRFIELD: { n: { ja: '飛行場', en: 'Airfield', zh: '机场' }, d: { ja: '航空機を生産・収入4', en: 'Builds aircraft, income 4', zh: '生产飞机·收入4' }, cost: { F: 8, W: 8, T: 8 }, def: 1, inc: 4, cap: 2, sup: 1, build: 'AIR', fly: 5 },
  FACTORY:  { n: { ja: '軍需工場', en: 'Factory', zh: '军工厂' }, d: { ja: '陸上兵器を生産・収入7', en: 'Builds land weapons, income 7', zh: '生产陆军·收入7' }, cost: { F: 8, W: 8, T: 8 }, def: 1, inc: 7, cap: 2, sup: 1, build: 'LAND', fly: 5 },
  DEPOT:    { n: { ja: '補給基地', en: 'Depot', zh: '补给站' }, d: { ja: '補給点・収入3・占領可', en: 'Supply point, income 3', zh: '补给点·收入3' }, cost: { F: 10, W: 10, T: 10 }, def: 1, inc: 3, cap: 2, sup: 1, fly: 5 },
  HQ:       { n: { ja: '本営', en: 'HQ', zh: '本部' }, d: { ja: '占領で勝利・収入4・応戦', en: 'Capture to win, income 4, returns fire', zh: '占领即胜·收入4·还击' }, cost: { F: 10, W: 10, T: 10 }, def: 3, inc: 4, cap: 3, sup: 1, fly: 5 },
  FORT:     { n: { ja: '陣地', en: 'Field works', zh: '工事' }, d: { ja: '防御+4 工兵が構築', en: 'Def +4, dug by engineers', zh: '防御+4 工兵构筑' }, cost: { F: 10, W: 10, T: 10 }, def: 4, inc: 0, cap: 0, sup: 0, fly: 5 }
};

/* ---------- units: real modern systems ----------
   atk: base damage (HP is 0..100), mul: matchup vs class, r0/r1 range,
   ammo: shots with its ammo-fed weapon (-1 = small arms, unlimited),
   car: cargo slots, cld: class it may carry, ind: indirect (no counterfire)  */
HF.UNITS = {
  RIFLE: {
    n: { ja: '歩兵小隊', en: 'Rifle squad', zh: '步兵班' }, s: 'RIF',
    d: { ja: '占領の要。少銃で近接戦闘', en: 'The capture arm. Rifles and grenades', zh: '占领主力，步枪近战' },
    models: 'M4A1 / HK416 / AK-12 / 95式', cls: 'INF', dom: 'F', sp: 'inf', tier: 1, build: 'LAND',
    cost: 5, mv: 3, r0: 1, r1: 1, atk: 42, ammo: -1, fuel: 40, cap: 1, car: 0, cld: null, ind: 0,
    mul: { INF: 1.0, SOFT: 0.9, ARM: 0.3, AIR: 0.15 }
  },
  MG: {
    n: { ja: '重機関銃班', en: 'HMG team', zh: '重机枪组' }, s: 'HMG',
    d: { ja: '射程2の抑制火力。低空飛行機も撃てる', en: 'Range-2 base of fire, hits low flyers', zh: '射程2压制火力，可打低空飞机' },
    models: 'M240B / PKP Pecheneg / CS/LM5', cls: 'INF', dom: 'F', sp: 'mg', tier: 1, build: 'LAND',
    cost: 7, mv: 2, r0: 1, r1: 2, atk: 58, ammo: 8, fuel: 36, cap: 1, car: 0, cld: null, ind: 0,
    mul: { INF: 1.3, SOFT: 1.1, ARM: 0.35, AIR: 0.5 }
  },
  ATGM: {
    n: { ja: '対戦車ミサイル', en: 'ATGM team', zh: '反坦克导弹' }, s: 'ATG',
    d: { ja: '戦車を射程2で撃破。歩兵に弱い', en: 'Tank killer at range 2, soft vs infantry', zh: '射程2反坦克，怕步兵' },
    models: 'FGM-148 Javelin / Kornet-M / 紅箭-12', cls: 'INF', dom: 'F', sp: 'atgm', tier: 2, build: 'LAND',
    cost: 9, mv: 2, r0: 1, r1: 2, atk: 46, ammo: 4, fuel: 36, cap: 1, car: 0, cld: null, ind: 0,
    mul: { INF: 0.5, SOFT: 1.5, ARM: 2.0, AIR: 0.55 }
  },
  ENG: {
    n: { ja: '戦闘工兵', en: 'Combat engineer', zh: '战斗工兵' }, s: 'ENG',
    d: { ja: '陣地・補給基地を構築できる', en: 'Digs field works and builds depots', zh: '可筑工事与补给站' },
    models: 'M728 ACE / Pioniere / 工兵化復旧車', cls: 'INF', dom: 'F', sp: 'eng', tier: 2, build: 'LAND',
    cost: 6, mv: 2, r0: 1, r1: 1, atk: 24, ammo: -1, fuel: 40, cap: 1, car: 0, cld: null, ind: 0, fort: 6, depot: 10,
    mul: { INF: 0.8, SOFT: 0.6, ARM: 0.2, AIR: 0.1 }
  },
  TRUCK: {
    n: { ja: '補給トラック', en: 'Supply truck', zh: '补给卡车' }, s: 'SUP',
    d: { ja: '隣接部隊の燃料と弾薬を補給', en: 'Resupplies adjacent units', zh: '为相邻部队补给了弹燃料' },
    models: 'FMTV M1078 / KamAZ-5350 / MB Actros', cls: 'SOFT', dom: 'W', sp: 'truck', tier: 1, build: 'LAND',
    cost: 5, mv: 4, r0: 1, r1: 1, atk: 8, ammo: -1, fuel: 90, cap: 0, car: 0, cld: null, ind: 0, supply: 1,
    mul: { INF: 0.2, SOFT: 0.2, ARM: 0.05, AIR: 0 }
  },
  APC: {
    n: { ja: '装甲兵員車', en: 'APC', zh: '装甲运兵车' }, s: 'APC',
    d: { ja: '步兵1名を輸送。装甲は薄い', en: 'Carries 1 infantry, thin skin', zh: '载1名步兵，装甲薄' },
    models: 'M113A4 / BTR-82A / Boxer ARTEC / 08式', cls: 'SOFT', dom: 'W', sp: 'apc', tier: 1, build: 'LAND',
    cost: 8, mv: 4, r0: 1, r1: 1, atk: 26, ammo: 6, fuel: 80, cap: 0, car: 1, cld: 'INF', ind: 0,
    mul: { INF: 0.8, SOFT: 0.9, ARM: 0.25, AIR: 0.35 }
  },
  IFV: {
    n: { ja: '歩兵戦車', en: 'Infantry fighting vehicle', zh: '步兵战车' }, s: 'IFV',
    d: { ja: '高速の砲兵戦車。步兵1名搭載', en: 'Fast cannon IFV, carries 1 infantry', zh: '高速步战，载1名步兵' },
    models: 'M2A4 Bradley / BMP-3 / Warrior / 04式', cls: 'ARM', dom: 'T', sp: 'ifv', tier: 3, build: 'LAND',
    cost: 13, mv: 4, r0: 1, r1: 1, atk: 62, ammo: 7, fuel: 80, cap: 0, car: 1, cld: 'INF', ind: 0,
    mul: { INF: 1.2, SOFT: 1.5, ARM: 0.9, AIR: 0.9 }
  },
  MBT: {
    n: { ja: '主力戦車', en: 'Main battle tank', zh: '主战坦克' }, s: 'MBT',
    d: { ja: '戦場の拳。歩兵には手強く対ミサイルに弱い', en: 'Battlefield fist, tough to ground ATGM', zh: '战场铁拳，怕反坦克导弹' },
    models: 'M1A2 SEPv3 / Leopard 2A8 / 99A式 / Leclerc', cls: 'ARM', dom: 'T', sp: 'mbt', tier: 4, build: 'LAND',
    cost: 20, mv: 4, r0: 1, r1: 1, atk: 84, ammo: 6, fuel: 80, cap: 0, car: 0, cld: null, ind: 0,
    mul: { INF: 0.85, SOFT: 1.6, ARM: 1.05, AIR: 0.25 }
  },
  SPART: {
    n: { ja: '自走砲', en: 'Self-propelled howitzer', zh: '自行火炮' }, s: 'SPA',
    d: { ja: '射程2-3の間接砲。反撃されない', en: 'Range 2-3 indirect, no counterfire', zh: '射程2-3间接火力，免反击' },
    models: 'M109A7 / PzH 2000 / K9 Thunder / PLZ-05', cls: 'SOFT', dom: 'T', sp: 'spart', tier: 3, build: 'LAND',
    cost: 15, mv: 3, r0: 2, r1: 3, atk: 76, ammo: 5, fuel: 70, cap: 0, car: 0, cld: null, ind: 1,
    mul: { INF: 1.1, SOFT: 1.4, ARM: 1.0, AIR: 0 }
  },
  MLRS: {
    n: { ja: '多連装ロケット', en: 'MLRS', zh: '多管火箭炮' }, s: 'MLR',
    d: { ja: '射程3-4の重火力。弾薬はわずか', en: 'Range 3-4 heavy salvo, tiny ammo', zh: '射程3-4重火力，弹药少' },
    models: 'M270A2 / HIMARS / BM-30 Smerch / PHL-16', cls: 'SOFT', dom: 'W', sp: 'mlrs', tier: 5, build: 'LAND',
    cost: 24, mv: 3, r0: 3, r1: 4, atk: 90, ammo: 3, fuel: 70, cap: 0, car: 0, cld: null, ind: 1,
    mul: { INF: 1.2, SOFT: 1.6, ARM: 1.1, AIR: 0 }
  },
  AAA: {
    n: { ja: '自対空機関砲', en: 'Self-propelled AAA', zh: '自行高炮' }, s: 'AAA',
    d: { ja: '低空の航空機を射撃で落とす', en: 'Shreds low fliers with flak', zh: '炮击落低空飞机' },
    models: 'Gepard / PGZ-09 / Tunguska / Skyranger', cls: 'ARM', dom: 'T', sp: 'aaa', tier: 4, build: 'LAND',
    cost: 11, mv: 4, r0: 1, r1: 2, atk: 52, ammo: 10, fuel: 80, cap: 0, car: 0, cld: null, ind: 0,
    mul: { INF: 0.5, SOFT: 0.6, ARM: 0.35, AIR: 2.0 }
  },
  SAM: {
    n: { ja: '地対空ミサイル', en: 'SAM battery', zh: '地空导弹' }, s: 'SAM',
    d: { ja: '射程3で航空機を専ら狙う。地上は不可', en: 'Range-3 air-only killer', zh: '射程3专打飞机，不能对地' },
    models: 'MIM-104 Patriot / IRIS-T SLM / S-300V / HQ-9', cls: 'SOFT', dom: 'W', sp: 'sam', tier: 5, build: 'LAND',
    cost: 16, mv: 3, r0: 1, r1: 3, atk: 58, ammo: 7, fuel: 70, cap: 0, car: 0, cld: null, ind: 0,
    mul: { INF: 0, SOFT: 0, ARM: 0, AIR: 2.6 }
  },
  CH: {
    n: { ja: '輸送ヘリ', en: 'Transport helicopter', zh: '运输直升机' }, s: 'TRH',
    d: { ja: '步兵2名を戦線後方へ空輸', en: 'Air-lifts 2 infantry across the front', zh: '机降2名步兵' },
    models: 'CH-47F / Mi-8AMTSh / UH-60M / Z-20', cls: 'AIR', dom: 'A', sp: 'ch', tier: 6, build: 'AIR',
    cost: 10, mv: 6, r0: 1, r1: 1, atk: 22, ammo: 6, fuel: 90, cap: 0, car: 2, cld: 'INF', ind: 0,
    mul: { INF: 0.6, SOFT: 0.6, ARM: 0.15, AIR: 0 }
  },
  UAV: {
    n: { ja: '攻撃無人機', en: 'Armed UAV', zh: '攻击无人机' }, s: 'UAV',
    d: { ja: '味方の射程内火力を+18%にする', en: 'Designates: allies near it hit +18%', zh: '指示目标：附近友军火力+18%' },
    models: 'MQ-9A Reaper / TB2 Bayraktar / Wing Loong II', cls: 'AIR', dom: 'A', sp: 'uav', tier: 6, build: 'AIR',
    cost: 11, mv: 5, r0: 1, r1: 2, atk: 44, ammo: 3, fuel: 100, cap: 0, car: 0, cld: null, ind: 0, desig: 2,
    mul: { INF: 1.1, SOFT: 1.3, ARM: 1.0, AIR: 0 }
  },
  AH: {
    n: { ja: '攻撃ヘリ', en: 'Attack helicopter', zh: '武装直升机' }, s: 'HTD',
    d: { ja: '戦車 hunt。高射砲とSAMに注意', en: 'Tank hunter, afraid of AAA and SAM', zh: '猎杀坦克，惧高炮与地空导弹' },
    models: 'AH-64E Apache / Ka-52 / Tiger / Z-10', cls: 'AIR', dom: 'A', sp: 'ah', tier: 6, build: 'AIR',
    cost: 19, mv: 6, r0: 1, r1: 2, atk: 70, ammo: 5, fuel: 90, cap: 0, car: 0, cld: null, ind: 0,
    mul: { INF: 1.3, SOFT: 1.6, ARM: 1.5, AIR: 0.4 }
  },
  FT: {
    n: { ja: '戦闘機', en: 'Fighter', zh: '战斗机' }, s: 'FTR',
    d: { ja: '制空権の主。対空で圧倒', en: 'Air superiority king', zh: '制空权主宰，对空压倒' },
    models: 'F-16C Block70 / JAS 39E Gripen / J-10C / Rafale', cls: 'AIR', dom: 'A', sp: 'ft', tier: 7, build: 'AIR',
    cost: 25, mv: 8, r0: 1, r1: 1, atk: 68, ammo: 4, fuel: 110, cap: 0, car: 0, cld: null, ind: 0,
    mul: { INF: 0.7, SOFT: 0.8, ARM: 0.6, AIR: 2.2 }
  },
  BJ: {
    n: { ja: '戦闘爆撃機', en: 'Strike fighter', zh: '战斗轰炸机' }, s: 'STR',
    d: { ja: '地上目標を高精度誘導弾で壊す', en: 'Precision ordnance against ground targets', zh: '精确弹药摧毁地面目标' },
    models: 'F-35A / Su-34 / JH-7A / JF-17 Block III', cls: 'AIR', dom: 'A', sp: 'bj', tier: 8, build: 'AIR',
    cost: 27, mv: 7, r0: 1, r1: 1, atk: 92, ammo: 3, fuel: 110, cap: 0, car: 0, cld: null, ind: 0,
    mul: { INF: 1.4, SOFT: 1.6, ARM: 1.4, AIR: 0.4 }
  }
};
HF.UIDS = Object.keys(HF.UNITS);

/* engineer support actions */
HF.FORT_COST = 6;
HF.DEPOT_COST = 10;

/* ---------- pixel art ---------- */
/* palette: '.' transparent, then single chars below */
HF.PAL = {
  K: '#0b1016', D: 'TEAM_D', M: 'TEAM_M', L: 'TEAM_L',
  s: '#3a424c', S: '#6d7883', W: '#a9b4bf', h: '#dde5ec',
  g: '#3c4a2c', G: '#5f7040', Y: '#8b9b5c',
  r: '#a83a2c', y: '#e0b73c', w: '#f0f4f7', k: '#1a2027',
  n: '#c79c68', o: '#8a5a2b', b: '#2b4a6b', e: '#78d0e8'
};
/* sprite rows joined by '/'. team chars D/M/L are tinted per side. */
HF.ART = {
  inf: '......./......../...KKKK...../..KgGGgK.../../..KnGGnK.../../...KMMK...K/..KMMLMKKKK/..KMMMK.KK.../...KKKKKKK..../...KMMMK...../...KMMK....../....KK.KK.../...KggKggK../...KggKggK../....KKKK..../........',
  mg: '......./......../..KKKKKKK../..KMMMMMK../..KMLLLLMK../..KMMMMMK.../...KK.KKKKKKKKKKK/..KsKK......./..KsK.KKKK../..KK..KsK.../......KsK.../.....KsKK.../....KsK...../...KK.......',
  atgm: '......./......../...KKKK...../..KgGGgK.../../..KnGGnK.../...KMMKKKKKKKKKKKK/..KMMLMKn...../...KKKKKssssss../......KMMK.../......KMMK.../.......KK.../.....KggKggK/.....KggKggK/......KKKK../........',
  eng: '......./......../...KKKK...../..KYYYYYK.../..KnYYnYK.../...KMMMK.../..KMMLMMK.y../...KKKKKk.y../...KMMMK..y../...KMMK...y../....KK..yyyy/...KggKggK.y/...KggKggK../....KKKK..../........',
  truck: '............../............../......KKKKK...../.....KMMMhKK..../.....KMMLMhK....K/.....KMMMMKK...K/..KKKKKKKKKKKKKKK/..KMMMMMMMMMMMMK/..KMLMMMMMMMMK/..KKsKKKKKKsKKK/..KsKKK...KsKK/..KKK.....KKK../............./............',
  apc: '................/................/....KKKKKKKKK..../...KMMMMMMMMMK../...KMLLLMMMhhK../...KMMMMMMMMMKK/..KsKKKKKKKKKKsK/..KssssssssssssK/..KKsKKKKKKKsKK/...KKKKKKKKK..../................/..............',
  ifv: '................../................../.......KKKKKKKK......../......KMMMMMMMK...../......KMMLLLMMKhK.../......KMMMMMMMKK../KKKKKKKKKKKKKKKKK/................./KssssssssssssssssK/KKsKKKKKKKKKKKsKK/..KssssssssssssK/...KKKKKKKKKKK..',
  mbt: '...................../...................../..........KKKKKKK........../.........KMMMMMMMK........./.........KMMLLLMMMK........./..........KMMMMMMMK........./KKKKKKKKKKKKKKKKKKKKKK/........................./KssssssssssssssssssssK/KKsKKKKKKKKKKKKKsKK/..KssssssssssssssK/....KKKKKKKKKKKK....',
  spart: '................../................../...........Kkkkk........./..........KkKKKk........../.........KkKKKkK........./........KkKKkkKKK........./.....KKKKKKKKKKKKKKK...../.....KMMMMMMMMMMMK...../.....KMMLLMMMMMMMK...../..KssssssssssssssssssK/..KKsKKKKKKKKKKKsKKK/...KsssssssssssK../....KKKKKKKKKKK....',
  mlrs: '...................../...................../..........KKKKKKKKKK........./.........KLLLLLLLLLKK........./.........KkkkkkkkkKKK........./.........KLLLLLLLLLKKK......../..........KKKKKKKKK............/.....KKKKKKKKKKKKKKKKK...../.....KMMMMMMMMMMMMMMMK...../.....KMLMMMMMMMMMMMK...../..KssssssssssssssssssssK/..KKsKKKKKKKKKKKKKsKKK/...KsssssssssssssssK/....KKKKKKKKKKKKKK....',
  aaa: '................../................../Kk..Kk....Kk..Kk......./..Kkkkkkkkkkkkkk......../.....KMMMMMMMK........./.....KMMLLLMMMK........./......KMMMMMMMK........./...KKKKKKKKKKKKKKK..../...KssssssssssssK.../...KKsKKKKKKKsKKK..../....KssssssssK.../.....KKKKKKKK....',
  sam: '...................../...................../....KKKK.....KKKK.....K/....KLLLK.....KLLLK.....K/....KLLLK.....KLLLK.....K/....KKKKK.....KKKKK.....K/......KKKKKKKKKKK...../.....KKKKKKKKKKKKKKKKK...../.....KMMMMMMMMMMMMMK...../.....KMLMMMMMMMMMMK...../..KssssssssssssssssssK/..KKsKKKKKKKKKKKsKKK/...KsssssssssssK../....KKKKKKKKKKK....',
  ch: '............................/KKKKKKKKKKKKKKKKKKKKKKKKK/............................/.......KKKKKKKKK................../......KMMMMLLMMMK................/.....KMMMMMMMMMMMKK............./.....KMMLLLLLMMMMMhKK............/......KMMMMMMMMMMMKK........./.......KKsKKKKKKKKKsKK........../...........KsKKK................/..........KKKKK.................',
  uav: '............................................/............................................/..................KK............................................/.................KMMK........................................./..............KMMMMK............................................/............KKMMMMMMKK......................................./KKKKKKKKKKKKKKMMMMMMMMKKKKKKKKKKKKKKKKKKKKKKK/............KKMMMMMMKK......................................./..............KMMMMK............................................/.................KMMK........................................./..................KK............................................/................KeeK..........................................',
  ah: '..................................../........KKKKK................................/.......KMMMMMK............................./......KMMMMMMhKK.........................../.....KMMMMMMMMMKKKKKK....................KKKK/....KMMLLLMMMMMMhK.....................KLLLK/.....KMMMMMMMMMKKKKKK....................KKKK/......KMMMMMMhKK.........................../.......KKKKKKK............................./........KsK..................................../.......KssK.................................../......KKKKKKK..................................',
  ft: '...................................................../...................................................../...................................................../................................KK........................../.............................KMK........................./............................KMMMK......................../..........KKKKKKKKKKKKKKKKKMMMMMKKKKKKKKKKKKKKKKK........./............................KMMMK......................../.............................KMK........................./................................KK........................../...................................................../...................................................../.....................................................',
  bj: '........................................................./........................................................./........................................................./...................................KKKK................................/..................................KMMMMK.............................../................................KMMMMMK.............................../................KKKKKKKKKKKKKKKKKKMMMMMMMKKKKKKKKKKKKKKKK................./................................KMMMMMK................................/..................................KMMMMK.............................../...................................KKKK................................/........................................................./........................................................./........................................................./.........................................................',
  city: '...../...../KKKKKKKKKKKKKKK/KMMMMMMMMMMMMMMK/KhKKhhKKhhKKhhK/KMMMMMMMMMMMMMMK/KhKKhhKKhhKKhhK/KMMMMMMMMMMMMMMK/KhKKhhKKhhKKhhK/KMMMMMMMMMMMMMMK/KMMMMMMMMMMMMMMK/KKLLLLLLLLLLLLK/..............',
  farm: '................/................/..KKKKKKK...../..KrrrrrrK..../..KrwKrwK...../..KKKKKKKKK..../..KYYYYYYYYKK/..KYYKYYYYK/..KKKKKKKKK.',
  factory: '................/................/....KKK...../....KsK...../....KsK...../KKKKKKKKKKKKKKK/KMMMMMMMMMMMMK/KhKMMhKMMhKMM/KMMMMMMMMMMMM/KLLLLLLLLLLLL/KKsKsKsKsKsKK/',
  hangar: '................/................/....KKKKKK..../..KKMMMMMMKK../.KMMMMMMMMMK./.KMLLMMMMMMK./.KMMMMMMMMMK./KKKKKKKKKKKKK/..............',
  depot: '................/................/....KKKKK...../....KYYYYK..../....KYKKYK...../..KKKKKKKKKKK../..KYYYYYYYYK../..KYKLLLKYK../..KYYYYYYYYK../..KKKKKKKKKKK.',
  hq: '..................../....KwK................/....KwwK................/....KMMK................/KKKKKKKKKKKKKKKKK/KMMMMMMMMMMMMMK/KMMLLLMMMMMMK/KMMMMMMMMMMMK/KMMMMMMMMMMMK/KLLLLLLLLLLLLK/KKsKsKsKsKsKK/',
  tree: '...KKK.../..KGGgK../.KgGGGgK./.KGGgGGgK./KGGGGGGgK/.KgGGGGgK./...KooK.../...KooK.../..KKKKKKK..',
  rock: '...KKK.../..KWWWK../.KWWWWWK../KWSSSWWK./KSSSSSSWK./KSSSSSWK./KKKKKKKKK',
  bump: '..KKK../.KWWWK./KWSSWK./KSSSWK./KKKKKK.',
  boom0: '................../.......KKK......../.....KKyyyyKK...../....KyyyyyyyK....../...KyyYYyyyK...../...KyYYWWYYk....../..KkYYWWWWYk....../..KkYWWWWWYk....../..KkYYWWYYk...../...KyyYYyyK......../....KyyyyyK......../.....KKyyKK........./.......KKK........../..................',
  boom1: '................../................../......KKKKK......../.....KYYYYYK......./....KYWWWWWYK....../...KYWWWWWYk...../...KYWKKKWYk...../...KYWKKKWYk...../...KYWKKKWYk...../....KYWWWWYK......./.....KYYYYYK......./......KKKKK........./................../..................',
  boom2: '................../................../................../......KKKKK......../.....KsSSsK......../....KsK..KsK......./....Ks.KK.Ks......./....KsK..KsK......./.....KsSSsK......../......KKKKK........./................../................../..................'
};
HF.SPR = {};              /* baked canvases: key+side -> canvas */
HF.SPRW = 17; HF.SPRH = 16;

/* ---------- shared combat helpers (pure) ---------- */
HF.canHit = function (au, tu) {
  var A = HF.UNITS[au.t], T = HF.UNITS[tu.t];
  return (A.mul[T.cls] || 0) > 0;
};
HF.inRange = function (s, au, tu, from) {
  var A = HF.UNITS[au.t];
  var d = HF.distIdx(s, from === undefined ? au.i : from, tu.i);
  return d >= A.r0 && d <= A.r1;
};

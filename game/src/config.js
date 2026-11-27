// config.js — palette, tuning and stage table for Gobble or Roast!
// Single source of truth: every colour and number the game uses lives here.

export const FIELD = { W: 1280, H: 720, TOP: 96, BOTTOM: 700, LEFT: 24, RIGHT: 1256 };
export const STEP = 1 / 60;
export const FT_PER_PX = 0.35;

export const PALETTE = {
  skyLow: '#F7B267', skyMid: '#E07A3F', skyHigh: '#7A3B2E',
  barnWood: '#8A5230', barnDark: '#6B3F22', hay: '#E8C15A', hayDark: '#C9A227',
  grass: '#7A9A4D', dirt: '#B07A45', fence: '#A9713F',
  tile: '#F2E3C6', grout: '#D9C49A', counter: '#9C6644', ovenBody: '#4A4A52', ovenGlow: '#FF7A1A',
  turkeyBody: '#8A5230', tailRed: '#C1440E', tailGold: '#E8A33C', tailBrown: '#A0522D',
  turkeyHead: '#E8E0D0', wattle: '#E5534B', beak: '#F2C94C', turkeyFeet: '#E07A3F',
  eyeWhite: '#FFFFFF', pupil: '#2B2118',
  overalls: '#3E5C76', shirt: '#C1440E', skin: '#E8B98A', straw: '#E8C15A',
  beard: '#6B4A2F', boots: '#4A3226', blade: '#C9CED6', knifeHandle: '#7A4A26',
  panel: '#2B2118', cream: '#FFF3D6', gold: '#F2C94C',
  danger: '#E5534B', calm: '#7A9A4D', warn: '#F2C94C', chase: '#E5534B',
  bush: '#5C7A3A', barrel: '#8A5230', pantry: '#6B3F22',
};

export const TUNING = {
  walkSpeed: 200, sprintSpeed: 320, sprintHearing: 190,
  hopTime: 0.38, hopCooldown: 0.45, hopLift: 46,
  chaseSpeed: 230, chaseBonusPerStage: 10,
  visionRange: 260, visionHalfAngle: 0.62,
  suspicionFill: 0.9, suspicionDecay: 0.55, chaseLoseTime: 2.5,
  lungeRange: 140, lungeWindup: 0.6, lungeHitRange: 82,
  invulnTime: 1.5, snareTime: 1.2, searchSpotTime: 1.0,
  knifeThrowSpeed: 520, knifeSlideSpeed: 380,
  ovenIdle: 2.6, ovenWarn: 0.7, ovenBurst: 0.6,
  cornScore: 10, goldenScore: 50, closeOneScore: 25, escapeScore: 500,
};

export const STAGES = [
  { name: 'THE FARMYARD', short: 'Farmyard', next: 'the barn!', patrolSpeed: 90, suspicionRate: 1.0, throwsPerChase: 1, snareCount: 5, potCount: 0, oven: false, slides: false, dark: 0 },
  { name: 'THE BARN', short: 'Barn', next: 'the kitchen!', patrolSpeed: 115, suspicionRate: 1.25, throwsPerChase: 2, snareCount: 8, potCount: 0, oven: false, slides: false, dark: 0.25 },
  { name: 'THE KITCHEN', short: 'Kitchen', next: 'the woods!', patrolSpeed: 135, suspicionRate: 1.5, throwsPerChase: 2, snareCount: 4, potCount: 3, oven: true, slides: true, dark: 0.1 },
];

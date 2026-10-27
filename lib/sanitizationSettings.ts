export const registrationRules = {
  "6-7": { min: 6, max: 7 },
  "6": { min: 6, max: 6 },
  "7": { min: 7, max: 7 },
  "8": { min: 8, max: 8 },
} as const;

export interface SanitizationSettings {
  namesText: string;
  registrationRule: keyof typeof registrationRules;
}

// Conversion utility: kg/ha to kg/acre
// 1 hectare = 2.47105 acres
export const HECTARE_TO_ACRE = 2.47105;

/**
 * Convert kg/ha to kg/acre
 * @param {number} kgHa - Value in kg/ha
 * @returns {number} Value in kg/acre
 */
export function kgHaToKgAcre(kgHa) {
  if (kgHa == null || isNaN(kgHa)) return null;
  return kgHa / HECTARE_TO_ACRE;
}

/**
 * Convert kg/acre to kg/ha
 * @param {number} kgAcre - Value in kg/acre
 * @returns {number} Value in kg/ha
 */
export function kgAcreToKgHa(kgAcre) {
  if (kgAcre == null || isNaN(kgAcre)) return null;
  return kgAcre * HECTARE_TO_ACRE;
}


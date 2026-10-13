/**
 * The town and region a patient lives in, for the demographics and spend-by-town reports (parity R26, R28). The town on
 * the patient's file comes first (patients.town, proposals/2026-10-13-patient-town.sql); without one, the town is read
 * from the address text: a part of the home address (else the postal address) that is a place on the Namibian towns
 * list (src/utils/address/namibianTowns.ts, in its usual spelling: "Walvisbaai" -> "Walvis Bay"), else the last part
 * that reads like a town: letters, no house number, street, post box, plot or "Namibia", without postal codes, in title
 * case. The region is the one on the file, else the region of the town on the list. When nothing qualifies the report
 * says "not recorded" instead of guessing.
 */
import { findPlace, toNamibianRegion, type NamibianPlace } from '../../../utils/address/namibianTowns';

export const TOWN_NOT_RECORDED = 'Town not recorded';
export const REGION_NOT_RECORDED = 'Region not recorded';

export interface TownSource {
  /** patients.town, once the database has the column */
  town?: string | null;
  /** patients.region, once the database has the column */
  region?: string | null;
  homeAddress?: string | null;
  postalAddress?: string | null;
}

/** "WINDHOEK", " windhoek " and "Windhoek" are one town (or one language); letters such as the ü of Lüderitz are kept */
export function tidyWords(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, before: string, letter: string) => `${before}${letter.toUpperCase()}`);
}

const COUNTRY = /^(republic of )?namibia$/i;
const POST_BOX = /^(p\.?\s*o\.?\s*box|private bag|po box|postnet|box)\b/i;
/** A part that names a street, a plot or a building is not a town */
const STREET = /\b(street|str|st|road|rd|avenue|ave|drive|dr|lane|ln|crescent|cres|close|way|boulevard|blvd|erf|plot|house|flat|unit|block|extension|ext)\b/i;

/** The parts of an address, each without postal codes and numbers at either end ("Windhoek 9000", "9000 Windhoek") */
const addressParts = (address: string | null | undefined): string[] =>
  (address ?? '').split(/[,;\n\r]+/).map(part => part.replace(/^[\d\s/#-]+|[\d\s/#-]+$/g, '').trim()).filter(Boolean);

export interface TownReader {
  /** The town in an address, or null when none can be read from it */
  fromAddress: (address: string | null | undefined) => string | null;
  /** The patient's town: the town on the file, else from the home address, else from the postal address */
  town: (source: TownSource) => string;
  /** The patient's region: the region on the file, else the region of their town on the Namibian towns list */
  region: (source: TownSource, town: string) => string;
}

/** Reads towns and regions for many patients, looking each place up in the Namibian towns list once */
export function townReader(): TownReader {
  const places = new Map<string, NamibianPlace | null>();
  const place = (text: string): NamibianPlace | null => {
    const key = text.toLowerCase();
    if (!places.has(key)) places.set(key, findPlace(text));
    return places.get(key) ?? null;
  };
  const fromAddress = (address: string | null | undefined): string | null => {
    const parts = addressParts(address);
    // A place on the list wins, wherever it is in the address ("Swakopmund, Vineta" is in Swakopmund)
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      const known = place(parts[index]);
      if (known) return known.name;
    }
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      const words = parts[index];
      // No letters, the country, a post box, a street ("12 Main Street") or a number inside ("Erf 45 Extension") is not a town
      if (!/\p{L}/u.test(words) || COUNTRY.test(words) || POST_BOX.test(words) || STREET.test(words) || /\d/.test(words)) continue;
      return tidyWords(words);
    }
    return null;
  };
  const town = (source: TownSource): string => {
    const own = source.town?.trim();
    if (own) return place(own)?.name ?? tidyWords(own);
    return fromAddress(source.homeAddress) ?? fromAddress(source.postalAddress) ?? TOWN_NOT_RECORDED;
  };
  const region = (source: TownSource, townName: string): string =>
    toNamibianRegion(source.region) ?? (townName !== TOWN_NOT_RECORDED ? place(townName)?.region : null) ?? REGION_NOT_RECORDED;
  return { fromAddress, town, region };
}

/** One address's town (a report reading many patients uses one townReader) */
export const townFromAddress = (address: string | null | undefined): string | null => townReader().fromAddress(address);

/** One patient's town (a report reading many patients uses one townReader) */
export const patientTown = (source: TownSource): string => townReader().town(source);

/** What the report says about where the town and region came from */
export const townNote = (fromField: boolean): string =>
  fromField
    ? 'The town and region are the ones on the patient\'s file; a file without a town is read from its address (a place on the Namibian towns list, else the address\'s last part), and its region is that town\'s.'
    : 'Patient files have no town field yet, so the town is read from the address: a place on the Namibian towns list, else the address\'s last part without postal codes; the region is that town\'s. Addresses typed without commas may show as "Town not recorded".';

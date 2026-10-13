/**
 * Namibian towns and settlements with their region, for the town picker on patient and account addresses (parity A16).
 *
 * Compiled from public sources in October 2026 (the Electoral Commission's list of the 59 local authorities, the
 * regional councils' settlement lists, Wikipedia's lists of cities, towns and settlements). No personal data. The 14
 * regions are named as since 2013 (//Kharas, Kavango East and West, Zambezi): the same list as the namibian_region
 * domain in proposals/2026-10-13-patient-town.sql.
 *
 * Postal codes: Namibia delivers mail to PO Boxes and Private Bags, not to streets. NamPost's 5-digit codes (since
 * 2018) name the post office that holds the box, not a town or suburb, and are optional; the old 4-digit codes (9000)
 * are South African codes from before 1990. So the list fills the town and region, and a postal code stays a free
 * field for those who use one.
 */

export const NAMIBIAN_REGIONS = [
  'Erongo',
  'Hardap',
  '//Kharas',
  'Kavango East',
  'Kavango West',
  'Khomas',
  'Kunene',
  'Ohangwena',
  'Omaheke',
  'Omusati',
  'Oshana',
  'Oshikoto',
  'Otjozondjupa',
  'Zambezi'
] as const;

export type NamibianRegion = (typeof NAMIBIAN_REGIONS)[number];

/** town: a city, municipality or town council; village: a village council; settlement: a regional council's settlement */
export type PlaceKind = 'town' | 'village' | 'settlement';

export interface NamibianPlace {
  name: string;
  region: NamibianRegion;
  kind: PlaceKind;
  /** Other spellings and names people type (Luderitz, Walvisbaai, Oshikango) */
  aliases?: readonly string[];
}

export const NAMIBIAN_PLACES: readonly NamibianPlace[] = [
  // Erongo
  { name: 'Arandis', region: 'Erongo', kind: 'town' },
  { name: 'Henties Bay', region: 'Erongo', kind: 'town', aliases: ['Hentiesbaai', 'Hentiesbay'] },
  { name: 'Karibib', region: 'Erongo', kind: 'town' },
  { name: 'Okombahe', region: 'Erongo', kind: 'settlement' },
  { name: 'Omaruru', region: 'Erongo', kind: 'town' },
  { name: 'Omatjete', region: 'Erongo', kind: 'settlement', aliases: ['Omatjette'] },
  { name: 'Otjimbingwe', region: 'Erongo', kind: 'settlement', aliases: ['Otjimbingue'] },
  { name: 'Swakopmund', region: 'Erongo', kind: 'town', aliases: ['Swakop'] },
  { name: 'Uis', region: 'Erongo', kind: 'village' },
  { name: 'Usakos', region: 'Erongo', kind: 'town' },
  { name: 'Utuseb', region: 'Erongo', kind: 'settlement' },
  { name: 'Walvis Bay', region: 'Erongo', kind: 'town', aliases: ['Walvisbaai', 'Walvis'] },
  { name: 'Wlotzkasbaken', region: 'Erongo', kind: 'settlement', aliases: ["Wlotzka's Baken", 'Wlotzkas'] },
  // Hardap
  { name: 'Aranos', region: 'Hardap', kind: 'town' },
  { name: 'Derm', region: 'Hardap', kind: 'settlement' },
  { name: 'Gibeon', region: 'Hardap', kind: 'village' },
  { name: 'Gochas', region: 'Hardap', kind: 'village' },
  { name: 'Hoachanas', region: 'Hardap', kind: 'settlement', aliases: ['!Hoachanas'] },
  { name: 'Kalkrand', region: 'Hardap', kind: 'village' },
  { name: 'Klein Aub', region: 'Hardap', kind: 'settlement' },
  { name: 'Maltahöhe', region: 'Hardap', kind: 'village', aliases: ['Maltahohe', 'Maltahoehe'] },
  { name: 'Mariental', region: 'Hardap', kind: 'town' },
  { name: 'Rehoboth', region: 'Hardap', kind: 'town' },
  { name: 'Rietoog', region: 'Hardap', kind: 'settlement' },
  { name: 'Schlip', region: 'Hardap', kind: 'settlement' },
  { name: 'Stampriet', region: 'Hardap', kind: 'village' },
  { name: 'Uibes', region: 'Hardap', kind: 'settlement', aliases: ['Uibis'] },
  // //Kharas
  { name: 'Ariamsvlei', region: '//Kharas', kind: 'settlement' },
  { name: 'Aroab', region: '//Kharas', kind: 'village' },
  { name: 'Asab', region: '//Kharas', kind: 'settlement' },
  { name: 'Aus', region: '//Kharas', kind: 'settlement' },
  { name: 'Aussenkehr', region: '//Kharas', kind: 'settlement' },
  { name: 'Berseba', region: '//Kharas', kind: 'village' },
  { name: 'Bethanie', region: '//Kharas', kind: 'village', aliases: ['Bethanien', 'Bethany'] },
  { name: 'Blouwes', region: '//Kharas', kind: 'settlement' },
  { name: 'Goageb', region: '//Kharas', kind: 'settlement' },
  { name: 'Grünau', region: '//Kharas', kind: 'settlement', aliases: ['Grunau', 'Gruenau'] },
  { name: 'Helmeringhausen', region: '//Kharas', kind: 'settlement' },
  { name: 'Karasburg', region: '//Kharas', kind: 'town' },
  { name: 'Keetmanshoop', region: '//Kharas', kind: 'town' },
  { name: 'Koës', region: '//Kharas', kind: 'village', aliases: ['Koes'] },
  { name: 'Kosis', region: '//Kharas', kind: 'settlement' },
  { name: 'Lüderitz', region: '//Kharas', kind: 'town', aliases: ['Luderitz', 'Luederitz'] },
  { name: 'Narubis', region: '//Kharas', kind: 'settlement' },
  { name: 'Noordoewer', region: '//Kharas', kind: 'settlement' },
  { name: 'Oranjemund', region: '//Kharas', kind: 'town' },
  { name: 'Rosh Pinah', region: '//Kharas', kind: 'settlement' },
  { name: 'Seeheim', region: '//Kharas', kind: 'settlement' },
  { name: 'Snyfontein', region: '//Kharas', kind: 'settlement' },
  { name: 'Tses', region: '//Kharas', kind: 'village' },
  { name: 'Vaalgras', region: '//Kharas', kind: 'settlement' },
  { name: 'Warmbad', region: '//Kharas', kind: 'settlement' },
  // Kavango East
  { name: 'Andara', region: 'Kavango East', kind: 'settlement' },
  { name: 'Bagani', region: 'Kavango East', kind: 'settlement' },
  { name: 'Divundu', region: 'Kavango East', kind: 'village' },
  { name: 'Kangongo', region: 'Kavango East', kind: 'settlement' },
  { name: 'Mashare', region: 'Kavango East', kind: 'settlement' },
  { name: 'Mukwe', region: 'Kavango East', kind: 'settlement' },
  { name: 'Ndiyona', region: 'Kavango East', kind: 'settlement' },
  { name: 'Nyangana', region: 'Kavango East', kind: 'settlement' },
  { name: 'Rundu', region: 'Kavango East', kind: 'town', aliases: ['Runtu'] },
  { name: 'Shambyu', region: 'Kavango East', kind: 'settlement' },
  // Kavango West
  { name: 'Bunya', region: 'Kavango West', kind: 'settlement' },
  { name: 'Kahenge', region: 'Kavango West', kind: 'settlement' },
  { name: 'Katwitwi', region: 'Kavango West', kind: 'settlement' },
  { name: 'Mpungu', region: 'Kavango West', kind: 'settlement' },
  { name: 'Ncamagoro', region: 'Kavango West', kind: 'settlement', aliases: ['Mile 30', 'Ncamangoro'] },
  { name: 'Nkurenkuru', region: 'Kavango West', kind: 'town', aliases: ['Kuring Kuru'] },
  { name: 'Rupara', region: 'Kavango West', kind: 'settlement' },
  { name: 'Tondoro', region: 'Kavango West', kind: 'settlement' },
  // Khomas
  { name: 'Baumgartsbrunn', region: 'Khomas', kind: 'settlement', aliases: ['Baumgartzbrunn'] },
  { name: 'Brakwater', region: 'Khomas', kind: 'settlement' },
  { name: 'Dordabis', region: 'Khomas', kind: 'settlement' },
  { name: 'Groot Aub', region: 'Khomas', kind: 'settlement' },
  { name: 'Mix Settlement', region: 'Khomas', kind: 'settlement', aliases: ['Mix Camp'] },
  { name: 'Seeis', region: 'Khomas', kind: 'settlement' },
  { name: 'Solitaire', region: 'Khomas', kind: 'settlement' },
  { name: 'Windhoek', region: 'Khomas', kind: 'town', aliases: ['Windhuk'] },
  // Kunene
  { name: 'Epupa', region: 'Kunene', kind: 'settlement', aliases: ['Epupa Falls'] },
  { name: 'Fransfontein', region: 'Kunene', kind: 'settlement' },
  { name: 'Kamanjab', region: 'Kunene', kind: 'village' },
  { name: 'Khorixas', region: 'Kunene', kind: 'town' },
  { name: 'Okanguati', region: 'Kunene', kind: 'settlement', aliases: ['Okangwati'] },
  { name: 'Opuwo', region: 'Kunene', kind: 'town', aliases: ['Ohopoho'] },
  { name: 'Otjikondo', region: 'Kunene', kind: 'settlement' },
  { name: 'Otjomuru', region: 'Kunene', kind: 'settlement' },
  { name: 'Outjo', region: 'Kunene', kind: 'town' },
  { name: 'Sesfontein', region: 'Kunene', kind: 'settlement' },
  { name: 'Swartbooisdrift', region: 'Kunene', kind: 'settlement' },
  // Ohangwena
  { name: 'Eenhana', region: 'Ohangwena', kind: 'town' },
  { name: 'Endola', region: 'Ohangwena', kind: 'settlement' },
  { name: 'Epembe', region: 'Ohangwena', kind: 'settlement' },
  { name: 'Helao Nafidi', region: 'Ohangwena', kind: 'town', aliases: ['Oshikango', 'Ohangwena', 'Engela', 'Omafo', 'Onhuno'] },
  { name: 'Odibo', region: 'Ohangwena', kind: 'settlement' },
  { name: 'Okongo', region: 'Ohangwena', kind: 'village' },
  { name: 'Omundaungilo', region: 'Ohangwena', kind: 'settlement' },
  { name: 'Omungwelume', region: 'Ohangwena', kind: 'settlement' },
  { name: 'Ongenga', region: 'Ohangwena', kind: 'settlement' },
  { name: 'Ongha', region: 'Ohangwena', kind: 'settlement' },
  { name: 'Oshandi', region: 'Ohangwena', kind: 'settlement' },
  // Omaheke
  { name: 'Aminuis', region: 'Omaheke', kind: 'settlement' },
  { name: 'Buitepos', region: 'Omaheke', kind: 'settlement' },
  { name: 'Drimiopsis', region: 'Omaheke', kind: 'settlement' },
  { name: 'Epukiro', region: 'Omaheke', kind: 'settlement', aliases: ['Epukiro Post 3', 'Epukiro Pos 3', 'Omauezonjanda', 'Omawewozonyanda'] },
  { name: 'Gobabis', region: 'Omaheke', kind: 'town' },
  { name: 'Leonardville', region: 'Omaheke', kind: 'village' },
  { name: 'Omitara', region: 'Omaheke', kind: 'settlement' },
  { name: 'Otjinene', region: 'Omaheke', kind: 'village' },
  { name: 'Steinhausen', region: 'Omaheke', kind: 'settlement' },
  { name: 'Summerdown', region: 'Omaheke', kind: 'settlement' },
  { name: 'Tallismanus', region: 'Omaheke', kind: 'settlement', aliases: ['Talismanus'] },
  { name: 'Tsjaka', region: 'Omaheke', kind: 'settlement' },
  { name: 'Witvlei', region: 'Omaheke', kind: 'village' },
  // Omusati
  { name: 'Anamulenge', region: 'Omusati', kind: 'settlement' },
  { name: 'Elim', region: 'Omusati', kind: 'settlement' },
  { name: 'Etayi', region: 'Omusati', kind: 'settlement' },
  { name: 'Ogongo', region: 'Omusati', kind: 'settlement' },
  { name: 'Okahao', region: 'Omusati', kind: 'town' },
  { name: 'Okalongo', region: 'Omusati', kind: 'village', aliases: ['Onandjaba', 'Onandjamba'] },
  { name: 'Omugulugwombashe', region: 'Omusati', kind: 'settlement', aliases: ['Ongulumbashe'] },
  { name: 'Onawa', region: 'Omusati', kind: 'settlement' },
  { name: 'Onesi', region: 'Omusati', kind: 'settlement' },
  { name: 'Oshikuku', region: 'Omusati', kind: 'town' },
  { name: 'Otamanzi', region: 'Omusati', kind: 'settlement' },
  { name: 'Outapi', region: 'Omusati', kind: 'town', aliases: ['Uutapi', 'Ombalantu'] },
  { name: 'Ruacana', region: 'Omusati', kind: 'town' },
  { name: 'Tsandi', region: 'Omusati', kind: 'village' },
  // Oshana
  { name: 'Eheke', region: 'Oshana', kind: 'settlement' },
  { name: 'Okaku', region: 'Oshana', kind: 'settlement' },
  { name: 'Okatana', region: 'Oshana', kind: 'settlement' },
  { name: 'Okatyali', region: 'Oshana', kind: 'settlement' },
  { name: 'Ompundja', region: 'Oshana', kind: 'settlement' },
  { name: 'Ondangwa', region: 'Oshana', kind: 'town', aliases: ['Ondangua'] },
  { name: 'Ongwediva', region: 'Oshana', kind: 'town' },
  { name: 'Oshakati', region: 'Oshana', kind: 'town' },
  { name: 'Uukwangula', region: 'Oshana', kind: 'settlement' },
  { name: 'Uukwiyu', region: 'Oshana', kind: 'settlement' },
  // Oshikoto
  { name: 'Olukonda', region: 'Oshikoto', kind: 'settlement' },
  { name: 'Omuntele', region: 'Oshikoto', kind: 'settlement' },
  { name: 'Omuthiya', region: 'Oshikoto', kind: 'town', aliases: ['Omuthiyagwiipundi', 'Omuthiya Gwiipundi'] },
  { name: 'Onayena', region: 'Oshikoto', kind: 'settlement' },
  { name: 'Oniipa', region: 'Oshikoto', kind: 'town' },
  { name: 'Onyaanya', region: 'Oshikoto', kind: 'settlement' },
  { name: 'Onyuulaye', region: 'Oshikoto', kind: 'settlement' },
  { name: 'Oshigambo', region: 'Oshikoto', kind: 'settlement' },
  { name: 'Oshivelo', region: 'Oshikoto', kind: 'settlement' },
  { name: 'Tsintsabis', region: 'Oshikoto', kind: 'settlement' },
  { name: 'Tsumeb', region: 'Oshikoto', kind: 'town' },
  // Otjozondjupa
  { name: 'Berg Aukas', region: 'Otjozondjupa', kind: 'settlement' },
  { name: 'Coblenz', region: 'Otjozondjupa', kind: 'settlement' },
  { name: 'Gam', region: 'Otjozondjupa', kind: 'settlement' },
  { name: 'Grootfontein', region: 'Otjozondjupa', kind: 'town' },
  { name: 'Hochfeld', region: 'Otjozondjupa', kind: 'settlement' },
  { name: 'Kalkfeld', region: 'Otjozondjupa', kind: 'settlement' },
  { name: 'Kombat', region: 'Otjozondjupa', kind: 'settlement' },
  { name: 'Okahandja', region: 'Otjozondjupa', kind: 'town' },
  { name: 'Okakarara', region: 'Otjozondjupa', kind: 'town' },
  { name: 'Okamatapati', region: 'Otjozondjupa', kind: 'settlement' },
  { name: 'Okandjira', region: 'Otjozondjupa', kind: 'settlement' },
  { name: 'Okatjoruu', region: 'Otjozondjupa', kind: 'settlement' },
  { name: 'Okondjatu', region: 'Otjozondjupa', kind: 'settlement', aliases: ['Okandjatu'] },
  { name: 'Osire', region: 'Otjozondjupa', kind: 'settlement' },
  { name: 'Otavi', region: 'Otjozondjupa', kind: 'town' },
  { name: 'Otjiwarongo', region: 'Otjozondjupa', kind: 'town' },
  { name: 'Tsumkwe', region: 'Otjozondjupa', kind: 'settlement' },
  // Zambezi
  { name: 'Bukalo', region: 'Zambezi', kind: 'village' },
  { name: 'Chinchimane', region: 'Zambezi', kind: 'settlement' },
  { name: 'Ibbu', region: 'Zambezi', kind: 'settlement' },
  { name: 'Impalila', region: 'Zambezi', kind: 'settlement', aliases: ['Mpalila', 'Impalila Island'] },
  { name: 'Kabbe', region: 'Zambezi', kind: 'settlement' },
  { name: 'Katima Mulilo', region: 'Zambezi', kind: 'town', aliases: ['Katima'] },
  { name: 'Kongola', region: 'Zambezi', kind: 'settlement' },
  { name: 'Linyanti', region: 'Zambezi', kind: 'settlement' },
  { name: 'Lisikili', region: 'Zambezi', kind: 'settlement' },
  { name: 'Luhonono', region: 'Zambezi', kind: 'settlement', aliases: ['Schuckmannsburg'] },
  { name: 'Lusese', region: 'Zambezi', kind: 'settlement' },
  { name: 'Nakabolelwa', region: 'Zambezi', kind: 'settlement' },
  { name: 'Ngoma', region: 'Zambezi', kind: 'settlement' },
  { name: 'Sangwali', region: 'Zambezi', kind: 'settlement' },
  { name: 'Sibbinda', region: 'Zambezi', kind: 'settlement' }
];

/** Region names written another way before 2013 or by hand, as the region they are now */
const REGION_ALIASES: Readonly<Record<string, NamibianRegion>> = {
  karas: '//Kharas',
  kharas: '//Kharas',
  caprivi: 'Zambezi'
};

/** For comparing what people type: no accents, clicks or punctuation, lower case, single spaces */
export function placeKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A region as stored (one of the 14), from a region name in any spelling; null when it is not one */
export function toNamibianRegion(text: string | null | undefined): NamibianRegion | null {
  const key = placeKey(text ?? '');
  if (!key) return null;
  return NAMIBIAN_REGIONS.find(region => placeKey(region) === key) ?? REGION_ALIASES[key.replace(/ /g, '')] ?? null;
}

const KIND_RANK: Record<PlaceKind, number> = { town: 0, village: 1, settlement: 2 };

/** The place whose name or other name is exactly what was typed (accents and case aside), else null */
export function findPlace(text: string | null | undefined): NamibianPlace | null {
  const key = placeKey(text ?? '');
  if (!key) return null;
  return NAMIBIAN_PLACES.find(place => placeKey(place.name) === key || (place.aliases ?? []).some(alias => placeKey(alias) === key)) ?? null;
}

export interface PlaceMatch {
  place: NamibianPlace;
  /** The other name that matched, shown with the place ("Oshikango" for Helao Nafidi); null when the name did */
  matchedAlias: string | null;
}

/**
 * Places for what has been typed, best first: names starting with it, then a word of the name starting with it, then
 * the other names; towns before villages and settlements, then A to Z. Nothing for an empty text.
 */
export function searchPlaces(text: string, limit = 8): PlaceMatch[] {
  const key = placeKey(text);
  if (!key) return [];
  const scored: Array<{ match: PlaceMatch; score: number }> = [];
  for (const place of NAMIBIAN_PLACES) {
    const name = placeKey(place.name);
    let score: number | null = null;
    let matchedAlias: string | null = null;
    if (name.startsWith(key)) score = 0;
    else if (name.split(' ').some(word => word.startsWith(key))) score = 1;
    else {
      for (const alias of place.aliases ?? []) {
        const aliasKey = placeKey(alias);
        if (aliasKey.startsWith(key) || aliasKey.split(' ').some(word => word.startsWith(key))) {
          score = 2;
          matchedAlias = alias;
          break;
        }
      }
      if (score === null && key.length >= 3 && name.includes(key)) score = 3;
    }
    if (score !== null) scored.push({ match: { place, matchedAlias }, score });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      KIND_RANK[a.match.place.kind] - KIND_RANK[b.match.place.kind] ||
      a.match.place.name.localeCompare(b.match.place.name)
  );
  return scored.slice(0, Math.max(limit, 0)).map(item => item.match);
}

/** What the town field and the region show once a place is picked */
export function pickPlace(place: NamibianPlace): { town: string; region: NamibianRegion } {
  return { town: place.name, region: place.region };
}

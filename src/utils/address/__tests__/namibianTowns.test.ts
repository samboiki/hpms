import { describe, expect, it } from 'vitest';
import { NAMIBIAN_PLACES, NAMIBIAN_REGIONS, findPlace, pickPlace, placeKey, searchPlaces, toNamibianRegion } from '../namibianTowns';

describe('the town list', () => {
  it('names only the 14 regions the database accepts, so a picked town can always be saved', () => {
    const regions = new Set<string>(NAMIBIAN_REGIONS);
    expect(regions.size).toBe(14);
    for (const place of NAMIBIAN_PLACES) expect(regions.has(place.region)).toBe(true);
  });

  it('has every region and no place twice, so the picker never offers two different regions for one town', () => {
    expect(new Set(NAMIBIAN_PLACES.map(place => place.region)).size).toBe(14);
    const keys = NAMIBIAN_PLACES.map(place => placeKey(place.name));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('puts the main towns in the right region (the regions reports and recalls are grouped by)', () => {
    expect(findPlace('Windhoek')?.region).toBe('Khomas');
    expect(findPlace('Oshakati')?.region).toBe('Oshana');
    expect(findPlace('Rundu')?.region).toBe('Kavango East');
    expect(findPlace('Nkurenkuru')?.region).toBe('Kavango West');
    expect(findPlace('Katima Mulilo')?.region).toBe('Zambezi');
    expect(findPlace('Keetmanshoop')?.region).toBe('//Kharas');
    expect(findPlace('Walvis Bay')?.region).toBe('Erongo');
  });
});

describe('finding a town as people type it', () => {
  it('ignores accents and case, so Luderitz typed on any keyboard finds Lüderitz', () => {
    expect(findPlace('luderitz')?.name).toBe('Lüderitz');
    expect(findPlace('  MALTAHOHE ')?.name).toBe('Maltahöhe');
    expect(searchPlaces('lud')[0].place.name).toBe('Lüderitz');
  });

  it('finds a place by its other name and says which name matched (Oshikango is part of Helao Nafidi)', () => {
    const [first] = searchPlaces('Oshikango');
    expect(first.place.name).toBe('Helao Nafidi');
    expect(first.matchedAlias).toBe('Oshikango');
    expect(findPlace('Walvisbaai')?.name).toBe('Walvis Bay');
  });

  it('lists towns before settlements for the same letters, because most patients live in towns', () => {
    const names = searchPlaces('osh', 20).map(match => match.place.name);
    expect(names.indexOf('Oshakati')).toBeLessThan(names.indexOf('Oshivelo'));
    expect(names.indexOf('Oshikuku')).toBeLessThan(names.indexOf('Oshigambo'));
  });

  it('matches the start of any word of a name (Bay finds Walvis Bay and Henties Bay)', () => {
    const names = searchPlaces('bay').map(match => match.place.name);
    expect(names).toEqual(expect.arrayContaining(['Walvis Bay', 'Henties Bay']));
  });

  it('offers nothing for an empty box and keeps to the limit asked for', () => {
    expect(searchPlaces('   ')).toEqual([]);
    expect(searchPlaces('o', 5)).toHaveLength(5);
  });

  it('fills the region when a town is picked', () => {
    const place = findPlace('Otjiwarongo');
    expect(place && pickPlace(place)).toEqual({ town: 'Otjiwarongo', region: 'Otjozondjupa' });
  });
});

describe('regions typed by hand', () => {
  it('stores the 2013 names, so an old address saying Caprivi or Karas still lands in the right region', () => {
    expect(toNamibianRegion('Caprivi')).toBe('Zambezi');
    expect(toNamibianRegion('Karas')).toBe('//Kharas');
    expect(toNamibianRegion('kharas')).toBe('//Kharas');
    expect(toNamibianRegion('kavango east')).toBe('Kavango East');
  });

  it('refuses what is not a region instead of storing something the database would reject', () => {
    expect(toNamibianRegion('Kavango')).toBeNull();
    expect(toNamibianRegion('')).toBeNull();
    expect(toNamibianRegion(null)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  fillableCellCount,
  getPack,
  packs,
  parsePack,
  pictureSize,
  transportation,
} from './index.js';

const validPicture = {
  id: 'kite',
  name: 'Kite',
  difficulty: 'easy' as const,
  palette: [{ name: 'Cloth', hex: '#3f8fbf' }],
  rows: ['.0.', '000', '.0.'],
};

const validPack = {
  schemaVersion: 1 as const,
  id: 'test-pack',
  name: 'Test pack',
  description: 'Fixture.',
  version: 1,
  pictures: [validPicture],
};

describe('the shipped transportation pack', () => {
  it('parses at module load', () => {
    expect(transportation.id).toBe('transportation');
    expect(transportation.pictures.length).toBeGreaterThan(0);
  });

  it('is reachable through the registry', () => {
    expect(getPack('transportation')).toBe(transportation);
    expect(getPack('nope')).toBeUndefined();
    expect(packs).toContain(transportation);
  });

  it('has rectangular grids with fillable cells throughout', () => {
    for (const picture of transportation.pictures) {
      const { width, height } = pictureSize(picture);
      expect(width).toBeGreaterThan(0);
      expect(height).toBe(picture.rows.length);
      for (const row of picture.rows) expect(row.length).toBe(width);
      expect(fillableCellCount(picture)).toBeGreaterThan(0);
    }
  });

  it('has unique picture ids', () => {
    const ids = transportation.pictures.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('parsePack', () => {
  it('accepts a minimal valid pack', () => {
    expect(parsePack(validPack).id).toBe('test-pack');
  });

  it('rejects a ragged grid, naming the offending row', () => {
    const ragged = { ...validPack, pictures: [{ ...validPicture, rows: ['.0.', '0000', '.0.'] }] };
    expect(() => parsePack(ragged)).toThrow(/row 1 is 4 wide, expected 3/);
  });

  it('rejects a palette index the picture does not define', () => {
    const bad = { ...validPack, pictures: [{ ...validPicture, rows: ['.9.', '000', '.0.'] }] };
    expect(() => parsePack(bad)).toThrow(/palette index 9/);
  });

  it('rejects a picture with nothing to fill', () => {
    const empty = { ...validPack, pictures: [{ ...validPicture, rows: ['...', '...'] }] };
    expect(() => parsePack(empty)).toThrow(/no fillable cells/);
  });

  it('rejects a malformed hex colour', () => {
    const bad = {
      ...validPack,
      pictures: [{ ...validPicture, palette: [{ name: 'X', hex: 'blue' }] }],
    };
    expect(() => parsePack(bad)).toThrow(/hex colour/);
  });

  it('rejects an unknown schema version so old packs fail loudly', () => {
    expect(() => parsePack({ ...validPack, schemaVersion: 2 })).toThrow(/Invalid shape pack/);
  });
});

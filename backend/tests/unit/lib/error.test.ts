import { describe, it, expect } from 'vitest';
import { hasPrismaCode, isZodError } from '../../../src/lib/error';

describe('hasPrismaCode', () => {
  it('returns true when error has the matching Prisma code', () => {
    const err = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    expect(hasPrismaCode(err, 'P2002')).toBe(true);
  });

  it('returns false when the code does not match', () => {
    const err = Object.assign(new Error('Record not found'), { code: 'P2025' });
    expect(hasPrismaCode(err, 'P2002')).toBe(false);
  });

  it('returns false when the error is not an Error instance', () => {
    expect(hasPrismaCode('string error', 'P2002')).toBe(false);
    expect(hasPrismaCode(null, 'P2002')).toBe(false);
    expect(hasPrismaCode(42, 'P2002')).toBe(false);
  });

  it('returns false when the error has no code property', () => {
    expect(hasPrismaCode(new Error('no code'), 'P2002')).toBe(false);
  });
});

describe('isZodError', () => {
  it('returns true for an error with ZodError name', () => {
    const err = new Error('Validation failed');
    err.name = 'ZodError';
    expect(isZodError(err)).toBe(true);
  });

  it('returns false for a regular Error', () => {
    expect(isZodError(new Error('regular error'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isZodError(null)).toBe(false);
    expect(isZodError('string')).toBe(false);
    expect(isZodError(undefined)).toBe(false);
  });
});

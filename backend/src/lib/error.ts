export function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && (error as { code: string }).code === code;
}

export function isZodError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ZodError';
}

export declare const TIERS: readonly string[];
export declare function mintCode(secret: string, tier?: string): string;
export declare function verifyCode(secret: string | undefined, code: unknown): string | null;

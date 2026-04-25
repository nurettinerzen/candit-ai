import * as argon2 from "argon2";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_POLICY_ERROR_MESSAGE =
  "Şifreniz en az 8 karakter olmalı, en az bir büyük harf, bir küçük harf ve bir özel karakter içermelidir.";

const PASSWORD_HASH_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1
};

const UPPERCASE_REGEX = /\p{Lu}/u;
const LOWERCASE_REGEX = /\p{Ll}/u;
const SPECIAL_CHARACTER_REGEX = /[^\p{L}\p{N}\s]/u;
export function isPasswordPolicySatisfied(password: string) {
  const value = password ?? "";

  return (
    value.length >= PASSWORD_MIN_LENGTH &&
    UPPERCASE_REGEX.test(value) &&
    LOWERCASE_REGEX.test(value) &&
    SPECIAL_CHARACTER_REGEX.test(value)
  );
}

export async function hashPassword(password: string) {
  return argon2.hash(password, PASSWORD_HASH_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

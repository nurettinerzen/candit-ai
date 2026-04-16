export const PASSWORD_MIN_LENGTH = 8;

const UPPERCASE_REGEX = /\p{Lu}/u;
const LOWERCASE_REGEX = /\p{Ll}/u;
const SPECIAL_CHARACTER_REGEX = /[^\p{L}\p{N}\s]/u;

export type PasswordPolicyStatus = {
  hasMinimumLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasSpecialCharacter: boolean;
  isValid: boolean;
};

export const PASSWORD_POLICY_ERROR_MESSAGE =
  "Şifreniz en az 8 karakter olmalı, en az bir büyük harf, bir küçük harf ve bir özel karakter içermelidir.";

export function getPasswordPolicyStatus(password: string): PasswordPolicyStatus {
  const value = password ?? "";
  const hasMinimumLength = value.length >= PASSWORD_MIN_LENGTH;
  const hasUppercase = UPPERCASE_REGEX.test(value);
  const hasLowercase = LOWERCASE_REGEX.test(value);
  const hasSpecialCharacter = SPECIAL_CHARACTER_REGEX.test(value);

  return {
    hasMinimumLength,
    hasUppercase,
    hasLowercase,
    hasSpecialCharacter,
    isValid: hasMinimumLength && hasUppercase && hasLowercase && hasSpecialCharacter
  };
}

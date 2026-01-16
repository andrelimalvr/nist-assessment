export const PASSWORD_MIN_LENGTH = 12;

const UPPERCASE_REGEX = /[A-Z]/;
const SPECIAL_REGEX = /[!@#$%^&*()_+\-=[\]{}|;':",.<>/?]/;
const NUMBER_REGEX = /[0-9]/;

export function getPasswordValidationError(password: string, email?: string | null) {
  if (!password) {
    return "Informe a nova senha.";
  }

  if (email && password.toLowerCase() === email.toLowerCase()) {
    return "A senha nao pode ser igual ao email.";
  }

  const hasUppercase = UPPERCASE_REGEX.test(password);
  const hasSpecial = SPECIAL_REGEX.test(password);
  const hasNumber = NUMBER_REGEX.test(password);

  if (password.length < PASSWORD_MIN_LENGTH || !hasUppercase || !hasSpecial || !hasNumber) {
    return "A senha deve ter no minimo 12 caracteres e conter 1 letra maiuscula, 1 numero e 1 caractere especial.";
  }

  return null;
}

export function generateTemporaryPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const special = "!@#$%^&*";
  const all = `${upper}${lower}${numbers}${special}`;

  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const password = [pick(upper), pick(lower), pick(numbers), pick(special)];

  while (password.length < 14) {
    password.push(pick(all));
  }

  return password.sort(() => 0.5 - Math.random()).join("");
}

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export const isAllowedEmail = (email: string): boolean => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return false;
  }

  const [localPart = ""] = normalizedEmail.split("@");
  if (localPart.includes("+")) {
    return false;
  }

  return true;
};

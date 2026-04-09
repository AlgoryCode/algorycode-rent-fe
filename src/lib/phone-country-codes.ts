export type PhoneCountryCode = {
  code: string;
  label: string;
};

export const PHONE_COUNTRY_CODES: PhoneCountryCode[] = [
  { code: "+90", label: "TR (+90)" },
  { code: "+49", label: "DE (+49)" },
  { code: "+44", label: "GB (+44)" },
  { code: "+33", label: "FR (+33)" },
  { code: "+39", label: "IT (+39)" },
  { code: "+34", label: "ES (+34)" },
  { code: "+31", label: "NL (+31)" },
  { code: "+32", label: "BE (+32)" },
  { code: "+41", label: "CH (+41)" },
  { code: "+43", label: "AT (+43)" },
  { code: "+1", label: "US/CA (+1)" },
  { code: "+7", label: "RU (+7)" },
  { code: "+971", label: "AE (+971)" },
  { code: "+966", label: "SA (+966)" },
  { code: "+20", label: "EG (+20)" },
];

/**
 * Smart Regex & Anti-Spam / Anti-Scam / Profanity Engine for Omeglo
 * Detects and sanitizes phone numbers, external scam links, telegram/whatsapp handles, and vulgar language.
 */

// 1. Phone number patterns (Sri Lankan mobile, international formats, obfuscated spaced numbers)
const PHONE_NUMBER_REGEX = /(\+?94[\s.-]?[0-9]{2}[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}|07[0-9]{1}[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}|(?:\+?[0-9]{1,3})?[\s.-]?\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}|[0-9][\s.-]?[0-9][\s.-]?[0-9][\s.-]?[0-9][\s.-]?[0-9][\s.-]?[0-9][\s.-]?[0-9][\s.-]?[0-9][\s.-]?[0-9][\s.-]?[0-9])/gi;

// 2. Link & Scam / Social handle patterns (URLs, telegram links, whatsapp links, instagram/snap handles)
const URL_SCAM_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|net|org|lk|io|gg|xyz|me|info|top|site|online|live|tv|link|app|click)\b|t\.me\/[a-zA-Z0-9_]+|wa\.me\/[0-9]+|whatsapp\.com|telegram\.me|snapchat\.com|instagram\.com\/[a-zA-Z0-9_.]+|(?:ig|snap|snapchat|insta|telegram|tele|wa|whatsapp)\s*[:=]\s*@?[a-zA-Z0-9_.]+)/gi;

// 3. Known vulgarities / profane terms (English and common transliterated words)
const PROFANITY_WORDS = [
  "fuck", "fucking", "fucked", "fucker", "bitch", "slut", "whore", "asshole",
  "pussy", "dick", "cock", "cunt", "nigger", "nigga", "bastard", "nude", "nudes",
  "send nudes", "sex", "porn", "porno", "horny", "boobs", "penis", "vagina",
  "pakaya", "ponnaya", "hutta", "kariyo", "wesige", "balla", "hukanna"
];

// Build regex for word boundary matching
const PROFANITY_REGEX = new RegExp(
  `\\b(${PROFANITY_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi"
);

export interface FilterResult {
  originalText: string;
  cleanText: string;
  isBlocked: boolean;
  hasProfanity: boolean;
  hasSpamOrLink: boolean;
  hasPhoneNumber: boolean;
  warningMessage?: string;
}

/**
 * Filter and scan incoming or outgoing message text
 */
export function filterMessage(text: string): FilterResult {
  if (!text || typeof text !== "string") {
    return {
      originalText: "",
      cleanText: "",
      isBlocked: false,
      hasProfanity: false,
      hasSpamOrLink: false,
      hasPhoneNumber: false,
    };
  }

  let cleanText = text;
  let hasPhoneNumber = false;
  let hasSpamOrLink = false;
  let hasProfanity = false;
  let warningMessage: string | undefined;

  // 1. Check Phone Numbers
  if (PHONE_NUMBER_REGEX.test(text)) {
    hasPhoneNumber = true;
    cleanText = cleanText.replace(PHONE_NUMBER_REGEX, "[Phone Number Hidden]");
    warningMessage = "Sharing phone numbers is restricted for your safety.";
  }

  // 2. Check Spam / Links / Handles
  if (URL_SCAM_REGEX.test(text)) {
    hasSpamOrLink = true;
    cleanText = cleanText.replace(URL_SCAM_REGEX, "[Link Removed]");
    warningMessage = "External links and social handles are not allowed.";
  }

  // 3. Mask Profanities
  if (PROFANITY_REGEX.test(cleanText)) {
    hasProfanity = true;
    cleanText = cleanText.replace(PROFANITY_REGEX, (match) => "*".repeat(match.length));
    if (!warningMessage) {
      warningMessage = "Inappropriate language was filtered out.";
    }
  }

  // If text is purely a phone number or scam link, mark as blocked
  const isBlocked = cleanText.trim() === "[Phone Number Hidden]" || cleanText.trim() === "[Link Removed]";

  return {
    originalText: text,
    cleanText,
    isBlocked,
    hasProfanity,
    hasSpamOrLink,
    hasPhoneNumber,
    warningMessage,
  };
}

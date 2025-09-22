import { parsePhoneNumber } from 'libphonenumber-js';

const COUNTRY_TIMEZONE_MAP = {
  // North America
  'US': 'America/New_York',
  'CA': 'America/Toronto',
  'MX': 'America/Mexico_City',

  // Europe  
  'GB': 'Europe/London',
  'DE': 'Europe/Berlin',
  'FR': 'Europe/Paris',
  'IT': 'Europe/Rome',
  'ES': 'Europe/Madrid',
  'NL': 'Europe/Amsterdam',
  'CH': 'Europe/Zurich',
  'AT': 'Europe/Vienna',
  'BE': 'Europe/Brussels',
  'SE': 'Europe/Stockholm',
  'NO': 'Europe/Oslo',
  'DK': 'Europe/Copenhagen',
  'FI': 'Europe/Helsinki',
  'PL': 'Europe/Warsaw',
  'CZ': 'Europe/Prague',
  'HU': 'Europe/Budapest',
  'GR': 'Europe/Athens',
  'PT': 'Europe/Lisbon',
  'IE': 'Europe/Dublin',

  // Asia-Pacific
  'JP': 'Asia/Tokyo',
  'CN': 'Asia/Shanghai',
  'IN': 'Asia/Kolkata',
  'KR': 'Asia/Seoul',
  'SG': 'Asia/Singapore',
  'HK': 'Asia/Hong_Kong',
  'TW': 'Asia/Taipei',
  'TH': 'Asia/Bangkok',
  'MY': 'Asia/Kuala_Lumpur',
  'PH': 'Asia/Manila',
  'ID': 'Asia/Jakarta',
  'VN': 'Asia/Ho_Chi_Minh',
  'AE': 'Asia/Dubai',
  'SA': 'Asia/Riyadh',
  'IL': 'Asia/Jerusalem',
  'TR': 'Europe/Istanbul',

  // Australia/Oceania
  'AU': 'Australia/Sydney',
  'NZ': 'Pacific/Auckland',

  // South America
  'BR': 'America/Sao_Paulo',
  'AR': 'America/Argentina/Buenos_Aires',
  'CL': 'America/Santiago',
  'CO': 'America/Bogota',
  'PE': 'America/Lima',
  'VE': 'America/Caracas',

  // Africa
  'ZA': 'Africa/Johannesburg',
  'EG': 'Africa/Cairo',
  'NG': 'Africa/Lagos',
  'KE': 'Africa/Nairobi',
  'MA': 'Africa/Casablanca',
};

export function detectTimezoneFromPhone(phoneNumber) {
  try {
    const parsed = parsePhoneNumber(phoneNumber);
    const timezone = COUNTRY_TIMEZONE_MAP[parsed.country];
    
    console.log(`📍 Detected country: ${parsed.country}, timezone: ${timezone || 'UTC'}`);
    return timezone || 'UTC';
  } catch (error) {
    console.error('Error parsing phone number for timezone:', error);
    return 'UTC';
  }
}

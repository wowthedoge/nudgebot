import { parsePhoneNumberWithError } from 'libphonenumber-js';

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
    const parsed = parsePhoneNumberWithError(`+${phoneNumber}`);
    const timezone = COUNTRY_TIMEZONE_MAP[parsed.country];
    
    console.log(`📍 Detected country: ${parsed.country}, timezone: ${timezone || 'UTC'}`);
    return timezone || 'UTC';
  } catch (error) {
    console.error('Error parsing phone number for timezone:', error);
    return 'UTC';
  }
}

/**
 * Get the UTC offset for a given timezone in hours
 * @param {string} timezone - IANA timezone identifier (e.g., 'America/New_York', 'Asia/Tokyo')
 * @param {Date} [date=new Date()] - Optional date to calculate offset for (important for DST)
 * @returns {number} - Offset in hours (e.g., -5 for EST, +8 for SGT)
 */
export function getUtcOffset(timezone, date = new Date()) {
  try {
    const tzTime = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    
    const utcTime = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    
    const offsetMs = tzTime - utcTime;
    const offsetHours = offsetMs / (1000 * 60 * 60);
    
    return offsetHours;
  } catch (error) {
    console.error('Error calculating UTC offset for timezone:', timezone, error);
    return 0;
  }
}

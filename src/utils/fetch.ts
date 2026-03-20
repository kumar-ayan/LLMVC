import axios from 'axios';
import * as cheerio from 'cheerio';
import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 1024 * 1024;

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }

  return (((parts[0] * 256) + parts[1]) * 256 + parts[2]) * 256 + parts[3];
}

function isBlockedIPv4(ip: string): boolean {
  const value = ipv4ToNumber(ip);
  if (value === null) {
    return true;
  }

  const ranges: Array<[number, number]> = [
    [ipv4ToNumber('0.0.0.0')!, ipv4ToNumber('0.255.255.255')!],
    [ipv4ToNumber('10.0.0.0')!, ipv4ToNumber('10.255.255.255')!],
    [ipv4ToNumber('100.64.0.0')!, ipv4ToNumber('100.127.255.255')!],
    [ipv4ToNumber('127.0.0.0')!, ipv4ToNumber('127.255.255.255')!],
    [ipv4ToNumber('169.254.0.0')!, ipv4ToNumber('169.254.255.255')!],
    [ipv4ToNumber('172.16.0.0')!, ipv4ToNumber('172.31.255.255')!],
    [ipv4ToNumber('192.168.0.0')!, ipv4ToNumber('192.168.255.255')!],
    [ipv4ToNumber('198.18.0.0')!, ipv4ToNumber('198.19.255.255')!],
    [ipv4ToNumber('224.0.0.0')!, ipv4ToNumber('255.255.255.255')!],
  ];

  return ranges.some(([start, end]) => value >= start && value <= end);
}

function parseIpv6(ip: string): bigint | null {
  let normalized = ip.toLowerCase();
  const zoneIndex = normalized.indexOf('%');
  if (zoneIndex !== -1) {
    normalized = normalized.slice(0, zoneIndex);
  }

  if (normalized.includes('.')) {
    const lastColon = normalized.lastIndexOf(':');
    const ipv4Value = ipv4ToNumber(normalized.slice(lastColon + 1));
    if (ipv4Value === null) {
      return null;
    }

    const high = ((ipv4Value >>> 16) & 0xffff).toString(16);
    const low = (ipv4Value & 0xffff).toString(16);
    normalized = `${normalized.slice(0, lastColon)}:${high}:${low}`;
  }

  const [head, tail] = normalized.split('::');
  if (normalized.split('::').length > 2) {
    return null;
  }

  const headParts = head ? head.split(':').filter(Boolean) : [];
  const tailParts = tail ? tail.split(':').filter(Boolean) : [];
  const missing = 8 - (headParts.length + tailParts.length);
  if (missing < 0) {
    return null;
  }

  const parts = [...headParts, ...Array(missing).fill('0'), ...tailParts];
  if (parts.length !== 8) {
    return null;
  }

  try {
    return parts.reduce((acc, part) => (acc << 16n) + BigInt(parseInt(part, 16)), 0n);
  } catch {
    return null;
  }
}

function isWithinIpv6Range(value: bigint, start: string, end: string): boolean {
  const startValue = parseIpv6(start);
  const endValue = parseIpv6(end);
  if (startValue === null || endValue === null) {
    return false;
  }

  return value >= startValue && value <= endValue;
}

function isBlockedIPv6(ip: string): boolean {
  const value = parseIpv6(ip);
  if (value === null) {
    return true;
  }

  if (value === 0n || value === 1n) {
    return true;
  }

  if (isWithinIpv6Range(value, '::ffff:0:0', '::ffff:ffff:ffff')) {
    const mappedIpv4 = Number(value & 0xffffffffn);
    const a = (mappedIpv4 >>> 24) & 0xff;
    const b = (mappedIpv4 >>> 16) & 0xff;
    const c = (mappedIpv4 >>> 8) & 0xff;
    const d = mappedIpv4 & 0xff;
    return isBlockedIPv4(`${a}.${b}.${c}.${d}`);
  }

  return (
    isWithinIpv6Range(value, 'fc00::', 'fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff') ||
    isWithinIpv6Range(value, 'fe80::', 'febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff') ||
    isWithinIpv6Range(value, 'ff00::', 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')
  );
}

function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    return isBlockedIPv4(ip);
  }
  if (family === 6) {
    return isBlockedIPv6(ip);
  }
  return false;
}

async function resolvePublicAddress(hostname: string): Promise<{ address: string; family: number }> {
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new Error(`SSRF Block: IP ${hostname} is not publicly routable.`);
    }
    return { address: hostname, family: net.isIP(hostname) };
  }

  const results = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  const safe = results.find(result => !isBlockedIp(result.address));
  if (!safe) {
    throw new Error(`SSRF Block: Hostname ${hostname} resolves only to private or reserved IPs.`);
  }

  return safe;
}

function createSafeLookup(): any {
  return ((hostname: string, _options: unknown, callback: (err: NodeJS.ErrnoException | null, address?: string, family?: number) => void) => {
    resolvePublicAddress(hostname)
      .then(result => callback(null, result.address, result.family))
      .catch(err => callback(err));
  }) as any;
}

function validateExternalUrl(urlStr: string): URL {
  const parsed = new URL(urlStr);

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are allowed.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed.');
  }

  return parsed;
}

async function fetchUrl(currentUrl: URL) {
  await resolvePublicAddress(currentUrl.hostname);

  const agentOptions = { lookup: createSafeLookup() };
  return axios.get<string>(currentUrl.toString(), {
    timeout: 10000,
    maxRedirects: 0,
    maxContentLength: MAX_RESPONSE_BYTES,
    maxBodyLength: MAX_RESPONSE_BYTES,
    responseType: 'text',
    headers: {
      'User-Agent': 'PromptVault CLI Bot 1.0',
      'Accept': 'text/html, text/plain;q=0.9, */*;q=0.1'
    },
    httpAgent: new http.Agent(agentOptions),
    httpsAgent: new https.Agent(agentOptions),
    validateStatus: status => status >= 200 && status < 400
  });
}

export async function fetchAndCleanWebpage(urlStr: string): Promise<string> {
  let currentUrl = validateExternalUrl(urlStr);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const res = await fetchUrl(currentUrl);

    if (res.status >= 300 && res.status < 400) {
      const nextLocation = res.headers.location;
      if (!nextLocation) {
        throw new Error('Redirect response missing Location header.');
      }

      currentUrl = validateExternalUrl(new URL(nextLocation, currentUrl).toString());
      continue;
    }

    const $ = cheerio.load(res.data);

    // Remove junk
    $('script, style, nav, footer, header, aside, noscript, iframe').remove();

    let text = $('body').text();

    // Clean up excessive whitespace
    text = text.replace(/\n\s*\n/g, '\n\n').replace(/[ \t]+/g, ' ').trim();

    return text;
  }

  throw new Error(`Too many redirects. Maximum allowed is ${MAX_REDIRECTS}.`);
}

import axios from 'axios';
import * as cheerio from 'cheerio';
import net from 'net';
import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

function isPrivateIP(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1') return true;
  
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;
  
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  
  return false;
}

export async function fetchAndCleanWebpage(urlStr: string): Promise<string> {
  const url = new URL(urlStr);
  
  // SSRF Protection
  if (!net.isIP(url.hostname)) {
    try {
      const resolved = await lookup(url.hostname);
      if (isPrivateIP(resolved.address)) {
        throw new Error(`SSRF Block: Resolved IP ${resolved.address} is private.`);
      }
    } catch (err: any) {
      if (err.message.includes('SSRF Block')) throw err;
      // dns lookup failed, let axios handle the network error
    }
  } else if (isPrivateIP(url.hostname)) {
    throw new Error(`SSRF Block: IP ${url.hostname} is private.`);
  }

  const res = await axios.get(urlStr, {
    timeout: 10000,
    headers: { 'User-Agent': 'PromptVault CLI Bot 1.0' }
  });

  const $ = cheerio.load(res.data);

  // Remove junk
  $('script, style, nav, footer, header, aside, noscript, iframe').remove();

  let text = $('body').text();
  
  // Clean up excessive whitespace
  text = text.replace(/\n\s*\n/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
  
  return text;
}

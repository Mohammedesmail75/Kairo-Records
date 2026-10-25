/**
 * KAIRO RECORDS — LOCAL SERVER
 * Zero-dependency HTTP server with Range streaming & security checks.
 * Run with: node server.js
 * Serves on: http://localhost:3001
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

// Load local environment secrets (.dev.vars or .env) if present
function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) process.env[key] = val;
          }
        }
      });
    } catch (e) {}
  }
}
loadEnvFile(path.join(BASE_DIR, '..', '.dev.vars'));
loadEnvFile(path.join(BASE_DIR, '..', '.env'));
loadEnvFile(path.join(BASE_DIR, '.dev.vars'));
loadEnvFile(path.join(BASE_DIR, '.env'));

let localReleasesCache = { data: null, timestamp: 0 };
const CACHE_TTL_SECONDS = 900; // 15 minutes

const server = http.createServer(async (req, res) => {
  let reqUrl = req.url.split('?')[0];
  if (reqUrl === '/') reqUrl = '/index.html';

  // API endpoint for YouTube channel releases
  if (reqUrl === '/api/releases' && (req.method === 'GET' || req.method === 'HEAD')) {
    const corsHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    const now = Date.now();
    if (localReleasesCache.data && (now - localReleasesCache.timestamp) < (CACHE_TTL_SECONDS * 1000)) {
      res.writeHead(200, {
        ...corsHeaders,
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
        'X-Cache-Status': 'HIT'
      });
      res.end(JSON.stringify(localReleasesCache.data));
      return;
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({
        configured: false,
        error: 'YOUTUBE_API_KEY is not configured.',
        channelUrl: 'https://www.youtube.com/@KAIROREC',
        videos: []
      }));
      return;
    }

    try {
      let channelId = 'UC9xHojIQiYeXsTzmZR7b5qg';
      let uploadsPlaylistId = 'UU9xHojIQiYeXsTzmZR7b5qg';
      let channelTitle = 'KAIRO RECORDS';

      try {
        const cRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&forHandle=KAIROREC&key=${apiKey}`);
        if (cRes.ok) {
          const cData = await cRes.json();
          if (cData.items && cData.items.length > 0) {
            const item = cData.items[0];
            channelId = item.id || channelId;
            channelTitle = item.snippet?.title || channelTitle;
            if (item.contentDetails?.relatedPlaylists?.uploads) {
              uploadsPlaylistId = item.contentDetails.relatedPlaylists.uploads;
            }
          }
        }
      } catch (e) {}

      const pRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=6&key=${apiKey}`);
      if (!pRes.ok) {
        throw new Error(`YouTube playlistItems API returned ${pRes.status}`);
      }

      const pData = await pRes.json();
      const items = pData.items || [];
      const videoIds = items.map(i => i.contentDetails?.videoId || i.snippet?.resourceId?.videoId).filter(Boolean);

      let videosMap = {};
      if (videoIds.length > 0) {
        try {
          const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${videoIds.join(',')}&key=${apiKey}`);
          if (vRes.ok) {
            const vData = await vRes.json();
            if (vData.items) vData.items.forEach(v => { videosMap[v.id] = v; });
          }
        } catch (ve) {}
      }

      const videos = items.map(item => {
        const id = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
        if (!id) return null;
        const vInfo = videosMap[id];
        if (vInfo && vInfo.status && vInfo.status.privacyStatus && vInfo.status.privacyStatus !== 'public') return null;

        const snippet = vInfo?.snippet || item.snippet;
        const thumbs = snippet?.thumbnails || {};
        const thumbnail = thumbs.maxres?.url || thumbs.standard?.url || thumbs.high?.url || thumbs.medium?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

        return {
          id,
          title: snippet?.title || 'KAIRO RECORDS Release',
          publishedAt: snippet?.publishedAt || item.contentDetails?.videoPublishedAt || '',
          thumbnail,
          url: `https://www.youtube.com/watch?v=${id}`,
          embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
          embeddable: vInfo?.status?.embeddable !== false
        };
      }).filter(Boolean).slice(0, 6);

      const payload = {
        configured: true,
        channelId,
        channelTitle,
        channelUrl: 'https://www.youtube.com/@KAIROREC',
        videos,
        cachedAt: new Date().toISOString()
      };

      localReleasesCache = { data: payload, timestamp: now };
      res.writeHead(200, {
        ...corsHeaders,
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
        'X-Cache-Status': 'MISS'
      });
      res.end(JSON.stringify(payload));
      return;
    } catch (err) {
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({
        configured: true,
        error: err.message || 'Error fetching from YouTube API',
        channelUrl: 'https://www.youtube.com/@KAIROREC',
        videos: []
      }));
      return;
    }
  }

  // API endpoint for company data
  if (reqUrl === '/api/company-data' && req.method === 'GET') {
    const dataPath = path.join(BASE_DIR, 'data', 'company-data.json');
    if (fs.existsSync(dataPath)) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(dataPath).pipe(res);
      return;
    }
  }

  // Security check: Block direct access to server-side code and secrets
  const blockedFiles = ['/server.js', '/package.json', '/.env', '/.dev.vars', '/wrangler.toml', '/worker.js', '/.git', '/readme.md'];
  const lowerUrl = reqUrl.toLowerCase();
  if (blockedFiles.some(b => lowerUrl === b || lowerUrl.startsWith(b + '/'))) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden: Access denied');
    return;
  }

  const safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(BASE_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${reqUrl}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // HTTP Range Requests for media streaming
    const range = req.headers.range;
    if (range && (ext === '.mp3' || ext === '.mp4' || ext === '.webm')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      file.pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🎬 KAIRO RECORDS SERVER RUNNING`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});

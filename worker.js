/**
 * KAIRO RECORDS — CLOUDFLARE WORKER
 * Handles static asset serving and /api/releases with YouTube Data API v3 integration.
 */

const CHANNEL_HANDLE = 'KAIROREC';
const KNOWN_CHANNEL_ID = 'UC9xHojIQiYeXsTzmZR7b5qg';
const CACHE_TTL_SECONDS = 900; // 15 minutes

// In-memory cache across worker invocation lifecycles
let releasesCache = {
  data: null,
  timestamp: 0
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route: /api/releases
    if (url.pathname === '/api/releases') {
      return handleReleases(request, env, ctx);
    }

    // Security: Prevent serving backend scripts, config files, and secrets
    const blockedFiles = ['/server.js', '/package.json', '/.env', '/.dev.vars', '/wrangler.toml', '/worker.js', '/.git', '/readme.md'];
    const lowerPath = url.pathname.toLowerCase();
    if (blockedFiles.some(b => lowerPath === b || lowerPath.startsWith(b + '/'))) {
      return new Response('Access Denied', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // Pass all other requests to static assets
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Asset not found', { status: 404 });
  }
};

async function handleReleases(request, env, ctx) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders
    });
  }

  const now = Date.now();

  // Return cached result if valid (within 15 minutes)
  if (releasesCache.data && (now - releasesCache.timestamp) < (CACHE_TTL_SECONDS * 1000)) {
    return new Response(JSON.stringify(releasesCache.data), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
        'X-Cache-Status': 'HIT'
      }
    });
  }

  // Robust secret resolution: supports env bindings, case-insensitivity, global scope, and trims whitespace
  const apiKey = resolveApiKey(env);

  if (!apiKey) {
    const boundKeys = env && typeof env === 'object' ? Object.keys(env) : [];
    return new Response(JSON.stringify({
      configured: false,
      error: 'YOUTUBE_API_KEY secret is not set in Cloudflare Worker configuration.',
      channelUrl: 'https://www.youtube.com/@KAIROREC',
      bindingsPresent: boundKeys,
      videos: []
    }), {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    // Step 1: Resolve channel ID and uploads playlist ID using forHandle
    let channelId = KNOWN_CHANNEL_ID;
    let uploadsPlaylistId = 'UU' + channelId.substring(2);
    let channelTitle = 'KAIRO RECORDS';

    try {
      const channelRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&forHandle=${CHANNEL_HANDLE}&key=${apiKey}`
      );
      if (channelRes.ok) {
        const channelData = await channelRes.json();
        if (channelData.items && channelData.items.length > 0) {
          const item = channelData.items[0];
          channelId = item.id || channelId;
          channelTitle = item.snippet?.title || channelTitle;
          if (item.contentDetails?.relatedPlaylists?.uploads) {
            uploadsPlaylistId = item.contentDetails.relatedPlaylists.uploads;
          }
        }
      }
    } catch (e) {
      // Fallback to known uploads playlist ID if handle lookup fails
      uploadsPlaylistId = 'UU' + channelId.substring(2);
    }

    // Step 2: Fetch latest uploads from the uploads playlist (up to 6 items)
    const playlistRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=6&key=${apiKey}`
    );

    if (!playlistRes.ok) {
      const errBody = await playlistRes.text();
      let errMsg = `YouTube API playlistItems returned status ${playlistRes.status}`;
      try {
        const parsed = JSON.parse(errBody);
        errMsg = parsed.error?.message || errMsg;
      } catch (pe) {}
      throw new Error(errMsg);
    }

    const playlistData = await playlistRes.json();
    const items = playlistData.items || [];

    if (items.length === 0) {
      const emptyPayload = {
        configured: true,
        channelId,
        channelTitle,
        channelUrl: 'https://www.youtube.com/@KAIROREC',
        videos: [],
        cachedAt: new Date().toISOString()
      };
      releasesCache = { data: emptyPayload, timestamp: now };
      return new Response(JSON.stringify(emptyPayload), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
          'X-Cache-Status': 'MISS'
        }
      });
    }

    // Step 3: Verify video availability and embedding status via videos.list
    const videoIds = items
      .map(i => i.contentDetails?.videoId || i.snippet?.resourceId?.videoId)
      .filter(Boolean);

    let videosMap = {};
    if (videoIds.length > 0) {
      try {
        const videosRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${videoIds.join(',')}&key=${apiKey}`
        );
        if (videosRes.ok) {
          const videosData = await videosRes.json();
          if (videosData.items) {
            videosData.items.forEach(v => {
              videosMap[v.id] = v;
            });
          }
        }
      } catch (ve) {
        // Continue with playlist snippet data if videos.list call fails
      }
    }

    // Step 4: Map and filter public embeddable videos
    const videos = items
      .map(item => {
        const id = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
        if (!id) return null;

        const vInfo = videosMap[id];

        // Skip non-public videos if status is available
        if (vInfo && vInfo.status && vInfo.status.privacyStatus && vInfo.status.privacyStatus !== 'public') {
          return null;
        }

        const snippet = vInfo?.snippet || item.snippet;
        const title = snippet?.title || 'KAIRO RECORDS Release';
        const publishedAt = snippet?.publishedAt || item.contentDetails?.videoPublishedAt || '';

        const thumbs = snippet?.thumbnails || {};
        const thumbnail =
          thumbs.maxres?.url ||
          thumbs.standard?.url ||
          thumbs.high?.url ||
          thumbs.medium?.url ||
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

        const embeddable = vInfo?.status?.embeddable !== false;

        return {
          id,
          title,
          publishedAt,
          thumbnail,
          url: `https://www.youtube.com/watch?v=${id}`,
          embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
          embeddable
        };
      })
      .filter(Boolean)
      .slice(0, 6);

    const payload = {
      configured: true,
      channelId,
      channelTitle,
      channelUrl: 'https://www.youtube.com/@KAIROREC',
      videos,
      cachedAt: new Date().toISOString()
    };

    // Cache successful response
    releasesCache = { data: payload, timestamp: now };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
        'X-Cache-Status': 'MISS'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      configured: true,
      error: error.message || 'Error communicating with YouTube API',
      channelUrl: 'https://www.youtube.com/@KAIROREC',
      videos: []
    }), {
      status: 200, // Return 200 with error property so client gracefully displays error fallback UI
      headers: corsHeaders
    });
  }
}

/**
 * Robustly resolves the YouTube Data API key from environment bindings,
 * handling case variations, whitespace, global scope, and process.env.
 */
function resolveApiKey(env) {
  if (env && typeof env === 'object') {
    if (typeof env.YOUTUBE_API_KEY === 'string' && env.YOUTUBE_API_KEY.trim()) {
      return env.YOUTUBE_API_KEY.trim().replace(/^["']|["']$/g, '');
    }
    for (const key of Object.keys(env)) {
      if (key.trim().toUpperCase() === 'YOUTUBE_API_KEY') {
        const val = env[key];
        if (typeof val === 'string' && val.trim()) {
          return val.trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  }

  if (typeof YOUTUBE_API_KEY !== 'undefined' && typeof YOUTUBE_API_KEY === 'string' && YOUTUBE_API_KEY.trim()) {
    return YOUTUBE_API_KEY.trim().replace(/^["']|["']$/g, '');
  }

  if (typeof globalThis !== 'undefined' && globalThis && typeof globalThis.YOUTUBE_API_KEY === 'string' && globalThis.YOUTUBE_API_KEY.trim()) {
    return globalThis.YOUTUBE_API_KEY.trim().replace(/^["']|["']$/g, '');
  }

  if (typeof process !== 'undefined' && process.env) {
    if (typeof process.env.YOUTUBE_API_KEY === 'string' && process.env.YOUTUBE_API_KEY.trim()) {
      return process.env.YOUTUBE_API_KEY.trim().replace(/^["']|["']$/g, '');
    }
    for (const key of Object.keys(process.env)) {
      if (key.trim().toUpperCase() === 'YOUTUBE_API_KEY') {
        const val = process.env[key];
        if (typeof val === 'string' && val.trim()) {
          return val.trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  }

  return null;
}


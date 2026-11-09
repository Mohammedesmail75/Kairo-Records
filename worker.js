/**
 * KAIRO RECORDS — CLOUDFLARE WORKER
 * Handles static asset serving and /api/releases with YouTube Data API v3 integration.
 */

const DEFAULT_PLAYLIST_ID = 'PLGcjuTeisA5Q';
const KNOWN_CHANNEL_ID = 'UC9xHojIQiYeXsTzmZR7b5qg';
const CACHE_TTL_SECONDS = 900; // 15 minutes

// In-memory cache across worker invocation lifecycles
let releasesCache = {
  data: null,
  timestamp: 0,
  playlistId: null
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

  const playlistId = resolvePlaylistId(env);
  const now = Date.now();

  // Return cached result if valid (within 15 minutes and matching playlistId)
  if (
    releasesCache.data &&
    releasesCache.playlistId === playlistId &&
    (now - releasesCache.timestamp) < (CACHE_TTL_SECONDS * 1000)
  ) {
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
      playlistId,
      bindingsPresent: boundKeys,
      videos: []
    }), {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    // Step 1: Fetch items from the configured official releases playlist
    const playlistRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails,status&playlistId=${encodeURIComponent(playlistId)}&maxResults=50&key=${apiKey}`
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
        channelId: KNOWN_CHANNEL_ID,
        channelTitle: 'KAIRO RECORDS',
        channelUrl: 'https://www.youtube.com/@KAIROREC',
        playlistId,
        playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
        videos: [],
        cachedAt: new Date().toISOString()
      };
      releasesCache = { data: emptyPayload, timestamp: now, playlistId };
      return new Response(JSON.stringify(emptyPayload), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
          'X-Cache-Status': 'MISS'
        }
      });
    }

    // Step 2: Fetch full video details (real title, accurate published date, thumbnails, privacy, embedding status)
    const videoIds = items
      .map(i => i.contentDetails?.videoId || i.snippet?.resourceId?.videoId)
      .filter(Boolean);

    // Deduplicate IDs while preserving order
    const uniqueVideoIds = [...new Set(videoIds)];

    let videosMap = {};
    let videosFetchSucceeded = false;

    if (uniqueVideoIds.length > 0) {
      try {
        const videosRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${encodeURIComponent(uniqueVideoIds.join(','))}&key=${apiKey}`
        );
        if (videosRes.ok) {
          const videosData = await videosRes.json();
          if (videosData.items) {
            videosData.items.forEach(v => {
              videosMap[v.id] = v;
            });
            videosFetchSucceeded = true;
          }
        }
      } catch (ve) {
        // Continue with playlist snippet data if videos.list call fails
      }
    }

    // Step 3: Map and filter public videos from this playlist
    // Short official releases must remain eligible if in playlist; do not filter by duration
    const videos = items
      .map(item => {
        const id = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
        if (!id) return null;

        const vInfo = videosMap[id];

        // If videos.list succeeded and returned items, verify the video exists
        if (videosFetchSucceeded && !vInfo) {
          // Video deleted, unavailable, or private (not returned by public videos.list)
          return null;
        }

        // Skip non-public videos (private or unlisted)
        const privacyStatus = vInfo?.status?.privacyStatus || item.status?.privacyStatus;
        if (privacyStatus && privacyStatus !== 'public') {
          return null;
        }

        // Filter out placeholder titles for private or deleted playlist items
        const rawTitle = item.snippet?.title || '';
        if (rawTitle === 'Private video' || rawTitle === 'Deleted video') {
          return null;
        }

        const snippet = vInfo?.snippet || item.snippet;
        const title = snippet?.title || rawTitle || 'KAIRO RECORDS Release';

        // Real video publication date: vInfo publishedAt is video release date, contentDetails is fallback
        const publishedAt = snippet?.publishedAt || item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || '';

        const thumbs = snippet?.thumbnails || item.snippet?.thumbnails || {};
        const thumbnail =
          thumbs.maxres?.url ||
          thumbs.standard?.url ||
          thumbs.high?.url ||
          thumbs.medium?.url ||
          thumbs.default?.url ||
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
      .filter(Boolean);

    // Step 4: Sort public videos newest first by publication date
    videos.sort((a, b) => {
      const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return timeB - timeA;
    });

    const payload = {
      configured: true,
      channelId: KNOWN_CHANNEL_ID,
      channelTitle: 'KAIRO RECORDS',
      channelUrl: 'https://www.youtube.com/@KAIROREC',
      playlistId,
      playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
      videos,
      cachedAt: new Date().toISOString()
    };

    // Cache successful response
    releasesCache = { data: payload, timestamp: now, playlistId };

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
      playlistId,
      videos: []
    }), {
      status: 200, // Return 200 with error property so client gracefully displays fallback UI
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

/**
 * Robustly resolves the official releases playlist ID from Worker environment configuration.
 * Supports PLAYLIST_ID, RELEASES_PLAYLIST_ID, YOUTUBE_PLAYLIST_ID across env bindings and process.env.
 * Defaults to 'PLGcjuTeisA5Q'.
 */
function resolvePlaylistId(env) {
  if (env && typeof env === 'object') {
    if (typeof env.PLAYLIST_ID === 'string' && env.PLAYLIST_ID.trim()) {
      return env.PLAYLIST_ID.trim().replace(/^["']|["']$/g, '');
    }
    if (typeof env.RELEASES_PLAYLIST_ID === 'string' && env.RELEASES_PLAYLIST_ID.trim()) {
      return env.RELEASES_PLAYLIST_ID.trim().replace(/^["']|["']$/g, '');
    }
    if (typeof env.YOUTUBE_PLAYLIST_ID === 'string' && env.YOUTUBE_PLAYLIST_ID.trim()) {
      return env.YOUTUBE_PLAYLIST_ID.trim().replace(/^["']|["']$/g, '');
    }
    for (const key of Object.keys(env)) {
      const upper = key.trim().toUpperCase();
      if (upper === 'PLAYLIST_ID' || upper === 'RELEASES_PLAYLIST_ID' || upper === 'YOUTUBE_PLAYLIST_ID') {
        const val = env[key];
        if (typeof val === 'string' && val.trim()) {
          return val.trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  }

  if (typeof PLAYLIST_ID !== 'undefined' && typeof PLAYLIST_ID === 'string' && PLAYLIST_ID.trim()) {
    return PLAYLIST_ID.trim().replace(/^["']|["']$/g, '');
  }

  if (typeof globalThis !== 'undefined' && globalThis && typeof globalThis.PLAYLIST_ID === 'string' && globalThis.PLAYLIST_ID.trim()) {
    return globalThis.PLAYLIST_ID.trim().replace(/^["']|["']$/g, '');
  }

  if (typeof process !== 'undefined' && process.env) {
    if (typeof process.env.PLAYLIST_ID === 'string' && process.env.PLAYLIST_ID.trim()) {
      return process.env.PLAYLIST_ID.trim().replace(/^["']|["']$/g, '');
    }
    if (typeof process.env.RELEASES_PLAYLIST_ID === 'string' && process.env.RELEASES_PLAYLIST_ID.trim()) {
      return process.env.RELEASES_PLAYLIST_ID.trim().replace(/^["']|["']$/g, '');
    }
    if (typeof process.env.YOUTUBE_PLAYLIST_ID === 'string' && process.env.YOUTUBE_PLAYLIST_ID.trim()) {
      return process.env.YOUTUBE_PLAYLIST_ID.trim().replace(/^["']|["']$/g, '');
    }
  }

  return DEFAULT_PLAYLIST_ID;
}

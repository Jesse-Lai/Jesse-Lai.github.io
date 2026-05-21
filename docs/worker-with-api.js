// Cloudflare Worker — Jesse AI Proxy + Portfolio REST API
// Deploy to: crimson-waterfall-c16b.laijianxun123.workers.dev

// Portfolio content (embedded from content.json)
const CONTENT = PORTFOLIO_DATA; // Will be bound as a variable or inlined

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    // ─── Portfolio REST API ───

    // GET /api/about — Jesse's intro
    if (path === '/api/about' && request.method === 'GET') {
      const about = {
        name: "Jesse Lai",
        title: "AI Product Designer at Microsoft",
        bio: "6+ years designing AI-native experiences — conversational AI, generative UI, and merchant tools across B2C and B2B. Also a stand-up comedian, angler, and basketball player.",
        portfolio_url: "https://highlightttt.github.io/portfolio/",
        contact: { github: "highlightttt" },
        categories: ["who_i_am", "design_projects", "design_thought", "hobby"],
      };
      return Response.json(about, { headers: cors });
    }

    // GET /api/projects — List all projects
    if (path === '/api/projects' && request.method === 'GET') {
      const projects = env.PORTFOLIO_DATA.map(e => ({
        id: e.id,
        title: e.title,
        category: e.category,
        type: e.atom,
        summary: e.body || '',
        has_article: !!(e.focus?.article?.sections?.length),
      }));
      return Response.json({ count: projects.length, projects }, { headers: cors });
    }

    // GET /api/projects/:id — Single project detail
    if (path.startsWith('/api/projects/') && request.method === 'GET') {
      const id = path.replace('/api/projects/', '');
      const project = env.PORTFOLIO_DATA.find(e => e.id === id || slugify(e.title) === id);
      if (!project) {
        return Response.json({ error: 'Project not found' }, { status: 404, headers: cors });
      }
      const sections = (project.focus?.article?.sections || [])
        .filter(s => s.type === 'text' || s.type === 'subtitle')
        .map(s => ({ type: s.type, text: s.text }));
      return Response.json({
        id: project.id,
        title: project.title,
        category: project.category,
        type: project.atom,
        summary: project.body || '',
        article: { title: project.focus?.title || project.title, sections },
      }, { headers: cors });
    }

    // GET /api/search?q=keyword — Search projects
    if (path === '/api/search' && request.method === 'GET') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      if (!q) {
        return Response.json({ error: 'Missing ?q= parameter' }, { status: 400, headers: cors });
      }
      const results = env.PORTFOLIO_DATA.filter(e => {
        const text = [e.title, e.body, e.category, ...(e.focus?.article?.sections || []).map(s => s.text || '')].join(' ').toLowerCase();
        return text.includes(q);
      }).map(e => ({
        id: e.id,
        title: e.title,
        category: e.category,
        summary: e.body || '',
        relevance: e.title.toLowerCase().includes(q) ? 'title_match' : 'content_match',
      }));
      return Response.json({ query: q, count: results.length, results }, { headers: cors });
    }

    // GET /api/schema — API description for agents
    if (path === '/api/schema' && request.method === 'GET') {
      const schema = {
        name: "Jesse Lai Portfolio API",
        description: "REST API to query Jesse Lai's design portfolio. Any AI agent can use this to learn about Jesse's work, projects, and background.",
        base_url: url.origin,
        endpoints: [
          { method: "GET", path: "/api/about", description: "Jesse's bio, role, and contact info" },
          { method: "GET", path: "/api/projects", description: "List all portfolio projects with title, category, and summary" },
          { method: "GET", path: "/api/projects/:id", description: "Get full article content for a specific project. Use project ID or slug (lowercase, hyphenated title)" },
          { method: "GET", path: "/api/search?q=keyword", description: "Search projects by keyword (matches title and content)" },
        ],
        categories: {
          who_i_am: "Personal intro and resume",
          design_projects: "Professional design work",
          design_thought: "Design thinking articles",
          hobby: "Hobbies and personal interests",
        },
        usage_example: "GET /api/search?q=AI → returns all projects related to AI",
        no_auth_required: true,
      };
      return Response.json(schema, { headers: cors });
    }

    // ─── AI Chat Proxy (existing) ───
    if (request.method === 'POST' && (path === '/' || path === '/chat')) {
      const body = await request.json();
      const azureUrl = `https://jesseai.openai.azure.com/openai/deployments/gpt-5.4-mini/chat/completions?api-version=2025-04-01-preview`;

      const resp = await fetch(azureUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': env.AZURE_API_KEY,
        },
        body: JSON.stringify(body),
      });

      return new Response(resp.body, {
        status: resp.status,
        headers: {
          'Content-Type': resp.headers.get('Content-Type') || 'application/json',
          ...cors,
        }
      });
    }

    // Default
    if (request.method === 'GET' && path === '/') {
      return Response.json({
        service: "Jesse Lai Portfolio API + AI Proxy",
        docs: "/api/schema",
        portfolio: "https://highlightttt.github.io/portfolio/",
      }, { headers: cors });
    }

    return new Response('Not found', { status: 404, headers: cors });
  }
};

function slugify(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

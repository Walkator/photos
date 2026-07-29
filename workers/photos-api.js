const ALLOWED_ORIGIN = "https://photos.dniel.me";
const PHOTO_KEY = /^photos\/(street|indoor|outdoor)\/([A-Za-z0-9_-]+)\.jpg$/;

function responseHeaders(headers = {}) {
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "X-Content-Type-Options": "nosniff",
        ...headers,
    };
}

function photoFromObject(object) {
    const match = PHOTO_KEY.exec(object.key);
    if (!match) {
        return null;
    }

    const [, category, name] = match;
    return {
        category,
        name,
        alt: `${category} photograph ${name.replaceAll(/[-_]+/g, " ").trim()}`,
        mediaPath: object.key,
    };
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname !== "/api/photos") {
            return new Response("Not found", { status: 404 });
        }

        if (request.method !== "GET") {
            return new Response("Method not allowed", {
                status: 405,
                headers: { Allow: "GET" },
            });
        }

        if (!env.PHOTOS_BUCKET || !env.PHOTOS_RATE_LIMITER) {
            return new Response("Worker binding missing", { status: 500 });
        }

        const clientIdentifier = request.headers.get("cf-connecting-ip")
            || request.headers.get("origin")
            || "anonymous";
        const { success } = await env.PHOTOS_RATE_LIMITER.limit({
            key: `${clientIdentifier}:${url.pathname}`,
        });

        if (!success) {
            return new Response("Too many requests", {
                status: 429,
                headers: responseHeaders({
                    "Cache-Control": "no-store",
                    "Content-Type": "text/plain; charset=utf-8",
                    "Retry-After": "60",
                }),
            });
        }

        const objects = [];
        let cursor;
        do {
            const page = await env.PHOTOS_BUCKET.list({ prefix: "photos/", cursor });
            objects.push(...page.objects);
            cursor = page.truncated ? page.cursor : undefined;
        } while (cursor);

        const photos = objects.map(photoFromObject).filter(Boolean);
        return new Response(JSON.stringify(photos), {
            headers: responseHeaders({
                "Cache-Control": "public, max-age=60, s-maxage=300",
                "Content-Type": "application/json",
            }),
        });
    },
};

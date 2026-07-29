const CATEGORY_ORDER = ["street", "indoor", "outdoor"];
const PHOTO_KEY = /^photos\/(street|indoor|outdoor)\/([a-z0-9-]+)\.jpg$/;

function slugify(filename) {
    return filename
        .replace(/\.jpg$/i, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function photoFromObject(object) {
    const match = PHOTO_KEY.exec(object.key);
    if (!match) {
        return null;
    }

    const [, category, filename] = match;
    const name = slugify(filename);
    if (!name) {
        return null;
    }

    return {
        category: category.toLowerCase(),
        name,
        alt: `${category.toLowerCase()} photograph ${name.replaceAll("-", " ")}`,
        localSrc: `assets/photos/${category.toLowerCase()}/${name}.jpg`,
        mediaPath: object.key,
    };
}

export async function onRequestGet({ env }) {
    if (!env.PHOTOS_BUCKET || typeof env.PHOTOS_BUCKET.list !== "function") {
        return Response.json(
            { error: "The PHOTOS_BUCKET R2 binding is not configured" },
            { status: 500 },
        );
    }

    const objects = [];
    let cursor;

    do {
        const page = await env.PHOTOS_BUCKET.list({ prefix: "photos/", cursor });
        objects.push(...page.objects);
        cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);

    const photos = objects
        .map(photoFromObject)
        .filter(Boolean)
        .sort((left, right) => {
            const categoryDifference = CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
            return categoryDifference || left.mediaPath.localeCompare(right.mediaPath);
        });

    return Response.json(photos, {
        headers: {
            "Cache-Control": "public, max-age=60, s-maxage=300",
        },
    });
}

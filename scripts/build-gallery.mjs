import { execFileSync } from "node:child_process";
import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";

const siteRoot = new URL("..", import.meta.url).pathname;
const sourceRoot = process.argv[2];

if (!sourceRoot) {
    console.error("Usage: node scripts/build-gallery.mjs /path/to/exported/photos");
    process.exit(1);
}

const categoryOrder = ["street", "cities", "indoor", "outdoor"];
const outputRoot = join(siteRoot, "assets", "photos");
const manifestPath = join(siteRoot, "data", "photos.json");

function collectJpgs(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = join(directory, entry.name);
        if (entry.isDirectory()) {
            return collectJpgs(entryPath);
        }
        return extname(entry.name).toLowerCase() === ".jpg" ? [entryPath] : [];
    });
}

function slugify(filename) {
    return basename(filename, extname(filename))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function assertNoSensitiveMetadata(imagePath) {
    const metadata = execFileSync("sips", ["-g", "all", imagePath], { encoding: "utf8" });
    const sensitiveFields = /^(?:gpsLatitude|gpsLongitude|latitude|longitude|serialNumber|cameraMake|cameraModel|location)\s*:/im;

    if (sensitiveFields.test(metadata)) {
        throw new Error(`Sensitive metadata found in optimized image: ${imagePath}`);
    }
}

const sourceFiles = collectJpgs(sourceRoot).sort((left, right) => {
    const leftCategory = relative(sourceRoot, left).split("/")[0];
    const rightCategory = relative(sourceRoot, right).split("/")[0];
    const categoryDifference = categoryOrder.indexOf(leftCategory) - categoryOrder.indexOf(rightCategory);
    return categoryDifference || left.localeCompare(right);
});

const photos = sourceFiles.map((sourcePath) => {
    const relativePath = relative(sourceRoot, sourcePath);
    const category = relativePath.split("/")[0];
    const name = slugify(sourcePath);
    const destinationDirectory = join(outputRoot, category);
    const destinationPath = join(destinationDirectory, `${name}.jpg`);

    mkdirSync(destinationDirectory, { recursive: true });
    execFileSync("sips", ["-Z", "1800", "-s", "formatOptions", "84", sourcePath, "--out", destinationPath], {
        stdio: "ignore",
    });
    assertNoSensitiveMetadata(destinationPath);

    return {
        category,
        name,
        alt: `${category} photograph ${name.replaceAll("-", " ")}`,
        src: `assets/photos/${category}/${name}.jpg`,
    };
});

mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(photos, null, 2)}\n`);
console.log(`Prepared ${photos.length} web images in ${outputRoot}`);

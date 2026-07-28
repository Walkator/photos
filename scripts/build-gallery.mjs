import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceRoot = process.argv[2] ? resolve(process.argv[2]) : undefined;

if (!sourceRoot) {
    console.error("Usage: node scripts/build-gallery.mjs /path/to/exported/photos");
    process.exit(1);
}

const categoryOrder = ["street", "cities", "indoor", "outdoor"];
const outputRoot = join(siteRoot, "assets", "photos");

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
    const leftCategory = relative(sourceRoot, left).split(sep)[0];
    const rightCategory = relative(sourceRoot, right).split(sep)[0];
    const categoryDifference = categoryOrder.indexOf(leftCategory) - categoryOrder.indexOf(rightCategory);
    return categoryDifference || left.localeCompare(right);
});

const destinations = new Set();

sourceFiles.forEach((sourcePath) => {
    const relativePath = relative(sourceRoot, sourcePath);
    const category = relativePath.split(sep)[0];
    if (!categoryOrder.includes(category)) {
        throw new Error(`Unsupported photo category: ${category}`);
    }

    const name = slugify(sourcePath);
    if (!name) {
        throw new Error(`Could not derive a safe filename from: ${sourcePath}`);
    }

    const destinationDirectory = join(outputRoot, category);
    const destinationPath = join(destinationDirectory, `${name}.jpg`);
    if (destinations.has(destinationPath)) {
        throw new Error(`Duplicate output filename: ${destinationPath}`);
    }
    destinations.add(destinationPath);

    mkdirSync(destinationDirectory, { recursive: true });
    execFileSync("sips", ["-Z", "1800", "-s", "formatOptions", "84", sourcePath, "--out", destinationPath], {
        stdio: "ignore",
    });
    assertNoSensitiveMetadata(destinationPath);
});

console.log(`Prepared ${sourceFiles.length} web images in ${outputRoot}`);

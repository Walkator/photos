const pageRoot = document.querySelector(".gallery-page");
const gallery = document.querySelector("#gallery");
const emptyState = document.querySelector("#empty-state");
const galleryCount = document.querySelector("#gallery-count");
const sectionLabel = document.querySelector("#section-label");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxCaption = document.querySelector("#lightbox-caption");
const lightboxClose = document.querySelector("#lightbox-close");

const sectionTitles = {
    recent: "Recent work",
    street: "Street",
    indoor: "Indoor",
    outdoor: "Outdoor",
};

const currentSection = new URLSearchParams(window.location.search).get("section") || "recent";
const section = Object.hasOwn(sectionTitles, currentSection) ? currentSection : "recent";
const assetRoot = window.location.pathname.startsWith("/recent/") ? "../" : "";
const isLocalPreview = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(window.location.hostname);
const mediaRoot = isLocalPreview ? assetRoot : "https://media.photos.dniel.me/";
const photoApiRoot = isLocalPreview ? assetRoot : "https://photos-api.walkator.workers.dev/";

function isPhotoEntry(photo) {
    return Boolean(
        photo &&
        Object.hasOwn(sectionTitles, photo.category) &&
        typeof photo.name === "string" &&
        typeof photo.alt === "string" &&
        typeof photo.mediaPath === "string" &&
        /^photos\/(street|indoor|outdoor)\/[A-Za-z0-9_-]+\.jpg$/.test(photo.mediaPath),
    );
}

function setNavigation() {
    document.title = `${sectionTitles[section]} — Daniel Aguilar Photography`;
    sectionLabel.textContent = section;
    document.querySelectorAll("[data-section-link]").forEach((link) => {
        if (link.dataset.sectionLink === section) {
            link.setAttribute("aria-current", "page");
        }
    });
}

function createCard(photo) {
    const figure = document.createElement("figure");
    figure.className = "photo-card";

    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `Open ${photo.alt}`);

    const image = document.createElement("img");
    const localPhotoPath = photo.mediaPath.replace(/^photos\//, "assets/photos/");
    image.src = `${mediaRoot}${isLocalPreview ? localPhotoPath : photo.mediaPath}`;
    image.alt = photo.alt;
    image.loading = "lazy";
    image.decoding = "async";

    button.append(image);
    button.addEventListener("click", () => {
        lightboxImage.src = image.src;
        lightboxImage.alt = photo.alt;
        lightboxCaption.textContent = `${photo.category} / ${photo.name}`;
        lightbox.showModal();
    });
    figure.append(button);
    return figure;
}

function closeLightbox() {
    if (lightbox.open) {
        lightbox.close();
    }
}

async function init() {
    setNavigation();
    const response = await fetch(`${photoApiRoot}api/photos`, {
        headers: { Accept: "application/json" },
    });
    if (!response.ok) {
        throw new Error(`Photo API returned ${response.status}`);
    }

    const photos = await response.json();
    if (!Array.isArray(photos)) {
        throw new Error("Photo API returned an invalid payload");
    }

    const validPhotos = photos.filter(isPhotoEntry);
    const sectionPhotos = section === "recent" ? validPhotos : validPhotos.filter((photo) => photo.category === section);
    const visiblePhotos = section === "recent" ? sectionPhotos : sectionPhotos.reverse();

    galleryCount.textContent = `${visiblePhotos.length} photographs`;
    if (visiblePhotos.length === 0) {
        emptyState.hidden = false;
        return;
    }

    gallery.replaceChildren(...visiblePhotos.map(createCard));
}

lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
        closeLightbox();
    }
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeLightbox();
    }
});

init().catch(() => {
    pageRoot.setAttribute("aria-busy", "false");
    galleryCount.textContent = "Gallery unavailable";
    emptyState.hidden = false;
});

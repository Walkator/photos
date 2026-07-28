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
    cities: "Cities",
    indoor: "Indoor",
    outdoor: "Outdoor",
};

const currentSection = new URLSearchParams(window.location.search).get("section") || "recent";
const section = Object.hasOwn(sectionTitles, currentSection) ? currentSection : "recent";
const assetRoot = window.location.pathname.startsWith("/recent/") ? "../" : "";
const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const mediaRoot = isLocalPreview ? assetRoot : "https://media.photos2.dniel.me/";

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
    const mediaPath = photo.src.replace(/^assets\/photos\//, "photos/");
    image.src = `${mediaRoot}${isLocalPreview ? photo.src : mediaPath}`;
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
    const response = await fetch(`${assetRoot}data/photos.json`);
    const photos = await response.json();
    const visiblePhotos = section === "recent" ? photos : photos.filter((photo) => photo.category === section);

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

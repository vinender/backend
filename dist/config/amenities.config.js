"use strict";
/**
 * Amenities Configuration
 * Maps amenity slugs to their display labels and icon URLs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AMENITIES_CONFIG = void 0;
exports.getAmenityBySlug = getAmenityBySlug;
exports.getAmenityIcon = getAmenityIcon;
exports.getAmenityLabel = getAmenityLabel;
exports.normalizeAmenitySlug = normalizeAmenitySlug;
exports.transformAmenities = transformAmenities;
exports.AMENITIES_CONFIG = [
    // Water & Hydration
    {
        slug: 'water-access',
        label: 'Water Access',
        iconUrl: '/add-field/water.svg',
        category: 'hydration'
    },
    {
        slug: 'waterAccess',
        label: 'Water Access',
        iconUrl: '/add-field/water.svg',
        category: 'hydration'
    },
    {
        slug: 'water-bowls',
        label: 'Water Bowls',
        iconUrl: '/field-details/drop.svg',
        category: 'hydration'
    },
    {
        slug: 'waterBowls',
        label: 'Water Bowls',
        iconUrl: '/field-details/drop.svg',
        category: 'hydration'
    },
    {
        slug: 'water-supply',
        label: 'Water Supply',
        iconUrl: '/add-field/water.svg',
        category: 'hydration'
    },
    {
        slug: 'waterSupply',
        label: 'Water Supply',
        iconUrl: '/add-field/water.svg',
        category: 'hydration'
    },
    // Fencing & Security
    {
        slug: 'secure-fencing',
        label: 'Secure Fencing',
        iconUrl: '/field-details/fence.svg',
        category: 'security'
    },
    {
        slug: 'secureFencing',
        label: 'Secure Fencing',
        iconUrl: '/field-details/fence.svg',
        category: 'security'
    },
    {
        slug: 'fencing',
        label: 'Fencing',
        iconUrl: '/field-details/fence.svg',
        category: 'security'
    },
    {
        slug: 'double-gated-entry',
        label: 'Double Gated Entry',
        iconUrl: '/field-details/shield.svg',
        category: 'security'
    },
    {
        slug: 'doubleGatedEntry',
        label: 'Double Gated Entry',
        iconUrl: '/field-details/shield.svg',
        category: 'security'
    },
    {
        slug: 'cctv',
        label: 'CCTV',
        iconUrl: '/add-field/cctv.svg',
        category: 'security'
    },
    // Shelter & Shade
    {
        slug: 'shelter',
        label: 'Shelter',
        iconUrl: '/add-field/shelter.svg',
        category: 'comfort'
    },
    {
        slug: 'shelter-or-shade',
        label: 'Shelter or Shade',
        iconUrl: '/add-field/shelter.svg',
        category: 'comfort'
    },
    {
        slug: 'shelterOrShade',
        label: 'Shelter or Shade',
        iconUrl: '/add-field/shelter.svg',
        category: 'comfort'
    },
    {
        slug: 'shade-trees',
        label: 'Shade Trees',
        iconUrl: '/add-field/tree.svg',
        category: 'comfort'
    },
    {
        slug: 'shadeTrees',
        label: 'Shade Trees',
        iconUrl: '/add-field/tree.svg',
        category: 'comfort'
    },
    {
        slug: 'trees',
        label: 'Trees',
        iconUrl: '/add-field/tree.svg',
        category: 'comfort'
    },
    // Activities & Equipment
    {
        slug: 'agility-equipment',
        label: 'Agility Equipment',
        iconUrl: '/add-field/dog-agility.svg',
        category: 'activities'
    },
    {
        slug: 'agilityEquipment',
        label: 'Agility Equipment',
        iconUrl: '/add-field/dog-agility.svg',
        category: 'activities'
    },
    {
        slug: 'dogAgility',
        label: 'Dog Agility',
        iconUrl: '/add-field/dog-agility.svg',
        category: 'activities'
    },
    {
        slug: 'dog-agility',
        label: 'Dog Agility',
        iconUrl: '/add-field/dog-agility.svg',
        category: 'activities'
    },
    {
        slug: 'agility-course',
        label: 'Agility Course',
        iconUrl: '/add-field/dog-agility.svg',
        category: 'activities'
    },
    {
        slug: 'agilityCourse',
        label: 'Agility Course',
        iconUrl: '/add-field/dog-agility.svg',
        category: 'activities'
    },
    {
        slug: 'dog-play-equipment',
        label: 'Dog Play Equipment',
        iconUrl: '/add-field/dog-play.svg',
        category: 'activities'
    },
    {
        slug: 'dogPlayEquipment',
        label: 'Dog Play Equipment',
        iconUrl: '/add-field/dog-play.svg',
        category: 'activities'
    },
    {
        slug: 'swimming-area',
        label: 'Swimming Area',
        iconUrl: '/add-field/swimming.svg',
        category: 'activities'
    },
    {
        slug: 'swimmingArea',
        label: 'Swimming Area',
        iconUrl: '/add-field/swimming.svg',
        category: 'activities'
    },
    {
        slug: 'swimming-pool',
        label: 'Swimming Pool',
        iconUrl: '/add-field/swimming.svg',
        category: 'activities'
    },
    {
        slug: 'swimmingPool',
        label: 'Swimming Pool',
        iconUrl: '/add-field/swimming.svg',
        category: 'activities'
    },
    // Waste Management
    {
        slug: 'waste-disposal',
        label: 'Waste Disposal',
        iconUrl: '/field-details/bin.svg',
        category: 'facilities'
    },
    {
        slug: 'wasteDisposal',
        label: 'Waste Disposal',
        iconUrl: '/field-details/bin.svg',
        category: 'facilities'
    },
    {
        slug: 'toilet',
        label: 'Toilet',
        iconUrl: '/field-details/bin.svg',
        category: 'facilities'
    },
    {
        slug: 'poop-bags',
        label: 'Poop Bags',
        iconUrl: '/field-details/bin.svg',
        category: 'facilities'
    },
    {
        slug: 'poopBags',
        label: 'Poop Bags',
        iconUrl: '/field-details/bin.svg',
        category: 'facilities'
    },
    {
        slug: 'waste-bins',
        label: 'Waste Bins',
        iconUrl: '/field-details/bin.svg',
        category: 'facilities'
    },
    {
        slug: 'wasteBins',
        label: 'Waste Bins',
        iconUrl: '/field-details/bin.svg',
        category: 'facilities'
    },
    // Facilities
    {
        slug: 'parking',
        label: 'Parking',
        iconUrl: '/field-details/home.svg',
        category: 'facilities'
    },
    {
        slug: 'parking-available',
        label: 'Parking Available',
        iconUrl: '/field-details/home.svg',
        category: 'facilities'
    },
    {
        slug: 'parkingAvailable',
        label: 'Parking Available',
        iconUrl: '/field-details/home.svg',
        category: 'facilities'
    },
    {
        slug: 'restrooms',
        label: 'Restrooms',
        iconUrl: '/field-details/home.svg',
        category: 'facilities'
    },
    {
        slug: 'benches-seating',
        label: 'Benches/Seating',
        iconUrl: '/field-details/home.svg',
        category: 'facilities'
    },
    {
        slug: 'benchesSeating',
        label: 'Benches/Seating',
        iconUrl: '/field-details/home.svg',
        category: 'facilities'
    },
    // Dog Areas
    {
        slug: 'separate-small-dog-area',
        label: 'Separate Small Dog Area',
        iconUrl: '/field-details/pet.svg',
        category: 'dog-areas'
    },
    {
        slug: 'separateSmallDogArea',
        label: 'Separate Small Dog Area',
        iconUrl: '/field-details/pet.svg',
        category: 'dog-areas'
    },
    {
        slug: 'separate-large-dog-area',
        label: 'Separate Large Dog Area',
        iconUrl: '/field-details/pet.svg',
        category: 'dog-areas'
    },
    {
        slug: 'separateLargeDogArea',
        label: 'Separate Large Dog Area',
        iconUrl: '/field-details/pet.svg',
        category: 'dog-areas'
    },
    {
        slug: 'off-leash-area',
        label: 'Off Leash Area',
        iconUrl: '/field-details/pet.svg',
        category: 'dog-areas'
    },
    {
        slug: 'offLeashArea',
        label: 'Off Leash Area',
        iconUrl: '/field-details/pet.svg',
        category: 'dog-areas'
    },
    {
        slug: 'on-leash-area',
        label: 'On Leash Area',
        iconUrl: '/field-details/pet.svg',
        category: 'dog-areas'
    },
    {
        slug: 'onLeashArea',
        label: 'On Leash Area',
        iconUrl: '/field-details/pet.svg',
        category: 'dog-areas'
    },
    {
        slug: 'training-area',
        label: 'Training Area',
        iconUrl: '/field-details/pet.svg',
        category: 'dog-areas'
    },
    {
        slug: 'trainingArea',
        label: 'Training Area',
        iconUrl: '/field-details/pet.svg',
        category: 'dog-areas'
    },
    // Services
    {
        slug: 'on-site-supervision',
        label: 'On-Site Supervision',
        iconUrl: '/field-details/user.svg',
        category: 'services'
    },
    {
        slug: 'onSiteSupervision',
        label: 'On-Site Supervision',
        iconUrl: '/field-details/user.svg',
        category: 'services'
    },
    {
        slug: 'first-aid-kit',
        label: 'First Aid Kit',
        iconUrl: '/field-details/shield.svg',
        category: 'services'
    },
    {
        slug: 'firstAidKit',
        label: 'First Aid Kit',
        iconUrl: '/field-details/shield.svg',
        category: 'services'
    },
    {
        slug: 'dog-wash-station',
        label: 'Dog Wash Station',
        iconUrl: '/field-details/drop.svg',
        category: 'services'
    },
    {
        slug: 'dogWashStation',
        label: 'Dog Wash Station',
        iconUrl: '/field-details/drop.svg',
        category: 'services'
    },
    // Other Amenities
    {
        slug: 'picnic-area',
        label: 'Picnic Area',
        iconUrl: '/field-details/home.svg',
        category: 'other'
    },
    {
        slug: 'picnicArea',
        label: 'Picnic Area',
        iconUrl: '/field-details/home.svg',
        category: 'other'
    },
    {
        slug: 'wifi',
        label: 'WiFi',
        iconUrl: '/field-details/home.svg',
        category: 'other'
    },
    {
        slug: 'food-and-drinks',
        label: 'Food and Drinks',
        iconUrl: '/field-details/home.svg',
        category: 'other'
    },
    {
        slug: 'foodAndDrinks',
        label: 'Food and Drinks',
        iconUrl: '/field-details/home.svg',
        category: 'other'
    },
    {
        slug: 'toys',
        label: 'Toys',
        iconUrl: '/add-field/dog-play.svg',
        category: 'other'
    },
    {
        slug: 'treats',
        label: 'Treats',
        iconUrl: '/field-details/pet.svg',
        category: 'other'
    },
    {
        slug: 'night-lighting',
        label: 'Night Lighting',
        iconUrl: '/add-field/clock.svg',
        category: 'other'
    },
    {
        slug: 'nightLighting',
        label: 'Night Lighting',
        iconUrl: '/add-field/clock.svg',
        category: 'other'
    }
];
/**
 * Get amenity configuration by slug
 */
function getAmenityBySlug(slug) {
    if (!slug)
        return undefined;
    // Normalize slug for lookup
    const normalizedSlug = normalizeAmenitySlug(slug);
    return exports.AMENITIES_CONFIG.find(amenity => amenity.slug === slug ||
        amenity.slug === normalizedSlug ||
        amenity.slug.replace(/-/g, '') === normalizedSlug.replace(/-/g, ''));
}
/**
 * Get amenity icon URL by slug
 */
function getAmenityIcon(slug, defaultIcon = '/field-details/shield.svg') {
    const amenity = getAmenityBySlug(slug);
    return amenity?.iconUrl || defaultIcon;
}
/**
 * Get amenity label by slug
 */
function getAmenityLabel(slug) {
    const amenity = getAmenityBySlug(slug);
    if (amenity)
        return amenity.label;
    // Fallback: format the slug
    return slug
        .replace(/[-_]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, char => char.toUpperCase());
}
/**
 * Normalize amenity slug for consistent lookup
 */
function normalizeAmenitySlug(slug) {
    if (!slug)
        return '';
    return slug
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/_/g, '-');
}
/**
 * Transform amenities array to include icon URLs and labels
 */
function transformAmenities(amenities) {
    if (!Array.isArray(amenities))
        return [];
    return amenities
        .filter(amenity => amenity)
        .map(amenity => {
        const config = getAmenityBySlug(amenity);
        return {
            label: config?.label || getAmenityLabel(amenity),
            iconUrl: config?.iconUrl || '/field-details/shield.svg'
        };
    });
}

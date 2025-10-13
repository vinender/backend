"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformAmenitiesToObjects = transformAmenitiesToObjects;
exports.enrichFieldWithAmenities = enrichFieldWithAmenities;
exports.enrichFieldsWithAmenities = enrichFieldsWithAmenities;
const database_1 = __importDefault(require("../config/database"));
/**
 * Transform amenity names to full amenity objects with id, label, value, and icon
 * @param amenityNames - Array of amenity names (e.g., ["dogAgility", "toilet"])
 * @returns Array of amenity objects with id, value, label, and icon
 */
async function transformAmenitiesToObjects(amenityNames) {
    if (!amenityNames || amenityNames.length === 0) {
        return [];
    }
    try {
        // Fetch all amenities from database that match the names
        const amenities = await database_1.default.amenity.findMany({
            where: {
                name: {
                    in: amenityNames,
                },
            },
            select: {
                id: true,
                name: true,
                icon: true,
            },
        });
        // Create a map for quick lookup
        const amenityMap = new Map(amenities.map((amenity) => [amenity.name, amenity]));
        // Transform the amenity names to objects, maintaining order
        const transformedAmenities = amenityNames
            .map((name) => {
            const amenity = amenityMap.get(name);
            if (amenity) {
                return {
                    id: amenity.id,
                    value: amenity.name,
                    label: formatAmenityLabel(amenity.name),
                    icon: amenity.icon,
                };
            }
            // If amenity not found in database, return a default object
            return {
                id: '',
                value: name,
                label: formatAmenityLabel(name),
                icon: null,
            };
        })
            .filter((amenity) => amenity.id !== ''); // Filter out amenities not found in DB
        return transformedAmenities;
    }
    catch (error) {
        console.error('Error transforming amenities:', error);
        // Return empty array on error to prevent API breakage
        return [];
    }
}
/**
 * Format camelCase amenity names to readable labels
 * @param name - Amenity name in camelCase (e.g., "dogAgility")
 * @returns Formatted label (e.g., "Dog Agility")
 */
function formatAmenityLabel(name) {
    // Handle special cases
    const specialCases = {
        toilet: 'Toilet',
        dogAgility: 'Dog Agility',
        waterBowls: 'Water Bowls',
        parkingSpace: 'Parking Space',
        // Add more as needed
    };
    if (specialCases[name]) {
        return specialCases[name];
    }
    // Convert camelCase to Title Case
    return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
}
/**
 * Transform a single field object to include full amenity objects
 * @param field - Field object with amenities as string array
 * @returns Field object with transformed amenities
 */
async function enrichFieldWithAmenities(field) {
    if (!field)
        return field;
    const amenities = field.amenities || [];
    const transformedAmenities = await transformAmenitiesToObjects(amenities);
    return {
        ...field,
        amenities: transformedAmenities,
    };
}
/**
 * Transform multiple field objects to include full amenity objects
 * @param fields - Array of field objects with amenities as string arrays
 * @returns Array of field objects with transformed amenities
 */
async function enrichFieldsWithAmenities(fields) {
    if (!fields || fields.length === 0)
        return fields;
    // Get all unique amenity names from all fields
    const allAmenityNames = new Set();
    fields.forEach((field) => {
        if (field.amenities && Array.isArray(field.amenities)) {
            field.amenities.forEach((name) => allAmenityNames.add(name));
        }
    });
    // Fetch all amenities at once for better performance
    const amenities = await database_1.default.amenity.findMany({
        where: {
            name: {
                in: Array.from(allAmenityNames),
            },
        },
        select: {
            id: true,
            name: true,
            icon: true,
        },
    });
    // Create a map for quick lookup
    const amenityMap = new Map(amenities.map((amenity) => [
        amenity.name,
        {
            id: amenity.id,
            value: amenity.name,
            label: formatAmenityLabel(amenity.name),
            icon: amenity.icon,
        },
    ]));
    // Transform all fields
    return fields.map((field) => {
        if (!field.amenities || !Array.isArray(field.amenities)) {
            return {
                ...field,
                amenities: [],
            };
        }
        const transformedAmenities = field.amenities
            .map((name) => amenityMap.get(name))
            .filter((amenity) => amenity !== undefined);
        return {
            ...field,
            amenities: transformedAmenities,
        };
    });
}

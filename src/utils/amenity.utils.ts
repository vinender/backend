import prisma from '../config/database';

interface AmenityObject {
  label: string;
  value: string;
}

/**
 * Transform amenity names to full amenity objects with id, label, value, and icon
 * @param amenityNames - Array of amenity names (e.g., ["dogAgility", "toilet"])
 * @returns Array of amenity objects with id, value, label, and icon
 */
export async function transformAmenitiesToObjects(
  amenityNames: string[]
): Promise<AmenityObject[]> {
  if (!amenityNames || amenityNames.length === 0) {
    return [];
  }

  try {
    // Fetch all amenities from database that match the names
    const amenities = await prisma.amenity.findMany({
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
    const amenityMap = new Map(
      amenities.map((amenity) => [amenity.name, amenity])
    );

    // Transform the amenity names to objects, maintaining order - only label and value
    const transformedAmenities: AmenityObject[] = amenityNames
      .map((name) => {
        const amenity = amenityMap.get(name);
        if (amenity) {
          return {
            label: formatAmenityLabel(amenity.name),
            value: amenity.name,
          };
        }
        // If amenity not found in database, return a default object
        return {
          label: formatAmenityLabel(name),
          value: name,
        };
      });

    return transformedAmenities;
  } catch (error) {
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
function formatAmenityLabel(name: string): string {
  // Handle special cases
  const specialCases: Record<string, string> = {
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
export async function enrichFieldWithAmenities(field: any): Promise<any> {
  if (!field) return field;

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
export async function enrichFieldsWithAmenities(fields: any[]): Promise<any[]> {
  if (!fields || fields.length === 0) return fields;

  // Get all unique amenity names from all fields
  const allAmenityNames = new Set<string>();
  fields.forEach((field) => {
    if (field.amenities && Array.isArray(field.amenities)) {
      field.amenities.forEach((name: string) => allAmenityNames.add(name));
    }
  });

  // Fetch all amenities at once for better performance
  const amenities = await prisma.amenity.findMany({
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

  // Create a map for quick lookup - only label and value for field cards
  const amenityMap = new Map(
    amenities.map((amenity) => [
      amenity.name,
      {
        label: formatAmenityLabel(amenity.name),
        value: amenity.name,
      },
    ])
  );

  // Transform all fields
  return fields.map((field) => {
    if (!field.amenities || !Array.isArray(field.amenities)) {
      return {
        ...field,
        amenities: [],
      };
    }

    const transformedAmenities = field.amenities
      .map((name: string) => amenityMap.get(name))
      .filter((amenity: any) => amenity !== undefined);

    return {
      ...field,
      amenities: transformedAmenities,
    };
  });
}

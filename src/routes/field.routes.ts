import { Router } from "express"
import { prisma } from "../app"

const router = Router()

// Get all fields with filters
router.get("/", async (req, res) => {
  try {
    const { city, state, minPrice, maxPrice, size, type, isActive } = req.query

    const where: any = {}
    
    if (city) where.city = { contains: city as string, mode: "insensitive" }
    if (state) where.state = { contains: state as string, mode: "insensitive" }
    if (size) where.size = size
    if (type) where.type = type
    if (isActive !== undefined) where.isActive = isActive === "true"
    
    if (minPrice || maxPrice) {
      where.pricePerHour = {}
      if (minPrice) where.pricePerHour.gte = parseFloat(minPrice as string)
      if (maxPrice) where.pricePerHour.lte = parseFloat(maxPrice as string)
    }

    const fields = await prisma.field.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        _count: {
          select: {
            bookings: true,
            reviews: true,
          }
        }
      }
    })

    res.json(fields)
  } catch (error) {
    console.error("Error fetching fields:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Get field by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params
    
    const field = await prisma.field.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          }
        },
        availability: {
          where: {
            date: {
              gte: new Date()
            }
          },
          orderBy: {
            date: "asc"
          }
        },
        _count: {
          select: {
            bookings: true,
            reviews: true,
          }
        }
      }
    })

    if (!field) {
      return res.status(404).json({ message: "Field not found" })
    }

    res.json(field)
  } catch (error) {
    console.error("Error fetching field:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Create new field
router.post("/", async (req, res) => {
  try {
    const {
      name,
      description,
      address,
      city,
      state,
      zipCode,
      country,
      latitude,
      longitude,
      ownerId,
      type,
      size,
      pricePerHour,
      pricePerDay,
      amenities,
      rules,
      images,
      maxDogs,
      openingTime,
      closingTime,
      operatingDays,
      instantBooking,
      cancellationPolicy,
    } = req.body

    const field = await prisma.field.create({
      data: {
        name,
        description,
        address,
        city,
        state,
        zipCode,
        country: country || "US",
        latitude,
        longitude,
        ownerId,
        type: type || "PRIVATE",
        size,
        pricePerHour,
        pricePerDay,
        amenities: amenities || [],
        rules: rules || [],
        images: images || [],
        maxDogs: maxDogs || 10,
        openingTime,
        closingTime,
        operatingDays: operatingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        instantBooking: instantBooking || false,
        cancellationPolicy,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    })

    res.status(201).json(field)
  } catch (error) {
    console.error("Error creating field:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Update field
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params
    const updateData = { ...req.body }
    delete updateData.id
    delete updateData.ownerId // Prevent changing owner

    const field = await prisma.field.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    })

    res.json(field)
  } catch (error) {
    console.error("Error updating field:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Delete field (soft delete - just set isActive to false)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params

    await prisma.field.update({
      where: { id },
      data: { isActive: false }
    })

    res.json({ message: "Field deleted successfully" })
  } catch (error) {
    console.error("Error deleting field:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

export default router
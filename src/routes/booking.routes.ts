import { Router } from "express"
import { prisma } from "../app"

const router = Router()

// Get all bookings with filters
router.get("/", async (req, res) => {
  try {
    const { userId, fieldId, status, date } = req.query

    const where: any = {}
    
    if (userId) where.userId = userId
    if (fieldId) where.fieldId = fieldId
    if (status) where.status = status
    if (date) where.date = new Date(date as string)

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        field: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            pricePerHour: true,
          }
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            paymentMethod: true,
          }
        }
      },
      orderBy: {
        date: "desc"
      }
    })

    res.json(bookings)
  } catch (error) {
    console.error("Error fetching bookings:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Get booking by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params
    
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        field: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              }
            }
          }
        },
        payment: true,
        review: true,
      }
    })

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" })
    }

    res.json(booking)
  } catch (error) {
    console.error("Error fetching booking:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Create new booking
router.post("/", async (req, res) => {
  try {
    const {
      userId,
      fieldId,
      date,
      startTime,
      endTime,
      numberOfDogs,
      notes,
    } = req.body

    // Check field availability
    const field = await prisma.field.findUnique({
      where: { id: fieldId },
      include: {
        bookings: {
          where: {
            date: new Date(date),
            status: {
              in: ["PENDING", "CONFIRMED"]
            }
          }
        }
      }
    })

    if (!field) {
      return res.status(404).json({ message: "Field not found" })
    }

    // Check for conflicts
    const hasConflict = field.bookings.some(booking => {
      return (
        (startTime >= booking.startTime && startTime < booking.endTime) ||
        (endTime > booking.startTime && endTime <= booking.endTime) ||
        (startTime <= booking.startTime && endTime >= booking.endTime)
      )
    })

    if (hasConflict) {
      return res.status(400).json({ message: "Time slot not available" })
    }

    // Calculate total price
    const startHour = parseInt(startTime.split(":")[0])
    const endHour = parseInt(endTime.split(":")[0])
    const hours = endHour - startHour
    const totalPrice = hours * field.pricePerHour

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        userId,
        fieldId,
        date: new Date(date),
        startTime,
        endTime,
        numberOfDogs: numberOfDogs || 1,
        totalPrice,
        notes,
        status: field.instantBooking ? "CONFIRMED" : "PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        field: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
          }
        }
      }
    })

    res.status(201).json(booking)
  } catch (error) {
    console.error("Error creating booking:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Update booking status
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params
    const { status, cancellationReason } = req.body

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        status,
        cancellationReason: status === "CANCELLED" ? cancellationReason : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        field: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    res.json(booking)
  } catch (error) {
    console.error("Error updating booking:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Delete booking
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params

    await prisma.booking.delete({
      where: { id }
    })

    res.json({ message: "Booking deleted successfully" })
  } catch (error) {
    console.error("Error deleting booking:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

export default router
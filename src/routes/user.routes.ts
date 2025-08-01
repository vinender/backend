import { Router } from "express"
import { prisma } from "../app"

const router = Router()

// Get all users (admin only - add auth middleware later)
router.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      }
    })
    res.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Get user by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        bio: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        ownedFields: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            pricePerHour: true,
            isActive: true,
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

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json(user)
  } catch (error) {
    console.error("Error fetching user:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

// Update user profile
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { name, phone, bio, image } = req.body

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        phone,
        bio,
        image,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        bio: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    res.json(updatedUser)
  } catch (error) {
    console.error("Error updating user:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

export default router
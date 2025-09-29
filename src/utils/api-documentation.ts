export const apiDocumentation = {
  title: "Fieldsy API Documentation",
  version: "1.0.0",
  description: "Complete API reference for Fieldsy platform",
  baseUrl: process.env.NODE_ENV === 'production' ? 'https://api.fieldsy.indiitserver.in' : 'http://localhost:5000',
  
  categories: [
    {
      name: "Authentication",
      description: "User authentication and authorization endpoints",
      endpoints: [
        {
          method: "POST",
          path: "/api/auth/register",
          description: "Register a new user account",
          authentication: false,
          requestBody: {
            email: "user@example.com",
            password: "Password123!",
            fullName: "John Doe",
            phoneNumber: "+1234567890",
            role: "DOG_OWNER | FIELD_OWNER"
          },
          responses: {
            success: {
              status: 201,
              body: {
                success: true,
                message: "User registered successfully",
                data: {
                  user: {
                    id: "user_id",
                    email: "user@example.com",
                    fullName: "John Doe",
                    role: "DOG_OWNER"
                  },
                  token: "jwt_token",
                  refreshToken: "refresh_token"
                }
              }
            },
            error: {
              status: 400,
              body: {
                success: false,
                message: "Email already exists"
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/auth/login",
          description: "Login with email and password",
          authentication: false,
          requestBody: {
            email: "user@example.com",
            password: "Password123!"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Login successful",
                data: {
                  user: {
                    id: "user_id",
                    email: "user@example.com",
                    fullName: "John Doe",
                    role: "DOG_OWNER"
                  },
                  token: "jwt_token",
                  refreshToken: "refresh_token"
                }
              }
            },
            error: {
              status: 401,
              body: {
                success: false,
                message: "Invalid credentials"
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/auth/refresh-token",
          description: "Refresh JWT token using refresh token",
          authentication: false,
          requestBody: {
            refreshToken: "refresh_token_here"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  token: "new_jwt_token",
                  refreshToken: "new_refresh_token"
                }
              }
            },
            error: {
              status: 401,
              body: {
                success: false,
                message: "Invalid refresh token"
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/auth/social-login",
          description: "Login using social providers (Google, Facebook)",
          authentication: false,
          requestBody: {
            provider: "google | facebook",
            token: "social_provider_token",
            role: "DOG_OWNER | FIELD_OWNER"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  user: {},
                  token: "jwt_token",
                  refreshToken: "refresh_token"
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/auth/test",
          description: "Test auth routes connectivity",
          authentication: false,
          responses: {
            success: {
              status: 200,
              body: {
                message: "Auth routes working"
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/auth/me",
          description: "Get current user profile",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  user: {
                    id: "user_id",
                    email: "user@example.com",
                    fullName: "John Doe",
                    role: "DOG_OWNER",
                    phoneNumber: "+1234567890"
                  }
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/auth/logout",
          description: "Logout current user",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Logged out successfully"
              }
            }
          }
        },
        {
          method: "PATCH",
          path: "/api/auth/update-role",
          description: "Update user role",
          authentication: true,
          requestBody: {
            role: "DOG_OWNER | FIELD_OWNER"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Role updated successfully",
                data: {
                  user: {
                    role: "FIELD_OWNER"
                  }
                }
              }
            }
          }
        }
      ]
    },
    {
      name: "OTP Authentication",
      description: "OTP-based authentication for mobile apps",
      endpoints: [
        {
          method: "POST",
          path: "/api/auth/otp/register",
          description: "Register with phone number and OTP",
          authentication: false,
          requestBody: {
            phoneNumber: "+1234567890",
            fullName: "John Doe",
            role: "DOG_OWNER | FIELD_OWNER"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "OTP sent successfully",
                data: {
                  userId: "temp_user_id"
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/auth/otp/verify-signup",
          description: "Verify OTP for registration",
          authentication: false,
          requestBody: {
            phoneNumber: "+1234567890",
            otp: "123456",
            userId: "temp_user_id"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  user: {},
                  token: "jwt_token",
                  refreshToken: "refresh_token"
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/auth/otp/login",
          description: "Login with phone number",
          authentication: false,
          requestBody: {
            phoneNumber: "+1234567890"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "OTP sent successfully"
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/auth/otp/resend-otp",
          description: "Resend OTP code",
          authentication: false,
          requestBody: {
            phoneNumber: "+1234567890"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "OTP resent successfully"
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/auth/otp/forgot-password",
          description: "Request password reset OTP",
          authentication: false,
          requestBody: {
            phoneNumber: "+1234567890"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Reset OTP sent"
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/auth/otp/verify-reset-otp",
          description: "Verify reset password OTP",
          authentication: false,
          requestBody: {
            phoneNumber: "+1234567890",
            otp: "123456"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  resetToken: "reset_token"
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/auth/otp/reset-password",
          description: "Reset password with token",
          authentication: false,
          requestBody: {
            resetToken: "reset_token",
            newPassword: "NewPassword123!"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Password reset successfully"
              }
            }
          }
        }
      ]
    },
    {
      name: "Users",
      description: "User management endpoints",
      endpoints: [
        {
          method: "GET",
          path: "/api/users",
          description: "Get all users (Admin only)",
          authentication: true,
          authorization: "ADMIN",
          queryParams: {
            page: 1,
            limit: 10,
            role: "DOG_OWNER | FIELD_OWNER",
            search: "search_term"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  users: [],
                  totalPages: 1,
                  currentPage: 1,
                  totalUsers: 0
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/users/:id",
          description: "Get user by ID",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  user: {}
                }
              }
            }
          }
        },
        {
          method: "PATCH",
          path: "/api/users/:id",
          description: "Update user profile",
          authentication: true,
          requestBody: {
            fullName: "Updated Name",
            phoneNumber: "+1234567890",
            bio: "User bio"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Profile updated successfully",
                data: {
                  user: {}
                }
              }
            }
          }
        },
        {
          method: "DELETE",
          path: "/api/users/:id",
          description: "Delete user account",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Account deleted successfully"
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/users/stats",
          description: "Get user statistics",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  totalBookings: 0,
                  completedBookings: 0,
                  upcomingBookings: 0,
                  totalSpent: 0
                }
              }
            }
          }
        },
        {
          method: "PATCH",
          path: "/api/users/change-password",
          description: "Change user password",
          authentication: true,
          requestBody: {
            currentPassword: "CurrentPassword123!",
            newPassword: "NewPassword123!"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Password changed successfully"
              }
            }
          }
        }
      ]
    },
    {
      name: "Fields",
      description: "Field management endpoints",
      endpoints: [
        {
          method: "GET",
          path: "/api/fields",
          description: "Get all fields with filters",
          authentication: false,
          queryParams: {
            page: 1,
            limit: 10,
            search: "search_term",
            minPrice: 0,
            maxPrice: 100,
            amenities: "fenced,water",
            latitude: 51.5074,
            longitude: -0.1278,
            radius: 10
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  fields: [],
                  totalPages: 1,
                  currentPage: 1,
                  totalFields: 0
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/fields/:id",
          description: "Get field by ID",
          authentication: false,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  field: {
                    id: "field_id",
                    name: "Green Park Field",
                    description: "Beautiful field",
                    price: 25,
                    size: "2 acres",
                    amenities: ["fenced", "water"],
                    images: [],
                    location: {},
                    owner: {}
                  }
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/fields",
          description: "Create new field",
          authentication: true,
          authorization: "FIELD_OWNER",
          requestBody: {
            name: "My Field",
            description: "Field description",
            price: 25,
            size: "2 acres",
            amenities: ["fenced", "water"],
            images: ["image_url"],
            location: {
              address: "123 Main St",
              latitude: 51.5074,
              longitude: -0.1278
            },
            availability: {
              monday: { isAvailable: true, slots: [] },
              tuesday: { isAvailable: true, slots: [] }
            }
          },
          responses: {
            success: {
              status: 201,
              body: {
                success: true,
                message: "Field created successfully",
                data: {
                  field: {}
                }
              }
            }
          }
        },
        {
          method: "PATCH",
          path: "/api/fields/:id",
          description: "Update field details",
          authentication: true,
          authorization: "FIELD_OWNER",
          requestBody: {
            name: "Updated Field Name",
            price: 30,
            description: "Updated description"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Field updated successfully",
                data: {
                  field: {}
                }
              }
            }
          }
        },
        {
          method: "PATCH",
          path: "/api/fields/:id/toggle-status",
          description: "Toggle field active status",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Field status updated",
                data: {
                  isActive: true
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/fields/suggestions",
          description: "Get field suggestions for autocomplete",
          authentication: false,
          queryParams: {
            query: "search_term"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  suggestions: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/fields/search/location",
          description: "Search fields by location",
          authentication: false,
          queryParams: {
            latitude: 51.5074,
            longitude: -0.1278,
            radius: 10
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  fields: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/fields/unclaimed",
          description: "Get unclaimed fields for field owners",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  fields: []
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/fields/claim-ownership",
          description: "Claim ownership of a field",
          authentication: true,
          authorization: "FIELD_OWNER",
          requestBody: {
            fieldId: "field_id",
            proofDocuments: ["document_url"]
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Claim submitted successfully"
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/fields/owner/field",
          description: "Get field owned by current user",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  field: {}
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/fields/owner/bookings",
          description: "Get bookings for owner's field",
          authentication: true,
          authorization: "FIELD_OWNER",
          queryParams: {
            status: "upcoming | completed | cancelled",
            page: 1,
            limit: 10
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  bookings: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/fields/owner/bookings/recent",
          description: "Get recent bookings for field owner",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  bookings: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/fields/owner/bookings/today",
          description: "Get today's bookings for field owner",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  bookings: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/fields/owner/bookings/upcoming",
          description: "Get upcoming bookings for field owner",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  bookings: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/fields/owner/bookings/previous",
          description: "Get previous bookings for field owner",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  bookings: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/fields/my-fields",
          description: "Get all fields owned by current user",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  fields: []
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/fields/save-progress",
          description: "Save field creation progress",
          authentication: true,
          authorization: "FIELD_OWNER",
          requestBody: {
            step: 1,
            data: {}
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Progress saved"
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/fields/submit-for-review",
          description: "Submit field for admin review",
          authentication: true,
          authorization: "FIELD_OWNER",
          requestBody: {
            fieldId: "field_id"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Field submitted for review"
              }
            }
          }
        }
      ]
    },
    {
      name: "Bookings",
      description: "Booking management endpoints",
      endpoints: [
        {
          method: "GET",
          path: "/api/bookings",
          description: "Get all bookings",
          authentication: true,
          queryParams: {
            page: 1,
            limit: 10,
            status: "upcoming | completed | cancelled"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  bookings: [],
                  totalPages: 1,
                  currentPage: 1
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/bookings/:id",
          description: "Get booking by ID",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  booking: {}
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/bookings",
          description: "Create new booking",
          authentication: true,
          requestBody: {
            fieldId: "field_id",
            date: "2024-03-20",
            startTime: "09:00",
            endTime: "10:00",
            numberOfDogs: 2,
            paymentMethodId: "pm_xxx",
            repeatBooking: "none | weekly | monthly"
          },
          responses: {
            success: {
              status: 201,
              body: {
                success: true,
                message: "Booking created successfully",
                data: {
                  booking: {},
                  paymentIntent: {}
                }
              }
            }
          }
        },
        {
          method: "PATCH",
          path: "/api/bookings/:id/cancel",
          description: "Cancel a booking",
          authentication: true,
          requestBody: {
            reason: "Cancellation reason"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Booking cancelled successfully",
                data: {
                  refundAmount: 25
                }
              }
            }
          }
        },
        {
          method: "PATCH",
          path: "/api/bookings/:id/status",
          description: "Update booking status",
          authentication: true,
          requestBody: {
            status: "confirmed | completed | cancelled"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Status updated successfully"
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/bookings/availability",
          description: "Check field availability",
          authentication: false,
          queryParams: {
            fieldId: "field_id",
            date: "2024-03-20"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  availableSlots: [],
                  bookedSlots: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/bookings/fields/:fieldId/slot-availability",
          description: "Get slot availability for a field",
          authentication: false,
          queryParams: {
            date: "2024-03-20"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  slots: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/bookings/my-bookings",
          description: "Get current user's bookings",
          authentication: true,
          queryParams: {
            status: "upcoming | completed | cancelled",
            page: 1,
            limit: 10
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  bookings: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/bookings/my-recurring",
          description: "Get user's recurring bookings",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  subscriptions: [],
                  recurringBookings: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/bookings/stats",
          description: "Get booking statistics",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  totalBookings: 0,
                  upcomingBookings: 0,
                  completedBookings: 0,
                  totalSpent: 0
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/bookings/:id/refund-eligibility",
          description: "Check refund eligibility",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  eligible: true,
                  refundAmount: 25,
                  reason: "Within cancellation window"
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/bookings/:id/cancel-recurring",
          description: "Cancel recurring booking subscription",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Recurring booking cancelled"
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/bookings/mark-completed",
          description: "Mark bookings as completed (scheduled job)",
          authentication: true,
          authorization: "SYSTEM",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  completedCount: 5
                }
              }
            }
          }
        }
      ]
    },
    {
      name: "Payments",
      description: "Payment processing endpoints",
      endpoints: [
        {
          method: "POST",
          path: "/api/payments/create-payment-intent",
          description: "Create Stripe payment intent",
          authentication: true,
          requestBody: {
            amount: 2500,
            bookingId: "booking_id",
            paymentMethodId: "pm_xxx"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  clientSecret: "pi_xxx_secret_xxx",
                  paymentIntentId: "pi_xxx"
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/payments/confirm-payment",
          description: "Confirm payment after client-side processing",
          authentication: true,
          requestBody: {
            paymentIntentId: "pi_xxx",
            bookingId: "booking_id"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Payment confirmed successfully",
                data: {
                  booking: {},
                  payment: {}
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/payments/payment-methods",
          description: "Get user's saved payment methods",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  paymentMethods: []
                }
              }
            }
          }
        }
      ]
    },
    {
      name: "Payment Methods",
      description: "Manage saved payment methods",
      endpoints: [
        {
          method: "GET",
          path: "/api/payment-methods",
          description: "Get all saved payment methods",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  paymentMethods: [
                    {
                      id: "pm_xxx",
                      brand: "visa",
                      last4: "4242",
                      isDefault: true
                    }
                  ]
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/payment-methods/setup-intent",
          description: "Create setup intent for adding payment method",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  clientSecret: "seti_xxx_secret_xxx"
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/payment-methods/save",
          description: "Save payment method after setup",
          authentication: true,
          requestBody: {
            paymentMethodId: "pm_xxx",
            isDefault: true
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Payment method saved successfully"
              }
            }
          }
        },
        {
          method: "PUT",
          path: "/api/payment-methods/:paymentMethodId/set-default",
          description: "Set payment method as default",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Default payment method updated"
              }
            }
          }
        },
        {
          method: "DELETE",
          path: "/api/payment-methods/:paymentMethodId",
          description: "Delete saved payment method",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Payment method deleted"
              }
            }
          }
        }
      ]
    },
    {
      name: "Stripe Connect",
      description: "Stripe Connect for field owner payouts",
      endpoints: [
        {
          method: "POST",
          path: "/api/stripe-connect/create-account",
          description: "Create Stripe Connect account",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  accountId: "acct_xxx",
                  onboardingUrl: "https://connect.stripe.com/..."
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/stripe-connect/onboarding-link",
          description: "Get Stripe onboarding link",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  url: "https://connect.stripe.com/..."
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/stripe-connect/account-status",
          description: "Get Stripe account status",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  hasAccount: true,
                  isComplete: true,
                  requiresInformation: false,
                  chargesEnabled: true,
                  payoutsEnabled: true
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/stripe-connect/balance",
          description: "Get Stripe account balance",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  available: 10000,
                  pending: 2500,
                  currency: "gbp"
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/stripe-connect/payout-history",
          description: "Get payout history from Stripe",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  payouts: []
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/stripe-connect/payout",
          description: "Request manual payout",
          authentication: true,
          authorization: "FIELD_OWNER",
          requestBody: {
            amount: 5000
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Payout initiated successfully"
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/stripe-connect/update-bank",
          description: "Update bank account details",
          authentication: true,
          authorization: "FIELD_OWNER",
          requestBody: {
            accountNumber: "00012345",
            sortCode: "000000",
            accountHolderName: "John Doe"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Bank account updated"
              }
            }
          }
        },
        {
          method: "DELETE",
          path: "/api/stripe-connect/disconnect",
          description: "Disconnect Stripe account",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Account disconnected"
              }
            }
          }
        }
      ]
    },
    {
      name: "Payouts",
      description: "Field owner payout management",
      endpoints: [
        {
          method: "GET",
          path: "/api/payouts/earnings/summary",
          description: "Get earnings summary",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  totalEarnings: 10000,
                  availableBalance: 5000,
                  pendingPayouts: 2500,
                  totalPayouts: 2500
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/payouts/earnings/history",
          description: "Get detailed earnings history",
          authentication: true,
          authorization: "FIELD_OWNER",
          queryParams: {
            page: 1,
            limit: 10,
            startDate: "2024-01-01",
            endDate: "2024-03-31"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  earnings: [],
                  totalPages: 1
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/payouts/history",
          description: "Get payout history",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  payouts: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/payouts/transactions/:transactionId",
          description: "Get specific payout transaction details",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  transaction: {}
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/payouts/process-pending",
          description: "Process pending payouts (Admin)",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  processedCount: 5,
                  totalAmount: 25000
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/payouts/trigger/:bookingId",
          description: "Trigger payout for specific booking",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Payout processed"
              }
            }
          }
        }
      ]
    },
    {
      name: "Auto Payouts",
      description: "Automated payout processing",
      endpoints: [
        {
          method: "GET",
          path: "/api/auto-payouts/summary",
          description: "Get auto-payout summary",
          authentication: true,
          authorization: "FIELD_OWNER,ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  pendingPayouts: [],
                  processedToday: 0,
                  nextRunTime: "2024-03-20T00:00:00Z"
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/auto-payouts/trigger",
          description: "Manually trigger auto-payout processing",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  processed: 10,
                  failed: 0
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/auto-payouts/process/:bookingId",
          description: "Process payout for specific booking",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Payout processed successfully"
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/auto-payouts/refund/:bookingId",
          description: "Process refund with fees",
          authentication: true,
          requestBody: {
            reason: "Customer requested"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  refundAmount: 2250,
                  platformFeeRefunded: 250
                }
              }
            }
          }
        }
      ]
    },
    {
      name: "Earnings",
      description: "Field owner earnings tracking",
      endpoints: [
        {
          method: "GET",
          path: "/api/earnings/dashboard",
          description: "Get earnings dashboard data",
          authentication: true,
          authorization: "FIELD_OWNER",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  totalEarnings: 10000,
                  thisMonth: 2500,
                  lastMonth: 3000,
                  pending: 500
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/earnings/payout-history",
          description: "Get detailed payout history",
          authentication: true,
          authorization: "FIELD_OWNER",
          queryParams: {
            page: 1,
            limit: 10
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  history: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/earnings/export",
          description: "Export earnings data",
          authentication: true,
          authorization: "FIELD_OWNER",
          queryParams: {
            format: "csv | pdf",
            startDate: "2024-01-01",
            endDate: "2024-03-31"
          },
          responses: {
            success: {
              status: 200,
              body: "File download"
            }
          }
        }
      ]
    },
    {
      name: "Reviews",
      description: "Review and rating system",
      endpoints: [
        {
          method: "GET",
          path: "/api/reviews/user/:userId",
          description: "Get reviews for a user",
          authentication: false,
          queryParams: {
            page: 1,
            limit: 10,
            type: "received | given"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  reviews: [],
                  averageRating: 4.5,
                  totalReviews: 10
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/reviews/:reviewId/helpful",
          description: "Mark review as helpful",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Review marked as helpful"
              }
            }
          }
        },
        {
          method: "DELETE",
          path: "/api/reviews/:reviewId",
          description: "Delete a review",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Review deleted"
              }
            }
          }
        }
      ]
    },
    {
      name: "Notifications",
      description: "In-app notification system",
      endpoints: [
        {
          method: "GET",
          path: "/api/notifications",
          description: "Get user notifications",
          authentication: true,
          queryParams: {
            page: 1,
            limit: 20,
            unreadOnly: false
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  notifications: [],
                  unreadCount: 5
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/notifications/unread-count",
          description: "Get unread notification count",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  count: 5
                }
              }
            }
          }
        },
        {
          method: "PATCH",
          path: "/api/notifications/:id/read",
          description: "Mark notification as read",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Notification marked as read"
              }
            }
          }
        },
        {
          method: "PATCH",
          path: "/api/notifications/read-all",
          description: "Mark all notifications as read",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "All notifications marked as read"
              }
            }
          }
        },
        {
          method: "DELETE",
          path: "/api/notifications/:id",
          description: "Delete a notification",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Notification deleted"
              }
            }
          }
        },
        {
          method: "DELETE",
          path: "/api/notifications/clear-all",
          description: "Clear all notifications",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "All notifications cleared"
              }
            }
          }
        }
      ]
    },
    {
      name: "Chat",
      description: "Real-time messaging system",
      endpoints: [
        {
          method: "GET",
          path: "/api/chat/conversations",
          description: "Get user's chat conversations",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  conversations: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/chat/conversations/:conversationId/messages",
          description: "Get messages in a conversation",
          authentication: true,
          queryParams: {
            page: 1,
            limit: 50
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  messages: []
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/chat/conversations",
          description: "Start new conversation",
          authentication: true,
          requestBody: {
            recipientId: "user_id",
            message: "Hello!"
          },
          responses: {
            success: {
              status: 201,
              body: {
                success: true,
                data: {
                  conversation: {},
                  message: {}
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/chat/messages",
          description: "Send message in conversation",
          authentication: true,
          requestBody: {
            conversationId: "conversation_id",
            message: "Message content"
          },
          responses: {
            success: {
              status: 201,
              body: {
                success: true,
                data: {
                  message: {}
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/chat/unread-count",
          description: "Get unread message count",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  count: 3
                }
              }
            }
          }
        },
        {
          method: "DELETE",
          path: "/api/chat/conversations/:conversationId",
          description: "Delete conversation",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Conversation deleted"
              }
            }
          }
        }
      ]
    },
    {
      name: "Favorites",
      description: "Field favorites/saved items",
      endpoints: [
        {
          method: "GET",
          path: "/api/favorites/my-saved-fields",
          description: "Get user's saved fields",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  fields: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/favorites/check/:fieldId",
          description: "Check if field is favorited",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  isFavorited: true
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/favorites/toggle/:fieldId",
          description: "Toggle field favorite status",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  isFavorited: true
                }
              }
            }
          }
        },
        {
          method: "DELETE",
          path: "/api/favorites/:fieldId",
          description: "Remove field from favorites",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Field removed from favorites"
              }
            }
          }
        }
      ]
    },
    {
      name: "Claims",
      description: "Field ownership claims",
      endpoints: [
        {
          method: "GET",
          path: "/api/claims",
          description: "Get all claims",
          authentication: true,
          queryParams: {
            status: "pending | approved | rejected"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  claims: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/claims/:claimId",
          description: "Get claim details",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  claim: {}
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/claims/check-eligibility/:fieldId",
          description: "Check if field can be claimed",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  canClaim: true,
                  reason: null
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/claims/field/:fieldId",
          description: "Get claims for a field",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  claims: []
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/claims/submit",
          description: "Submit ownership claim",
          authentication: true,
          requestBody: {
            fieldId: "field_id",
            documents: ["doc_url"],
            notes: "Additional information"
          },
          responses: {
            success: {
              status: 201,
              body: {
                success: true,
                message: "Claim submitted successfully"
              }
            }
          }
        },
        {
          method: "PATCH",
          path: "/api/claims/:claimId/status",
          description: "Update claim status (Admin)",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            status: "approved | rejected",
            notes: "Admin notes"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Claim status updated"
              }
            }
          }
        }
      ]
    },
    {
      name: "User Reports",
      description: "User reporting and moderation",
      endpoints: [
        {
          method: "GET",
          path: "/api/user-reports/reports",
          description: "Get all user reports (Admin)",
          authentication: true,
          authorization: "ADMIN",
          queryParams: {
            status: "pending | reviewed | resolved"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  reports: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/user-reports/reports/my-reports",
          description: "Get reports submitted by user",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  reports: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/user-reports/reports/:reportId",
          description: "Get report details",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  report: {}
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/user-reports/report",
          description: "Report a user",
          authentication: true,
          requestBody: {
            reportedUserId: "user_id",
            reason: "inappropriate | spam | fraud | other",
            description: "Details of the issue"
          },
          responses: {
            success: {
              status: 201,
              body: {
                success: true,
                message: "Report submitted successfully"
              }
            }
          }
        },
        {
          method: "PUT",
          path: "/api/user-reports/reports/:reportId/status",
          description: "Update report status (Admin)",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            status: "reviewed | resolved",
            adminNotes: "Action taken"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Report status updated"
              }
            }
          }
        }
      ]
    },
    {
      name: "User Blocks",
      description: "User blocking functionality",
      endpoints: [
        {
          method: "GET",
          path: "/api/user-blocks/blocked",
          description: "Get list of blocked users",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  blockedUsers: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/user-blocks/blocked-by",
          description: "Get users who blocked current user",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  blockedBy: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/user-blocks/status/:otherUserId",
          description: "Check block status with another user",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  isBlocked: false,
                  isBlockedBy: false
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/user-blocks/block",
          description: "Block a user",
          authentication: true,
          requestBody: {
            userId: "user_to_block_id"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "User blocked successfully"
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/user-blocks/unblock",
          description: "Unblock a user",
          authentication: true,
          requestBody: {
            userId: "user_to_unblock_id"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "User unblocked successfully"
              }
            }
          }
        }
      ]
    },
    {
      name: "Commission",
      description: "Platform commission management",
      endpoints: [
        {
          method: "GET",
          path: "/api/commission/settings",
          description: "Get commission settings",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  defaultRate: 10,
                  customRates: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/commission/field-owner/:userId",
          description: "Get field owner's commission rate",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  rate: 10,
                  isCustom: false
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/commission/field-owners",
          description: "Get all field owner commission rates",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  fieldOwners: []
                }
              }
            }
          }
        },
        {
          method: "PUT",
          path: "/api/commission/settings",
          description: "Update commission settings (Admin)",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            defaultRate: 12
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Commission settings updated"
              }
            }
          }
        },
        {
          method: "PUT",
          path: "/api/commission/field-owner/:userId",
          description: "Set custom commission for field owner",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            rate: 8
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Custom commission rate set"
              }
            }
          }
        }
      ]
    },
    {
      name: "Settings",
      description: "Platform settings and configuration",
      endpoints: [
        {
          method: "GET",
          path: "/api/settings/public",
          description: "Get public platform settings",
          authentication: false,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  platformName: "Fieldsy",
                  contactEmail: "support@fieldsy.com",
                  socialLinks: {}
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/settings/admin",
          description: "Get admin settings",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  platformFee: 10,
                  payoutReleaseSchedule: "after_cancellation_window",
                  cancellationWindow: 24,
                  emailSettings: {}
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/settings/user",
          description: "Get user settings",
          authentication: true,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  notifications: {
                    email: true,
                    push: true,
                    sms: false
                  }
                }
              }
            }
          }
        },
        {
          method: "PUT",
          path: "/api/settings/admin",
          description: "Update admin settings",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            platformFee: 12,
            payoutReleaseSchedule: "immediate"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Settings updated successfully"
              }
            }
          }
        },
        {
          method: "PUT",
          path: "/api/settings/admin/platform-images",
          description: "Update platform images",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            logo: "image_url",
            favicon: "image_url"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Images updated successfully"
              }
            }
          }
        }
      ]
    },
    {
      name: "FAQs",
      description: "Frequently asked questions management",
      endpoints: [
        {
          method: "GET",
          path: "/api/faqs/public",
          description: "Get public FAQs",
          authentication: false,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  faqs: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/faqs/admin",
          description: "Get all FAQs (Admin)",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  faqs: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/faqs/admin/:id",
          description: "Get FAQ by ID",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  faq: {}
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/faqs/admin",
          description: "Create new FAQ",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            question: "FAQ question",
            answer: "FAQ answer",
            category: "general",
            order: 1,
            isActive: true
          },
          responses: {
            success: {
              status: 201,
              body: {
                success: true,
                message: "FAQ created successfully"
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/faqs/admin/bulk",
          description: "Bulk create/update FAQs",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            faqs: []
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "FAQs updated successfully"
              }
            }
          }
        },
        {
          method: "PUT",
          path: "/api/faqs/admin/:id",
          description: "Update FAQ",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            question: "Updated question",
            answer: "Updated answer"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "FAQ updated successfully"
              }
            }
          }
        },
        {
          method: "PUT",
          path: "/api/faqs/admin/reorder",
          description: "Reorder FAQs",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            order: ["faq_id_1", "faq_id_2"]
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "FAQs reordered successfully"
              }
            }
          }
        },
        {
          method: "DELETE",
          path: "/api/faqs/admin/:id",
          description: "Delete FAQ",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "FAQ deleted successfully"
              }
            }
          }
        }
      ]
    },
    {
      name: "Upload",
      description: "File upload endpoints",
      endpoints: [
        {
          method: "POST",
          path: "/api/upload/direct",
          description: "Upload single file to S3",
          authentication: true,
          requestBody: {
            file: "base64_encoded_file",
            folder: "profile | field | document"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  url: "https://s3.amazonaws.com/..."
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/upload/multiple",
          description: "Upload multiple files",
          authentication: true,
          requestBody: {
            files: ["base64_file1", "base64_file2"],
            folder: "field"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  urls: ["url1", "url2"]
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/upload/admin/direct",
          description: "Admin file upload",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            file: "base64_encoded_file",
            folder: "platform"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  url: "https://s3.amazonaws.com/..."
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/upload/admin/multiple",
          description: "Admin multiple file upload",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            files: [],
            folder: "platform"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  urls: []
                }
              }
            }
          }
        }
      ]
    },
    {
      name: "About Page",
      description: "About page content management",
      endpoints: [
        {
          method: "GET",
          path: "/api/about-page",
          description: "Get about page content",
          authentication: false,
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  content: {}
                }
              }
            }
          }
        },
        {
          method: "PUT",
          path: "/api/about-page",
          description: "Update about page content",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            heroSection: {},
            missionSection: {},
            teamSection: {}
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "About page updated"
              }
            }
          }
        },
        {
          method: "PUT",
          path: "/api/about-page/section/:section",
          description: "Update specific section",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            content: {}
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Section updated"
              }
            }
          }
        }
      ]
    },
    {
      name: "Admin",
      description: "Admin dashboard and management",
      endpoints: [
        {
          method: "POST",
          path: "/api/admin/login",
          description: "Admin login",
          authentication: false,
          requestBody: {
            email: "admin@fieldsy.com",
            password: "AdminPassword123!"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  admin: {},
                  token: "jwt_token"
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/admin/verify",
          description: "Verify admin token",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  isValid: true
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/admin/stats",
          description: "Get platform statistics",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  totalUsers: 100,
                  totalFields: 50,
                  totalBookings: 500,
                  revenue: 25000
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/admin/revenue/total",
          description: "Get total revenue",
          authentication: true,
          authorization: "ADMIN",
          queryParams: {
            startDate: "2024-01-01",
            endDate: "2024-03-31"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  totalRevenue: 25000,
                  platformFees: 2500,
                  payouts: 22500
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/admin/bookings",
          description: "Get all bookings (Admin)",
          authentication: true,
          authorization: "ADMIN",
          queryParams: {
            page: 1,
            limit: 20,
            status: "upcoming | completed | cancelled"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  bookings: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/admin/bookings/:id",
          description: "Get booking details (Admin)",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  booking: {}
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/admin/users",
          description: "Get all users (Admin)",
          authentication: true,
          authorization: "ADMIN",
          queryParams: {
            page: 1,
            limit: 20,
            role: "DOG_OWNER | FIELD_OWNER"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  users: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/admin/users/:id",
          description: "Get user details (Admin)",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  user: {}
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/admin/fields",
          description: "Get all fields (Admin)",
          authentication: true,
          authorization: "ADMIN",
          queryParams: {
            page: 1,
            limit: 20,
            status: "active | inactive | pending"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  fields: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/admin/notifications",
          description: "Get admin notifications",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  notifications: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/admin/payments",
          description: "Get all payments",
          authentication: true,
          authorization: "ADMIN",
          queryParams: {
            page: 1,
            limit: 20
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  payments: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/admin/booking-stats",
          description: "Get booking statistics",
          authentication: true,
          authorization: "ADMIN",
          queryParams: {
            period: "day | week | month | year"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  stats: {}
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/admin/field-utilization",
          description: "Get field utilization data",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  utilization: {}
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/admin/claims",
          description: "Get all field claims",
          authentication: true,
          authorization: "ADMIN",
          queryParams: {
            status: "pending | approved | rejected"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  claims: []
                }
              }
            }
          }
        },
        {
          method: "GET",
          path: "/api/admin/claims/:claimId",
          description: "Get claim details",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  claim: {}
                }
              }
            }
          }
        },
        {
          method: "PATCH",
          path: "/api/admin/claims/:claimId/status",
          description: "Update claim status",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            status: "approved | rejected",
            notes: "Admin notes"
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                message: "Claim status updated"
              }
            }
          }
        },
        {
          method: "PATCH",
          path: "/api/admin/notifications/:id/read",
          description: "Mark admin notification as read",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true
              }
            }
          }
        },
        {
          method: "PATCH",
          path: "/api/admin/notifications/read-all",
          description: "Mark all admin notifications as read",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true
              }
            }
          }
        },
        {
          method: "DELETE",
          path: "/api/admin/notifications/:id",
          description: "Delete admin notification",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true
              }
            }
          }
        }
      ]
    },
    {
      name: "Admin Payouts",
      description: "Admin payout management",
      endpoints: [
        {
          method: "GET",
          path: "/api/admin/payouts/payout-stats",
          description: "Get payout statistics",
          authentication: true,
          authorization: "ADMIN",
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  totalPending: 5000,
                  totalProcessed: 25000,
                  pendingCount: 10
                }
              }
            }
          }
        },
        {
          method: "POST",
          path: "/api/admin/payouts/process-payouts",
          description: "Process pending payouts",
          authentication: true,
          authorization: "ADMIN",
          requestBody: {
            payoutIds: ["payout_1", "payout_2"]
          },
          responses: {
            success: {
              status: 200,
              body: {
                success: true,
                data: {
                  processed: 5,
                  failed: 0
                }
              }
            }
          }
        }
      ]
    },
    {
      name: "Stripe Webhooks",
      description: "Stripe webhook handlers",
      endpoints: [
        {
          method: "POST",
          path: "/api/stripe/webhook",
          description: "Handle Stripe webhooks",
          authentication: false,
          headers: {
            "stripe-signature": "webhook_signature"
          },
          requestBody: "Raw webhook payload from Stripe",
          responses: {
            success: {
              status: 200,
              body: {
                received: true
              }
            }
          }
        }
      ]
    }
  ],
  
  authentication: {
    type: "Bearer Token",
    description: "Most endpoints require authentication via JWT token in Authorization header",
    format: "Authorization: Bearer <token>",
    tokenExpiry: "24 hours",
    refreshTokenExpiry: "30 days"
  },
  
  errorCodes: {
    400: "Bad Request - Invalid input data",
    401: "Unauthorized - Invalid or missing authentication",
    403: "Forbidden - Insufficient permissions",
    404: "Not Found - Resource not found",
    409: "Conflict - Resource already exists",
    422: "Unprocessable Entity - Validation error",
    429: "Too Many Requests - Rate limit exceeded",
    500: "Internal Server Error",
    503: "Service Unavailable"
  },
  
  rateLimiting: {
    description: "API implements rate limiting to prevent abuse",
    limits: {
      development: "10000 requests per 15 minutes",
      production: "100 requests per 15 minutes"
    }
  },
  
  websocket: {
    endpoint: "ws://localhost:5000 (development) | wss://api.fieldsy.indiitserver.in (production)",
    events: {
      connection: "Initial connection handshake",
      "message:new": "New chat message",
      "notification:new": "New notification",
      "booking:updated": "Booking status changed",
      "payout:processed": "Payout completed"
    }
  }
};
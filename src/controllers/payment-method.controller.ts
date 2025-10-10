//@ts-nocheck
import { Request, Response } from 'express';
import { stripe } from '../config/stripe.config';
import prisma from '../config/database';

interface AuthRequest extends Request {
  user?: any;
}

export const paymentMethodController = {
  // Create or get Stripe customer for user
  async getOrCreateStripeCustomer(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // If user already has a Stripe customer ID, verify it still exists
    if (user.stripeCustomerId) {
      try {
        // Try to retrieve the customer from Stripe
        const customer = await stripe.customers.retrieve(user.stripeCustomerId);
        
        // Check if customer is deleted
        if ((customer as any).deleted) {
          console.log(`Stripe customer ${user.stripeCustomerId} was deleted, creating new one`);
        } else {
          // Customer exists and is valid
          return user.stripeCustomerId;
        }
      } catch (error: any) {
        // Customer doesn't exist in Stripe (404 error)
        if (error.statusCode === 404 || error.code === 'resource_missing') {
          console.log(`Stripe customer ${user.stripeCustomerId} not found, creating new one`);
        } else {
          // Some other error occurred, throw it
          throw error;
        }
      }
    }

    // Create a new Stripe customer
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || undefined,
      metadata: {
        userId: user.id
      }
    });

    // Save the Stripe customer ID to the user
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id }
    });

    return customer.id;
  },

  // Create setup intent for adding a new card
  async createSetupIntent(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const customerId = await paymentMethodController.getOrCreateStripeCustomer(userId);

      // Create a SetupIntent to collect card details
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        metadata: {
          userId
        }
      });

      res.json({
        success: true,
        clientSecret: setupIntent.client_secret,
        customerId
      });
    } catch (error: any) {
      console.error('Create setup intent error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create setup intent'
      });
    }
  },

  // Save payment method after successful setup
  async savePaymentMethod(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { paymentMethodId, isDefault } = req.body;

      if (!paymentMethodId) {
        return res.status(400).json({ error: 'Payment method ID is required' });
      }

      // Retrieve payment method from Stripe
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

      // Check if payment method already exists in our database
      const existingMethod = await prisma.paymentMethod.findUnique({
        where: { stripePaymentMethodId: paymentMethodId }
      });

      if (existingMethod) {
        return res.status(400).json({ error: 'Payment method already saved' });
      }

      // If this is set as default, unset other defaults
      if (isDefault) {
        await prisma.paymentMethod.updateMany({
          where: { userId },
          data: { isDefault: false }
        });
      }

      // Save payment method to database
      const savedMethod = await prisma.paymentMethod.create({
        data: {
          userId,
          stripePaymentMethodId: paymentMethodId,
          type: paymentMethod.type,
          brand: paymentMethod.card?.brand || null,
          last4: paymentMethod.card?.last4 || '',
          expiryMonth: paymentMethod.card?.exp_month || null,
          expiryYear: paymentMethod.card?.exp_year || null,
          cardholderName: paymentMethod.billing_details?.name || null,
          isDefault: isDefault || false
        }
      });

      res.json({
        success: true,
        paymentMethod: savedMethod
      });
    } catch (error: any) {
      console.error('Save payment method error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to save payment method'
      });
    }
  },

  // Get all payment methods for a user
  async getPaymentMethods(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const paymentMethods = await prisma.paymentMethod.findMany({
        where: { userId },
        orderBy: [
          { createdAt: 'desc' }
        ]
      });

      res.json({
        success: true,
        paymentMethods
      });
    } catch (error: any) {
      console.error('Get payment methods error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch payment methods'
      });
    }
  },

  // Set a payment method as default
  async setDefaultPaymentMethod(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { paymentMethodId } = req.params;

      // Check if payment method exists and belongs to user
      const paymentMethod = await prisma.paymentMethod.findFirst({
        where: {
          id: paymentMethodId,
          userId
        }
      });

      if (!paymentMethod) {
        return res.status(404).json({ error: 'Payment method not found' });
      }

      // Unset all other defaults
      await prisma.paymentMethod.updateMany({
        where: { userId },
        data: { isDefault: false }
      });

      // Set this one as default
      const updatedMethod = await prisma.paymentMethod.update({
        where: { id: paymentMethodId },
        data: { isDefault: true }
      });

      // Also set it as default in Stripe
      try {
        const customerId = await paymentMethodController.getOrCreateStripeCustomer(userId);
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethod.stripePaymentMethodId
          }
        });
      } catch (stripeError) {
        console.error('Error setting default payment method in Stripe:', stripeError);
        // Continue even if Stripe update fails - local DB is already updated
      }

      res.json({
        success: true,
        paymentMethod: updatedMethod
      });
    } catch (error: any) {
      console.error('Set default payment method error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to set default payment method'
      });
    }
  },

  // Delete a payment method
  async deletePaymentMethod(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { paymentMethodId } = req.params;

      // Check if payment method exists and belongs to user
      const paymentMethod = await prisma.paymentMethod.findFirst({
        where: {
          id: paymentMethodId,
          userId
        }
      });

      if (!paymentMethod) {
        return res.status(404).json({ error: 'Payment method not found' });
      }

      // Detach from Stripe customer
      try {
        await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);
      } catch (stripeError) {
        console.error('Error detaching from Stripe:', stripeError);
        // Continue with local deletion even if Stripe detach fails
      }

      // Delete from database
      await prisma.paymentMethod.delete({
        where: { id: paymentMethodId }
      });

      // If this was the default, set another as default
      if (paymentMethod.isDefault) {
        const nextDefault = await prisma.paymentMethod.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' }
        });

        if (nextDefault) {
          await prisma.paymentMethod.update({
            where: { id: nextDefault.id },
            data: { isDefault: true }
          });
        }
      }

      res.json({
        success: true,
        message: 'Payment method deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete payment method error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete payment method'
      });
    }
  }
};

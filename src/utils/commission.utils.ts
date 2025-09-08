import prisma from '../config/database';

/**
 * Get the effective commission rate for a field owner
 * Returns the custom rate if set, otherwise the system default
 */
export async function getEffectiveCommissionRate(userId: string): Promise<number> {
  try {
    // Get the field owner's custom commission rate
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { commissionRate: true }
    });

    // If user has a custom rate, use it
    if (user?.commissionRate !== null && user?.commissionRate !== undefined) {
      return user.commissionRate;
    }

    // Otherwise, get the system default
    const settings = await prisma.systemSettings.findFirst();
    
    // Return the default rate or 20% if no settings exist
    return settings?.defaultCommissionRate || 20;
  } catch (error) {
    console.error('Error getting commission rate:', error);
    // Return default 20% on error
    return 20;
  }
}

/**
 * Calculate field owner amount and platform fee based on commission rate
 */
export async function calculatePayoutAmounts(
  totalAmount: number, 
  fieldOwnerId: string
): Promise<{ fieldOwnerAmount: number; platformFeeAmount: number; commissionRate: number }> {
  const commissionRate = await getEffectiveCommissionRate(fieldOwnerId);
  
  // Platform gets the commission percentage
  const platformFeeAmount = (totalAmount * commissionRate) / 100;
  
  // Field owner gets the remaining amount
  const fieldOwnerAmount = totalAmount - platformFeeAmount;
  
  return {
    fieldOwnerAmount,
    platformFeeAmount,
    commissionRate
  };
}
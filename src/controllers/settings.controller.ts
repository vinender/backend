import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get system settings
export const getSystemSettings = async (req: Request, res: Response) => {
  try {
    // Get the first settings record or create one with defaults
    let settings = await prisma.systemSettings.findFirst();
    
    if (!settings) {
      // Create default settings if none exist
      settings = await prisma.systemSettings.create({
        data: {
          defaultCommissionRate: 20,
          cancellationWindowHours: 24,
          maxBookingsPerUser: 10,
          siteName: 'Fieldsy',
          siteUrl: 'https://fieldsy.com',
          supportEmail: 'support@fieldsy.com',
          maintenanceMode: false,
          enableNotifications: true,
          enableEmailNotifications: true,
          enableSmsNotifications: false,
          bannerText: 'Find Safe, private dog walking fields',
          highlightedText: 'near you'
        }
      });
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system settings'
    });
  }
};

// Update system settings (Admin only)
export const updateSystemSettings = async (req: Request, res: Response) => {
  try {
    const {
      defaultCommissionRate,
      cancellationWindowHours,
      maxBookingsPerUser,
      siteName,
      siteUrl,
      supportEmail,
      maintenanceMode,
      enableNotifications,
      enableEmailNotifications,
      enableSmsNotifications,
      bannerText,
      highlightedText,
      aboutTitle,
      aboutDogImage,
      aboutFamilyImage,
      aboutDogIcons
    } = req.body;

    // Get existing settings or create if not exists
    let settings = await prisma.systemSettings.findFirst();
    
    if (!settings) {
      // Create with provided values
      settings = await prisma.systemSettings.create({
        data: {
          defaultCommissionRate: defaultCommissionRate || 20,
          cancellationWindowHours: cancellationWindowHours || 24,
          maxBookingsPerUser: maxBookingsPerUser || 10,
          siteName: siteName || 'Fieldsy',
          siteUrl: siteUrl || 'https://fieldsy.com',
          supportEmail: supportEmail || 'support@fieldsy.com',
          maintenanceMode: maintenanceMode || false,
          enableNotifications: enableNotifications ?? true,
          enableEmailNotifications: enableEmailNotifications ?? true,
          enableSmsNotifications: enableSmsNotifications ?? false,
          bannerText: bannerText || 'Find Safe, private dog walking fields',
          highlightedText: highlightedText || 'near you',
          aboutTitle: aboutTitle || 'At Fieldsy, we believe every dog deserves the freedom to run, sniff, and play safely.',
          aboutDogImage: aboutDogImage || '',
          aboutFamilyImage: aboutFamilyImage || '',
          aboutDogIcons: aboutDogIcons || []
        }
      });
    } else {
      // Update existing settings
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: {
          ...(defaultCommissionRate !== undefined && { defaultCommissionRate }),
          ...(cancellationWindowHours !== undefined && { cancellationWindowHours }),
          ...(maxBookingsPerUser !== undefined && { maxBookingsPerUser }),
          ...(siteName !== undefined && { siteName }),
          ...(siteUrl !== undefined && { siteUrl }),
          ...(supportEmail !== undefined && { supportEmail }),
          ...(maintenanceMode !== undefined && { maintenanceMode }),
          ...(enableNotifications !== undefined && { enableNotifications }),
          ...(enableEmailNotifications !== undefined && { enableEmailNotifications }),
          ...(enableSmsNotifications !== undefined && { enableSmsNotifications }),
          ...(bannerText !== undefined && { bannerText }),
          ...(highlightedText !== undefined && { highlightedText }),
          ...(aboutTitle !== undefined && { aboutTitle }),
          ...(aboutDogImage !== undefined && { aboutDogImage }),
          ...(aboutFamilyImage !== undefined && { aboutFamilyImage }),
          ...(aboutDogIcons !== undefined && { aboutDogIcons })
        }
      });
    }

    res.json({
      success: true,
      data: settings,
      message: 'System settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update system settings'
    });
  }
};

// Get public settings (for frontend use, no auth required)
export const getPublicSettings = async (req: Request, res: Response) => {
  try {
    let settings = await prisma.systemSettings.findFirst({
      select: {
        cancellationWindowHours: true,
        maxBookingsPerUser: true,
        siteName: true,
        siteUrl: true,
        supportEmail: true,
        maintenanceMode: true,
        bannerText: true,
        highlightedText: true,
        aboutTitle: true,
        aboutDogImage: true,
        aboutFamilyImage: true,
        aboutDogIcons: true
      }
    });
    
    if (!settings) {
      // Return default values if no settings exist
      settings = {
        cancellationWindowHours: 24,
        maxBookingsPerUser: 10,
        siteName: 'Fieldsy',
        siteUrl: 'https://fieldsy.com',
        supportEmail: 'support@fieldsy.com',
        maintenanceMode: false,
        bannerText: 'Find Safe, private dog walking fields',
        highlightedText: 'near you',
        aboutTitle: 'At Fieldsy, we believe every dog deserves the freedom to run, sniff, and play safely.',
        aboutDogImage: '',
        aboutFamilyImage: '',
        aboutDogIcons: []
      };
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching public settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch public settings'
    });
  }
};
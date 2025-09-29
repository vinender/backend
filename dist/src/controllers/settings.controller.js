"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get getPublicSettings () {
        return getPublicSettings;
    },
    get getSystemSettings () {
        return getSystemSettings;
    },
    get updatePlatformImages () {
        return updatePlatformImages;
    },
    get updateSystemSettings () {
        return updateSystemSettings;
    }
});
const _client = require("@prisma/client");
const prisma = new _client.PrismaClient();
const getSystemSettings = async (req, res)=>{
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
                    minimumFieldOperatingHours: 4,
                    payoutReleaseSchedule: 'after_cancellation_window',
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
const updateSystemSettings = async (req, res)=>{
    try {
        const { defaultCommissionRate, cancellationWindowHours, maxBookingsPerUser, minimumFieldOperatingHours, payoutReleaseSchedule, siteName, siteUrl, supportEmail, maintenanceMode, enableNotifications, enableEmailNotifications, enableSmsNotifications, bannerText, highlightedText, aboutTitle, aboutDogImage, aboutFamilyImage, aboutDogIcons } = req.body;
        // Get existing settings or create if not exists
        let settings = await prisma.systemSettings.findFirst();
        if (!settings) {
            // Create with provided values
            settings = await prisma.systemSettings.create({
                data: {
                    defaultCommissionRate: defaultCommissionRate || 20,
                    cancellationWindowHours: cancellationWindowHours || 24,
                    maxBookingsPerUser: maxBookingsPerUser || 10,
                    minimumFieldOperatingHours: minimumFieldOperatingHours || 4,
                    payoutReleaseSchedule: payoutReleaseSchedule || 'after_cancellation_window',
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
                where: {
                    id: settings.id
                },
                data: {
                    ...defaultCommissionRate !== undefined && {
                        defaultCommissionRate
                    },
                    ...payoutReleaseSchedule !== undefined && {
                        payoutReleaseSchedule
                    },
                    ...cancellationWindowHours !== undefined && {
                        cancellationWindowHours
                    },
                    ...maxBookingsPerUser !== undefined && {
                        maxBookingsPerUser
                    },
                    ...minimumFieldOperatingHours !== undefined && {
                        minimumFieldOperatingHours
                    },
                    ...siteName !== undefined && {
                        siteName
                    },
                    ...siteUrl !== undefined && {
                        siteUrl
                    },
                    ...supportEmail !== undefined && {
                        supportEmail
                    },
                    ...maintenanceMode !== undefined && {
                        maintenanceMode
                    },
                    ...enableNotifications !== undefined && {
                        enableNotifications
                    },
                    ...enableEmailNotifications !== undefined && {
                        enableEmailNotifications
                    },
                    ...enableSmsNotifications !== undefined && {
                        enableSmsNotifications
                    },
                    ...bannerText !== undefined && {
                        bannerText
                    },
                    ...highlightedText !== undefined && {
                        highlightedText
                    },
                    ...aboutTitle !== undefined && {
                        aboutTitle
                    },
                    ...aboutDogImage !== undefined && {
                        aboutDogImage
                    },
                    ...aboutFamilyImage !== undefined && {
                        aboutFamilyImage
                    },
                    ...aboutDogIcons !== undefined && {
                        aboutDogIcons
                    },
                    ...req.body.platformDogOwnersImage !== undefined && {
                        platformDogOwnersImage: req.body.platformDogOwnersImage
                    },
                    ...req.body.platformFieldOwnersImage !== undefined && {
                        platformFieldOwnersImage: req.body.platformFieldOwnersImage
                    },
                    ...req.body.platformWaveImage !== undefined && {
                        platformWaveImage: req.body.platformWaveImage
                    },
                    ...req.body.platformHoverImage !== undefined && {
                        platformHoverImage: req.body.platformHoverImage
                    }
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
const updatePlatformImages = async (req, res)=>{
    try {
        const { platformDogOwnersImage, platformFieldOwnersImage, platformTitle, platformDogOwnersSubtitle, platformDogOwnersTitle, platformDogOwnersBullets, platformFieldOwnersSubtitle, platformFieldOwnersTitle, platformFieldOwnersBullets } = req.body;
        // Get existing settings or create if not exists
        let settings = await prisma.systemSettings.findFirst();
        if (!settings) {
            // Create with provided values
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
                    highlightedText: 'near you',
                    platformDogOwnersImage: platformDogOwnersImage || '',
                    platformFieldOwnersImage: platformFieldOwnersImage || '',
                    platformTitle: platformTitle || 'One Platform, Two Tail-Wagging Experiences',
                    platformDogOwnersSubtitle: platformDogOwnersSubtitle || 'For Dog Owners:',
                    platformDogOwnersTitle: platformDogOwnersTitle || 'Find & Book Private Dog Walking Fields in Seconds',
                    platformDogOwnersBullets: platformDogOwnersBullets || [
                        "Stress-free walks for reactive or energetic dogs",
                        "Fully fenced, secure spaces",
                        "GPS-powered search",
                        "Instant hourly bookings"
                    ],
                    platformFieldOwnersSubtitle: platformFieldOwnersSubtitle || 'For Field Owners:',
                    platformFieldOwnersTitle: platformFieldOwnersTitle || "Turn Your Land into a Dog's Dream & Earn",
                    platformFieldOwnersBullets: platformFieldOwnersBullets || [
                        "Earn passive income while helping pets",
                        "Host dog owners with full control",
                        "Set your availability and pricing",
                        "List your field for free"
                    ]
                }
            });
        } else {
            // Update existing settings
            settings = await prisma.systemSettings.update({
                where: {
                    id: settings.id
                },
                data: {
                    ...platformDogOwnersImage !== undefined && {
                        platformDogOwnersImage
                    },
                    ...platformFieldOwnersImage !== undefined && {
                        platformFieldOwnersImage
                    },
                    ...platformTitle !== undefined && {
                        platformTitle
                    },
                    ...platformDogOwnersSubtitle !== undefined && {
                        platformDogOwnersSubtitle
                    },
                    ...platformDogOwnersTitle !== undefined && {
                        platformDogOwnersTitle
                    },
                    ...platformDogOwnersBullets !== undefined && {
                        platformDogOwnersBullets
                    },
                    ...platformFieldOwnersSubtitle !== undefined && {
                        platformFieldOwnersSubtitle
                    },
                    ...platformFieldOwnersTitle !== undefined && {
                        platformFieldOwnersTitle
                    },
                    ...platformFieldOwnersBullets !== undefined && {
                        platformFieldOwnersBullets
                    }
                }
            });
        }
        res.json({
            success: true,
            data: {
                platformDogOwnersImage: settings.platformDogOwnersImage,
                platformFieldOwnersImage: settings.platformFieldOwnersImage,
                platformTitle: settings.platformTitle,
                platformDogOwnersSubtitle: settings.platformDogOwnersSubtitle,
                platformDogOwnersTitle: settings.platformDogOwnersTitle,
                platformDogOwnersBullets: settings.platformDogOwnersBullets,
                platformFieldOwnersSubtitle: settings.platformFieldOwnersSubtitle,
                platformFieldOwnersTitle: settings.platformFieldOwnersTitle,
                platformFieldOwnersBullets: settings.platformFieldOwnersBullets
            },
            message: 'Platform section updated successfully'
        });
    } catch (error) {
        console.error('Error updating platform section:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update platform section'
        });
    }
};
const getPublicSettings = async (req, res)=>{
    try {
        let settings = await prisma.systemSettings.findFirst({
            select: {
                cancellationWindowHours: true,
                maxBookingsPerUser: true,
                minimumFieldOperatingHours: true,
                siteName: true,
                siteUrl: true,
                supportEmail: true,
                maintenanceMode: true,
                bannerText: true,
                highlightedText: true,
                aboutTitle: true,
                aboutDogImage: true,
                aboutFamilyImage: true,
                aboutDogIcons: true,
                platformDogOwnersImage: true,
                platformFieldOwnersImage: true,
                platformTitle: true,
                platformDogOwnersSubtitle: true,
                platformDogOwnersTitle: true,
                platformDogOwnersBullets: true,
                platformFieldOwnersSubtitle: true,
                platformFieldOwnersTitle: true,
                platformFieldOwnersBullets: true
            }
        });
        if (!settings) {
            // Return default values if no settings exist
            settings = {
                cancellationWindowHours: 24,
                maxBookingsPerUser: 10,
                minimumFieldOperatingHours: 4,
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

//# sourceMappingURL=settings.controller.js.map
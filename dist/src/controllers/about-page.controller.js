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
    get getAboutPage () {
        return getAboutPage;
    },
    get updateAboutPage () {
        return updateAboutPage;
    },
    get updateAboutSection () {
        return updateAboutSection;
    }
});
const _client = require("@prisma/client");
const prisma = new _client.PrismaClient();
const getAboutPage = async (req, res)=>{
    try {
        // Get the first (and should be only) about page record
        let aboutPage = await prisma.aboutPage.findFirst();
        // If no about page exists, create one with default values
        if (!aboutPage) {
            aboutPage = await prisma.aboutPage.create({
                data: {
                    heroSectionTitle: 'About Us',
                    heroMainTitle: 'Find Safe, Private Dog Walking Fields Near You',
                    heroDescription: 'At Fieldsy, we believe every dog deserves the freedom to run, sniff, and play safely.',
                    heroButtonText: 'Download App',
                    heroImage: '/about/dog2.png',
                    heroStats: [
                        {
                            value: '500+',
                            label: 'Early Access Signups',
                            order: 1
                        },
                        {
                            value: '200+',
                            label: 'Private Fields Being Onboarded',
                            order: 2
                        },
                        {
                            value: '50+',
                            label: 'Cities Covered Across the UK',
                            order: 3
                        },
                        {
                            value: '100%',
                            label: 'Safe, Secure & Fenced Spaces',
                            order: 4
                        }
                    ]
                }
            });
        }
        // Transform the flat structure to nested structure for frontend compatibility
        const transformedData = {
            heroSection: {
                sectionTitle: aboutPage.heroSectionTitle || '',
                mainTitle: aboutPage.heroMainTitle || '',
                subtitle: aboutPage.heroSubtitle || '',
                description: aboutPage.heroDescription || '',
                buttonText: aboutPage.heroButtonText || '',
                image: aboutPage.heroImage || '',
                stats: aboutPage.heroStats || []
            },
            missionSection: {
                title: aboutPage.missionTitle || '',
                description: aboutPage.missionDescription || '',
                buttonText: aboutPage.missionButtonText || '',
                image: aboutPage.missionImage || ''
            },
            whoWeAreSection: {
                title: aboutPage.whoWeAreTitle || '',
                description: aboutPage.whoWeAreDescription || '',
                mainImage: aboutPage.whoWeAreMainImage || '',
                rightCardImage: aboutPage.whoWeAreRightCardImage || '',
                rightCardTitle: aboutPage.whoWeAreRightCardTitle || '',
                rightCardDescription: aboutPage.whoWeAreRightCardDescription || '',
                features: aboutPage.whoWeAreFeatures || []
            },
            whatWeDoSection: {
                title: aboutPage.whatWeDoTitle || '',
                subtitle: aboutPage.whatWeDoSubtitle || '',
                description: aboutPage.whatWeDoDescription || '',
                image: aboutPage.whatWeDoImage || '',
                features: aboutPage.whatWeDoFeatures || []
            },
            whyFieldsySection: {
                title: aboutPage.whyFieldsyTitle || '',
                subtitle: aboutPage.whyFieldsySubtitle || '',
                image: aboutPage.whyFieldsyImage || '',
                boxTitle: aboutPage.whyFieldsyBoxTitle || '',
                boxDescription: aboutPage.whyFieldsyBoxDescription || '',
                buttonText: aboutPage.whyFieldsyButtonText || '',
                features: aboutPage.whyFieldsyFeatures || []
            },
            _id: aboutPage.id,
            createdAt: aboutPage.createdAt,
            updatedAt: aboutPage.updatedAt
        };
        res.status(200).json({
            success: true,
            data: transformedData
        });
    } catch (error) {
        console.error('Error fetching about page:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch about page content',
            error: error.message
        });
    }
};
const updateAboutPage = async (req, res)=>{
    try {
        const updates = req.body;
        // Transform nested structure to flat structure for database
        const dbUpdates = {};
        if (updates.heroSection) {
            if (updates.heroSection.sectionTitle !== undefined) dbUpdates.heroSectionTitle = updates.heroSection.sectionTitle;
            if (updates.heroSection.mainTitle !== undefined) dbUpdates.heroMainTitle = updates.heroSection.mainTitle;
            if (updates.heroSection.subtitle !== undefined) dbUpdates.heroSubtitle = updates.heroSection.subtitle;
            if (updates.heroSection.description !== undefined) dbUpdates.heroDescription = updates.heroSection.description;
            if (updates.heroSection.buttonText !== undefined) dbUpdates.heroButtonText = updates.heroSection.buttonText;
            if (updates.heroSection.image !== undefined) dbUpdates.heroImage = updates.heroSection.image;
            if (updates.heroSection.stats !== undefined) dbUpdates.heroStats = updates.heroSection.stats;
        }
        if (updates.missionSection) {
            if (updates.missionSection.title !== undefined) dbUpdates.missionTitle = updates.missionSection.title;
            if (updates.missionSection.description !== undefined) dbUpdates.missionDescription = updates.missionSection.description;
            if (updates.missionSection.buttonText !== undefined) dbUpdates.missionButtonText = updates.missionSection.buttonText;
            if (updates.missionSection.image !== undefined) dbUpdates.missionImage = updates.missionSection.image;
        }
        if (updates.whoWeAreSection) {
            if (updates.whoWeAreSection.title !== undefined) dbUpdates.whoWeAreTitle = updates.whoWeAreSection.title;
            if (updates.whoWeAreSection.description !== undefined) dbUpdates.whoWeAreDescription = updates.whoWeAreSection.description;
            if (updates.whoWeAreSection.features !== undefined) dbUpdates.whoWeAreFeatures = updates.whoWeAreSection.features;
        }
        if (updates.whatWeDoSection) {
            if (updates.whatWeDoSection.title !== undefined) dbUpdates.whatWeDoTitle = updates.whatWeDoSection.title;
            if (updates.whatWeDoSection.subtitle !== undefined) dbUpdates.whatWeDoSubtitle = updates.whatWeDoSection.subtitle;
            if (updates.whatWeDoSection.description !== undefined) dbUpdates.whatWeDoDescription = updates.whatWeDoSection.description;
            if (updates.whatWeDoSection.image !== undefined) dbUpdates.whatWeDoImage = updates.whatWeDoSection.image;
            if (updates.whatWeDoSection.features !== undefined) dbUpdates.whatWeDoFeatures = updates.whatWeDoSection.features;
        }
        if (updates.whyFieldsySection) {
            if (updates.whyFieldsySection.title !== undefined) dbUpdates.whyFieldsyTitle = updates.whyFieldsySection.title;
            if (updates.whyFieldsySection.subtitle !== undefined) dbUpdates.whyFieldsySubtitle = updates.whyFieldsySection.subtitle;
            if (updates.whyFieldsySection.features !== undefined) dbUpdates.whyFieldsyFeatures = updates.whyFieldsySection.features;
        }
        // Get existing about page or create new one
        let aboutPage = await prisma.aboutPage.findFirst();
        if (!aboutPage) {
            aboutPage = await prisma.aboutPage.create({
                data: dbUpdates
            });
        } else {
            aboutPage = await prisma.aboutPage.update({
                where: {
                    id: aboutPage.id
                },
                data: dbUpdates
            });
        }
        res.status(200).json({
            success: true,
            message: 'About page updated successfully',
            data: aboutPage
        });
    } catch (error) {
        console.error('Error updating about page:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update about page content',
            error: error.message
        });
    }
};
const updateAboutSection = async (req, res)=>{
    try {
        const { section } = req.params;
        const updates = req.body;
        const validSections = [
            'heroSection',
            'missionSection',
            'whoWeAreSection',
            'whatWeDoSection',
            'whyFieldsySection'
        ];
        if (!validSections.includes(section)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid section name'
            });
        }
        // Get existing about page or create new one
        let aboutPage = await prisma.aboutPage.findFirst();
        const updateData = {};
        // Build the update data based on section
        switch(section){
            case 'heroSection':
                updateData.heroSectionTitle = updates.sectionTitle;
                updateData.heroMainTitle = updates.mainTitle;
                updateData.heroSubtitle = updates.subtitle;
                updateData.heroDescription = updates.description;
                updateData.heroButtonText = updates.buttonText;
                updateData.heroImage = updates.image;
                updateData.heroStats = updates.stats;
                break;
            case 'missionSection':
                updateData.missionTitle = updates.title;
                updateData.missionDescription = updates.description;
                updateData.missionButtonText = updates.buttonText;
                updateData.missionImage = updates.image;
                break;
            case 'whoWeAreSection':
                updateData.whoWeAreTitle = updates.title;
                updateData.whoWeAreDescription = updates.description;
                updateData.whoWeAreMainImage = updates.mainImage;
                updateData.whoWeAreRightCardImage = updates.rightCardImage;
                updateData.whoWeAreRightCardTitle = updates.rightCardTitle;
                updateData.whoWeAreRightCardDescription = updates.rightCardDescription;
                updateData.whoWeAreFeatures = updates.features;
                break;
            case 'whatWeDoSection':
                updateData.whatWeDoTitle = updates.title;
                updateData.whatWeDoSubtitle = updates.subtitle;
                updateData.whatWeDoDescription = updates.description;
                updateData.whatWeDoImage = updates.image;
                updateData.whatWeDoFeatures = updates.features;
                break;
            case 'whyFieldsySection':
                updateData.whyFieldsyTitle = updates.title;
                updateData.whyFieldsySubtitle = updates.subtitle;
                updateData.whyFieldsyImage = updates.image;
                updateData.whyFieldsyBoxTitle = updates.boxTitle;
                updateData.whyFieldsyBoxDescription = updates.boxDescription;
                updateData.whyFieldsyButtonText = updates.buttonText;
                updateData.whyFieldsyFeatures = updates.features;
                break;
        }
        if (!aboutPage) {
            aboutPage = await prisma.aboutPage.create({
                data: updateData
            });
        } else {
            aboutPage = await prisma.aboutPage.update({
                where: {
                    id: aboutPage.id
                },
                data: updateData
            });
        }
        res.status(200).json({
            success: true,
            message: `${section} updated successfully`,
            data: aboutPage
        });
    } catch (error) {
        console.error('Error updating about section:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update about section',
            error: error.message
        });
    }
};

//# sourceMappingURL=about-page.controller.js.map
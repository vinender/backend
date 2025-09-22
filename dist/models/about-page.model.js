"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AboutPage = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AboutPageSchema = new mongoose_1.Schema({
    heroSection: {
        sectionTitle: { type: String, default: 'About Us' },
        mainTitle: { type: String, required: true },
        subtitle: { type: String },
        description: { type: String, required: true },
        buttonText: { type: String, default: 'Download App' },
        image: { type: String, required: true },
        stats: [
            {
                value: { type: String, required: true },
                label: { type: String, required: true },
                order: { type: Number, default: 0 }
            }
        ]
    },
    missionSection: {
        title: { type: String, required: true },
        description: { type: String, required: true },
        buttonText: { type: String },
        image: { type: String }
    },
    whoWeAreSection: {
        title: { type: String, required: true },
        description: { type: String, required: true },
        mainImage: { type: String },
        rightCardImage: { type: String },
        rightCardTitle: { type: String },
        rightCardDescription: { type: String },
        features: [
            {
                icon: { type: String },
                title: { type: String, required: true },
                description: { type: String, required: true },
                order: { type: Number, default: 0 }
            }
        ]
    },
    whatWeDoSection: {
        title: { type: String, required: true },
        subtitle: { type: String },
        description: { type: String, required: true },
        image: { type: String },
        features: [
            {
                title: { type: String, required: true },
                description: { type: String, required: true },
                order: { type: Number, default: 0 }
            }
        ]
    },
    whyFieldsySection: {
        title: { type: String, required: true },
        subtitle: { type: String },
        image: { type: String },
        boxTitle: { type: String },
        boxDescription: { type: String },
        buttonText: { type: String },
        features: [
            {
                icon: { type: String },
                title: { type: String, required: true },
                description: { type: String, required: true },
                order: { type: Number, default: 0 }
            }
        ]
    }
}, {
    timestamps: true
});
// Ensure only one document exists
AboutPageSchema.statics.findOneOrCreate = async function () {
    let aboutPage = await this.findOne();
    if (!aboutPage) {
        aboutPage = await this.create({
            heroSection: {
                sectionTitle: 'About Us',
                mainTitle: 'Find Safe, Private Dog Walking Fields Near You',
                description: 'At Fieldsy, we believe every dog deserves the freedom to run, sniff, and play safely. Born out of love for dogs and a need for secure, off-lead spaces, Fieldsy helps you find and book private dog walking fields across the UK—quickly and effortlessly.',
                buttonText: 'Download App',
                image: '/about/dog2.png',
                stats: []
            },
            missionSection: {
                title: '',
                description: '',
                image: ''
            },
            whoWeAreSection: {
                title: '',
                description: '',
                features: []
            },
            whatWeDoSection: {
                title: '',
                subtitle: '',
                description: '',
                image: '',
                features: []
            },
            whyFieldsySection: {
                title: '',
                subtitle: '',
                features: []
            }
        });
    }
    return aboutPage;
};
exports.AboutPage = mongoose_1.default.model('AboutPage', AboutPageSchema);

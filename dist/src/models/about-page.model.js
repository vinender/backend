"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AboutPage", {
    enumerable: true,
    get: function() {
        return AboutPage;
    }
});
const _mongoose = /*#__PURE__*/ _interop_require_wildcard(require("mongoose"));
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
const AboutPageSchema = new _mongoose.Schema({
    heroSection: {
        sectionTitle: {
            type: String,
            default: 'About Us'
        },
        mainTitle: {
            type: String,
            required: true
        },
        subtitle: {
            type: String
        },
        description: {
            type: String,
            required: true
        },
        buttonText: {
            type: String,
            default: 'Download App'
        },
        image: {
            type: String,
            required: true
        },
        stats: [
            {
                value: {
                    type: String,
                    required: true
                },
                label: {
                    type: String,
                    required: true
                },
                order: {
                    type: Number,
                    default: 0
                }
            }
        ]
    },
    missionSection: {
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        buttonText: {
            type: String
        },
        image: {
            type: String
        }
    },
    whoWeAreSection: {
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        mainImage: {
            type: String
        },
        rightCardImage: {
            type: String
        },
        rightCardTitle: {
            type: String
        },
        rightCardDescription: {
            type: String
        },
        features: [
            {
                icon: {
                    type: String
                },
                title: {
                    type: String,
                    required: true
                },
                description: {
                    type: String,
                    required: true
                },
                order: {
                    type: Number,
                    default: 0
                }
            }
        ]
    },
    whatWeDoSection: {
        title: {
            type: String,
            required: true
        },
        subtitle: {
            type: String
        },
        description: {
            type: String,
            required: true
        },
        image: {
            type: String
        },
        features: [
            {
                title: {
                    type: String,
                    required: true
                },
                description: {
                    type: String,
                    required: true
                },
                order: {
                    type: Number,
                    default: 0
                }
            }
        ]
    },
    whyFieldsySection: {
        title: {
            type: String,
            required: true
        },
        subtitle: {
            type: String
        },
        image: {
            type: String
        },
        boxTitle: {
            type: String
        },
        boxDescription: {
            type: String
        },
        buttonText: {
            type: String
        },
        features: [
            {
                icon: {
                    type: String
                },
                title: {
                    type: String,
                    required: true
                },
                description: {
                    type: String,
                    required: true
                },
                order: {
                    type: Number,
                    default: 0
                }
            }
        ]
    }
}, {
    timestamps: true
});
// Ensure only one document exists
AboutPageSchema.statics.findOneOrCreate = async function() {
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
const AboutPage = _mongoose.default.model('AboutPage', AboutPageSchema);

//# sourceMappingURL=about-page.model.js.map
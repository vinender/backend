"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appleSignInService = void 0;
//@ts-nocheck
const apple_signin_auth_1 = __importDefault(require("apple-signin-auth"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class AppleSignInService {
    teamId;
    keyId;
    clientId;
    privateKey;
    constructor() {
        // Load configuration from environment variables
        this.teamId = process.env.APPLE_TEAM_ID || '';
        this.keyId = process.env.APPLE_KEY_ID || '';
        this.clientId = process.env.APPLE_CLIENT_ID || '';
        this.privateKey = process.env.APPLE_SECRET || '';
        // Validate configuration on initialization
        if (!this.teamId || !this.keyId || !this.clientId || !this.privateKey) {
            console.warn('⚠️  Apple Sign In is not fully configured. Some features may not work.');
            console.warn('Missing:', {
                teamId: !this.teamId,
                keyId: !this.keyId,
                clientId: !this.clientId,
                privateKey: !this.privateKey
            });
        }
        else {
            console.log('✅ Apple Sign In Service initialized');
            console.log('   Team ID:', this.teamId);
            console.log('   Key ID:', this.keyId);
            console.log('   Client ID:', this.clientId);
        }
    }
    /**
     * Verify Apple ID token from client
     * Works for both web and mobile apps
     *
     * @param idToken - The ID token from Apple Sign In
     * @param clientId - Optional client ID to verify (defaults to env)
     * @returns Decoded and verified user information
     */
    async verifyIdToken(idToken, clientId) {
        try {
            console.log('🔐 Verifying Apple ID token...');
            // Verify the token using apple-signin-auth library
            const appleRes = await apple_signin_auth_1.default.verifyIdToken(idToken, {
                audience: clientId || this.clientId, // Your app's client ID
                nonce: undefined, // Optional: verify nonce if you sent one
                // Ignore expiration for development/testing (remove in production)
                ignoreExpiration: process.env.NODE_ENV === 'development',
            });
            console.log('✅ Apple ID token verified successfully');
            console.log('   User ID (sub):', appleRes.sub);
            console.log('   Email:', appleRes.email);
            console.log('   Email Verified:', appleRes.email_verified);
            // Parse the token payload for additional info
            const decodedToken = jsonwebtoken_1.default.decode(idToken);
            return {
                email: appleRes.email || '',
                emailVerified: this.parseEmailVerified(appleRes.email_verified),
                sub: appleRes.sub,
                name: undefined, // Name is only provided on first sign-in from client
            };
        }
        catch (error) {
            console.error('❌ Apple ID token verification failed:', error);
            throw new Error('Invalid Apple ID token');
        }
    }
    /**
     * Generate Apple client secret (JWT token)
     * Required for server-to-server API calls
     * Valid for 6 months
     *
     * @returns JWT token to use as client secret
     */
    generateClientSecret() {
        try {
            console.log('🔑 Generating Apple client secret...');
            if (!this.privateKey) {
                throw new Error('Apple private key not configured');
            }
            // Create JWT token for Apple
            const token = jsonwebtoken_1.default.sign({
                iss: this.teamId,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 15777000, // 6 months
                aud: 'https://appleid.apple.com',
                sub: this.clientId,
            }, this.privateKey, {
                algorithm: 'ES256',
                header: {
                    alg: 'ES256',
                    kid: this.keyId,
                },
            });
            console.log('✅ Apple client secret generated');
            console.log('   Expires in: 6 months');
            return token;
        }
        catch (error) {
            console.error('❌ Failed to generate Apple client secret:', error);
            throw new Error('Failed to generate Apple client secret');
        }
    }
    /**
     * Exchange authorization code for tokens
     * Used in web OAuth flow
     *
     * @param code - Authorization code from Apple
     * @returns Access token and ID token
     */
    async getAuthorizationToken(code) {
        try {
            console.log('🔄 Exchanging authorization code for tokens...');
            const clientSecret = this.generateClientSecret();
            const response = await apple_signin_auth_1.default.getAuthorizationToken(code, {
                clientID: this.clientId,
                clientSecret: clientSecret,
                redirectUri: process.env.APPLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/apple',
            });
            console.log('✅ Authorization tokens received');
            return response;
        }
        catch (error) {
            console.error('❌ Failed to exchange authorization code:', error);
            throw new Error('Failed to exchange authorization code');
        }
    }
    /**
     * Refresh Apple access token
     *
     * @param refreshToken - The refresh token from Apple
     * @returns New access token
     */
    async refreshAuthorizationToken(refreshToken) {
        try {
            console.log('🔄 Refreshing Apple access token...');
            const clientSecret = this.generateClientSecret();
            const response = await apple_signin_auth_1.default.refreshAuthorizationToken(refreshToken, {
                clientID: this.clientId,
                clientSecret: clientSecret,
            });
            console.log('✅ Access token refreshed');
            return response;
        }
        catch (error) {
            console.error('❌ Failed to refresh access token:', error);
            throw new Error('Failed to refresh access token');
        }
    }
    /**
     * Get Apple's public keys for token verification
     * Cached by the library
     */
    async getApplePublicKeys() {
        try {
            const keys = await apple_signin_auth_1.default.getAuthorizationToken.getApplePublicKeys();
            return keys;
        }
        catch (error) {
            console.error('❌ Failed to get Apple public keys:', error);
            throw error;
        }
    }
    /**
     * Helper method to parse email_verified field
     * Apple returns it as boolean or string "true"/"false"
     */
    parseEmailVerified(value) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true';
        }
        // Apple-verified emails are always considered verified
        return true;
    }
    /**
     * Validate Apple configuration
     * @returns true if all required config is present
     */
    isConfigured() {
        return !!(this.teamId && this.keyId && this.clientId && this.privateKey);
    }
    /**
     * Get configuration status for debugging
     */
    getConfigStatus() {
        return {
            teamId: this.teamId ? '✅ Set' : '❌ Missing',
            keyId: this.keyId ? '✅ Set' : '❌ Missing',
            clientId: this.clientId ? '✅ Set' : '❌ Missing',
            privateKey: this.privateKey ? '✅ Set' : '❌ Missing',
            configured: this.isConfigured(),
        };
    }
}
// Export singleton instance
exports.appleSignInService = new AppleSignInService();
exports.default = exports.appleSignInService;

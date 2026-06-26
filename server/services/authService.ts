import jwt from 'jsonwebtoken'
import type {Response} from 'express'
import dotenv from 'dotenv'
import strict from 'node:assert/strict';

dotenv.config({ quiet: true })

const ACCESS_TOKEN_SECRET : string = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET : string = process.env.REFRESH_TOKEN_SECRET!;

// Function to generate tokens

export const generateTokens = (userId: string) => {
    const access_token = jwt.sign({id : userId}, ACCESS_TOKEN_SECRET, {
        expiresIn: '15m',
    })

    const refresh_token = jwt.sign({id : userId}, REFRESH_TOKEN_SECRET, {
        expiresIn: '7d',
    })

    return{access_token, refresh_token}
}

export const setRefreshTokenCookie = (res: Response, refreshToken : string) => {
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure : process.env.NODE_ENV === 'production', // Only send over HTTPS in production
        sameSite : 'strict',
        maxAge : 7 * 24 * 60 * 60 * 1000,
        path: '/'
    });
};

import { OAuth2Client } from 'google-auth-library';

export const verifyGoogleToken = async (idToken: string) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error('Google Client ID is not configured');
    
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
    });
    
    return ticket.getPayload();
};

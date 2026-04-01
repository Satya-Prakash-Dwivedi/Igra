/**
 * This controller will handle the HTTP request/response and orchestrates the service
 */

import type {Request, Response} from 'express';
import asyncHandler from 'express-async-handler';
import * as userService from '../services/userService.ts';
import * as authService from '../services/authService.ts';
import User from '../models/User.ts';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import type { AuthRequest } from '../middleware/auth.ts';
import { updateProfileSchema } from '../validators/userValidator.ts';

dotenv.config({ quiet: true })

export const register = asyncHandler(async(req: Request, res: Response) => {
    const { name , email, password } = req.body;

    // Call the userService to create the user
    const user = await userService.createUser({name, email, password});

    // Generate tokens
    const {access_token, refresh_token} = authService.generateTokens(user.id);

    // Set the refresh token in cookie
    authService.setRefreshTokenCookie(res, refresh_token);

    // Send the response back
    res.status(201).json({
        success: true,
        data: {
            user : {
                id : user._id,
                name : user.name,
                email : user.email,
                role : user.role,
            },
            access_token,
        },
        message: 'User registered successfully'
    });
});

export const login = asyncHandler(async(req: Request, res: Response) => {
    const {email, password} = req.body;

    // 1. Find the user and explicitly ask for the password ( since we hidden it in schema )
    const user = await User.findOne({email}).select('+password');

    // 2. Check is user exists and if password is correct
    if(!user || !(await user.comparePassword(password))){
        throw new Error("Invalid email or password");
    }

    // 3. Check if user is active
    if(!user.isActive){
        res.status(403) // Forbidden
        throw new Error("Account is diabled, Please contact support.");
    }

    // 4. Update last login time
    user.lastLoginAt = new Date()
    await user.save()

    // 5. Generate and set tokens
    const {access_token, refresh_token} = authService.generateTokens(user.id);
    authService.setRefreshTokenCookie(res, refresh_token);

    // 6. Send Response
    res.json({
        success: true,
        data : {
            user : {
                id : user.id,
                name : user.name,
                email : user.email,
                role : user.role,
            },
            access_token,
        },
        message : "Login Successful",
    });
});

export const getProfile = asyncHandler(async(req: AuthRequest, res: Response) => {
    // We can just send back the user that was attached by the authenticate middleware
    res.json({
        success: true,
        data : {
            user : req.user,
        },
    });
});

export const refresh = asyncHandler(async(req: Request, res: Response) => {
    // 1. Get the refresh token from the cookie
    const refreshToken = req.cookies.refreshToken;

    if(!refreshToken){
        res.status(401);
        throw new Error('Not authorized, no refresh token found');
    }

    try {
        // 2. Verify the refresh token
        const decoded : any = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!);

        // 3. Find the user 
        const user = await User.findById(decoded.id);

        if(!user || !user.isActive){
            res.status(401);
            throw new Error('User not found or account deactivated');
        }

        // 4. Generate a new access token (keep the user logged in)
        const {access_token} = authService.generateTokens(user.id);

        // 5. Send only the new access token
        res.json({
            success: true,
            data : {access_token},
            message : "Token refreshed successfully",
        });
    } catch (error) {
        res.status(401);
        throw new Error('Not authorized, refresh token failed');
    }
})

export const logout = asyncHandler(async(req: Request, res : Response) => {
    // 1. Clear the cookie by setting it to an empty string and expiring it instantly
    res.clearCookie('refreshToken', {
        httpOnly: true,
        expires : new Date(0), // set to new date in past
        secure : process.env.NODE_ENV === 'production',
        sameSite : 'strict',
        path : '/'
    });

    // 2. Clear any other session information
    res.status(200).json({
        success: true,
        message : 'User logged out successfully',
    });
});

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    // 1. Validate request body
    const validatedData = updateProfileSchema.parse(req.body);

    // 2. Call service to update user
    const updatedUser = await userService.updateUserProfile(req.user!.id, validatedData);

    // 3. Send response
    res.json({
        success: true,
        data: {
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                email: updatedUser.email,
                avatar: updatedUser.avatar,
                role: updatedUser.role,
                company: updatedUser.company,
                youtubeChannel: updatedUser.youtubeChannel,
                notificationPreferences: updatedUser.notificationPreferences,
            },
        },
        message: 'Profile updated successfully',
    });
});

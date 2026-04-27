/**
 * This controller will handle the HTTP request/response and orchestrates the service
 */

import type {Request, Response} from 'express';
import asyncHandler from 'express-async-handler';
import * as userService from '../services/userService.js';
import * as authService from '../services/authService.js';
import { normalizeAssetUrl } from '../services/uploadService.js';
import * as creditService from '../services/creditService.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';
import type { AuthRequest } from '../middleware/auth.js';
import { updateProfileSchema } from '../validators/userValidator.js';
import * as emailService from '../services/emailService.js';
import logger from '../utils/logger.js';

dotenv.config({ quiet: true })

export const register = asyncHandler(async(req: Request, res: Response) => {
    const { name , email, password } = req.body;

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Call the userService to create the user
    const user = await userService.createUser({
        name, 
        email, 
        password,
        verificationToken,
        verificationTokenExpires
    } as any);

    // Send the verification email
    try {
        await emailService.sendVerificationEmail(user.email, verificationToken);
    } catch (error) {
        // If email fails, delete the created user so they can try again
        await User.findByIdAndDelete(user._id);
        res.status(500);
        throw new Error('Failed to send verification email. Please try again.');
    }

    // Send the response back without tokens
    res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.'
    });
});

export const login = asyncHandler(async(req: Request, res: Response) => {
    const {email: rawEmail, password} = req.body;
    const email = rawEmail?.toLowerCase().trim();

    // 1. Find the user and explicitly ask for the password ( since we hidden it in schema )
    const user = await User.findOne({email}).select('+password');

    // 2. Check is user exists and if password is correct
    if(!user || !(await user.comparePassword(password))){
        throw new Error("Invalid email or password");
    }

    if (!user.isVerified) {
        res.status(403);
        throw new Error("Please verify your email address to login.");
    }

    // 3. Check if user is active
    if(!user.isActive){
        res.status(403) // Forbidden
        throw new Error("Account is disabled, Please contact support.");
    }

    // 4. Update last login time
    user.lastLoginAt = new Date()
    await user.save()

    // 5. Generate and set tokens
    const {access_token, refresh_token} = authService.generateTokens(user.id);
    authService.setRefreshTokenCookie(res, refresh_token);

    // 6. Normalize avatar and Save Response
    if (user.avatar) {
        const normalized = await normalizeAssetUrl(user.avatar);
        if (normalized !== user.avatar) {
            (user as any).avatar = normalized;
            await (user as any).save();
        }
    }

    res.json({
        success: true,
        data : {
            user : {
                id : user.id,
                name : user.name,
                firstName: user.firstName,
                lastName: user.lastName,
                email : user.email,
                avatar: user.avatar,
                role : user.role,
                credits: await creditService.getBalance(user.id),
            },
            access_token,
        },
        message : "Login Successful",
    });
});

export const getProfile = asyncHandler(async(req: AuthRequest, res: Response) => {
    const user = req.user!;
    
    // Normalize avatar and save back to DB if needed
    if (user.avatar) {
        const normalized = await normalizeAssetUrl(user.avatar);
        if (normalized !== user.avatar) {
            (user as any).avatar = normalized;
            await (user as any).save();
        }
    }

    res.json({
        success: true,
        data : {
            user : {
                id: user.id,
                name: user.name,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                company: user.company,
                youtubeChannel: user.youtubeChannel,
                notificationPreferences: user.notificationPreferences,
                credits: user.credits, // Already fetched in authenticate middleware
            },
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
    
    if (validatedData.avatar) {
        validatedData.avatar = await normalizeAssetUrl(validatedData.avatar);
    }

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
                credits: await creditService.getBalance(updatedUser.id),
            },
        },
        message: 'Profile updated successfully',
    });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;
    
    if (!token) {
        res.status(400);
        throw new Error('Verification token is required');
    }

    const user = await User.findOne({ 
        verificationToken: token, 
        verificationTokenExpires: { $gt: new Date() } 
    }).select('+verificationToken +verificationTokenExpires');

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired verification token');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.json({
        success: true,
        message: 'Email verified successfully. You can now login.'
    });
});

export const resendVerificationEmail = asyncHandler(async (req: Request, res: Response) => {
    const { email: rawEmail } = req.body;
    const email = rawEmail?.toLowerCase().trim();

    if (!email) {
        res.status(400);
        throw new Error('Email is required');
    }

    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (user.isVerified) {
        res.status(400);
        throw new Error('Email is already verified');
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.verificationToken = verificationToken;
    user.verificationTokenExpires = verificationTokenExpires;
    await user.save();

    try {
        logger.info(`Attempting to resend verification email to: ${user.email}`);
        await emailService.sendVerificationEmail(user.email, verificationToken);
        logger.info(`Verification email resent successfully to: ${user.email}`);
    } catch (error) {
        logger.error(`Failed to send verification email to ${user.email}:`, error);
        res.status(500);
        throw new Error('Failed to send verification email. Please try again.');
    }

    res.json({
        success: true,
        message: 'Verification email resent. Please check your inbox.'
    });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email: rawEmail } = req.body;
    const email = rawEmail?.toLowerCase().trim();

    if (!email) {
        res.status(400);
        throw new Error('Email is required');
    }

    const user = await User.findOne({ email });

    if (!user) {
        // For security reasons, don't reveal that the user doesn't exist
        res.json({
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent.'
        });
        return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpires;
    await user.save();

    try {
        await emailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (error) {
        res.status(500);
        throw new Error('Failed to send password reset email. Please try again.');
    }

    res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
    });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body;

    if (!token || !password) {
        res.status(400);
        throw new Error('Token and password are required');
    }

    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() }
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired reset token');
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
        success: true,
        message: 'Password reset successful. You can now login with your new password.'
    });
});

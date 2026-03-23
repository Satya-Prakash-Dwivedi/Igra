import type { Request, Response, NextFunction } from "express";
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/User.ts';
import type {IUser} from '../models/User.ts';
import dotenv from 'dotenv';

dotenv.config({ quiet: true })

// Extend express Request type to include the user
export interface AuthRequest extends Request {
    user?: IUser;
}

export const authenticate = asyncHandler(async(req: AuthRequest, res: Response, next : NextFunction) => {
    let token;

    // 1. Get token from authorization header (Format : "Bearer <token>")
    if(req.headers.authorization?.startsWith('Bearer')){
        token = req.headers.authorization?.split(' ')[1];
    }

    if(!token){
        res.status(401);
        throw new Error('Not authorized, No token provided');
    }

    try {
      // 2. Verify token
      const decoded : any = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!);

      // 3. Get user from db (minus password) and attach to request
      const user = await User.findById(decoded.id).select('-password');

      if(!user){
        res.status(401);
        throw new Error('User not found');
      }

      if(!user.isActive){
        res.status(403)
        throw new Error('User account is deactivated');
      }

      req.user = user;
      next();

    } catch (error) {
        res.status(401);
        throw new Error('Not authorized, token failed');
    };
});

export const authorize = (...roles: string[]) => {
    return(req: AuthRequest, res: Response, next: NextFunction) => {
        // 1. Check if user is attached to request
        if(!req.user){
            res.status(401);
            throw new Error('Not authorized, user information missing');
        }

        // 2. Check if user's role is allowed
        if(!roles.includes(req.user.role)){
            res.status(403);
            throw new Error(`User role ${req.user.role} is not authorized to access this resource`);
        }

        next();
    };
};

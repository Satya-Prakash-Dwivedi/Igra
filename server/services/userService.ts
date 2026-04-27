import User from '../models/User.js'
import type {IUser} from '../models/User.js'
import Order from '../models/Order.js'
import { SupportRequest } from '../models/SupportRequest.js'

export const createUser = async(userData : Partial<IUser>) => {
    // Check if user already exists
    const existingUser = await User.findOne({email : userData.email});
    if(existingUser){
        throw new Error('User already exists');
    }

    // Create new user
    return await User.create(userData);
}
/**
 * Update user profile
 * @param userId - ID of the user to update
 * @param updateData - Data to update
 * @returns Updated user document
 */
export const updateUserProfile = async (userId: string, updateData: any) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    // Map fields from flat input to nested structure
    if (updateData.firstName !== undefined) user.firstName = updateData.firstName;
    if (updateData.lastName !== undefined) user.lastName = updateData.lastName;
    if (updateData.avatar !== undefined) user.avatar = updateData.avatar;
    if (updateData.youtubeChannel !== undefined) user.youtubeChannel = updateData.youtubeChannel;

    if (updateData.companyName !== undefined) {
        user.company = {
            ...user.company,
            name: updateData.companyName
        };
    }

    if (updateData.notificationEmail !== undefined) {
        user.notificationPreferences = {
            ...user.notificationPreferences,
            email: updateData.notificationEmail
        };
    }

    return await user.save();
};

/**
 * List all staff and admin users
 */
export const listStaff = async () => {
    return await User.find({ role: { $in: ['admin', 'staff'] } })
        .select('name email role avatar')
        .sort({ name: 1 })
        .lean();
};

/**
 * List paginated users with their total orders
 */
export async function listUsers(page: number, limit: number, search: string, excludeUserId?: string) {
    const query: any = { role: { $in: ['user', 'staff'] } };
    
    if (excludeUserId) {
        query._id = { $ne: excludeUserId };
    }

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }

    const skip = (page - 1) * limit;

    const [users, totalCount] = await Promise.all([
        User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        User.countDocuments(query)
    ]);

    // Manually add totalOrders for now to verify basic list works
    const usersWithOrders = await Promise.all(users.map(async (user: any) => {
        const orderCount = await Order.countDocuments({ userId: user._id });
        return { ...user, totalOrders: orderCount };
    }));

    return {
        users: usersWithOrders,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
    };
}

export async function getUserDetail(userId: string) {
    const user = await User.findById(userId).select('-password').lean();
    if (!user) throw new Error('User not found');

    const [orders, tickets, bugs] = await Promise.all([
        Order.find({ userId }).sort({ createdAt: -1 }).lean(),
        SupportRequest.find({ userId }).sort({ createdAt: -1 }).lean(),
        SupportRequest.find({ userId, __t: 'BugReport' }).sort({ createdAt: -1 }).lean()
    ]);

    return { user, orders, tickets, bugs };
};

/**
 * Assign staff role to a user
 */
export const assignStaff = async (userId: string) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    
    user.role = 'staff';
    return await user.save();
};

/**
 * Remove staff role from a user
 */
export const removeStaff = async (userId: string) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    
    user.role = 'user';
    return await user.save();
};

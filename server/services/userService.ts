import User from '../models/User.js'
import type {IUser} from '../models/User.js'

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

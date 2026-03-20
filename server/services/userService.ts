import User from '../models/User.ts'
import type {IUser} from '../models/User.ts'

export const createUser = async(userData : Partial<IUser>) => {
    // Check if user already exists
    const existingUser = await User.findOne({email : userData.email});
    if(existingUser){
        throw new Error('User already exists');
    }

    // Create new user
    return await User.create(userData);
}


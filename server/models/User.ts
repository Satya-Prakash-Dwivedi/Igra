import { Schema, model, Document } from 'mongoose';
import bcrypt from 'bcrypt';

/*
 * Interface for User document
 */
export interface IUser extends Document {
  id: string; // Explicitly added for easier use in controllers
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
  avatar: string;
  role: 'user' | 'admin' | 'staff';
  isVerified: boolean;
  isActive: boolean;
  company: {
    name: string;
    logo?: string;
    website?: string;
    industry?: string;
  };
  youtubeChannel?: string;
  notificationPreferences: {
    email: boolean;
    inApp: boolean;
  };
  credits?: number;
  lastLoginAt?: Date;
  createdAt : Date;
  updatedAt : Date;

  comparePassword(enteredPassword : string) : Promise<boolean>
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxLength: [256, 'Name cannot exceed 256 characters'],
    },
    firstName: {
      type: String,
      trim: true,
      maxLength: [128, 'First name cannot exceed 128 characters'],
    },
    lastName: {
      type: String,
      trim: true,
      maxLength: [128, 'Last name cannot exceed 128 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, 
    },
    avatar: {
      type: String,
      default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    },
    role: {
      type: String,
      enum: {
        values: ['user', 'admin', 'staff'],
        message: '{VALUE} is not a valid role',
      },
      default: 'user',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    company: {
      name: { type: String, trim: true },
      logo: { type: String },
      website: { type: String },
      industry: { type: String },
    },
    youtubeChannel: {
      type: String,
      trim: true,
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
    },
    credits: {
      type: Number,
      default: 0,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
  }
);

userSchema.pre<IUser>('save', async function(){
  // Only hash the password if it's new or modified
  if(!this.isModified('password')){
    return;
  }
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error : any) {
    throw error;
  }
})

// Method to compare password for login
userSchema.methods.comparePassword = async function (enteredPassword : string) : Promise<boolean>{
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = model<IUser>('User', userSchema);

export default User;

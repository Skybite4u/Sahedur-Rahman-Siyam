export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface Post {
  id: string;
  content: string;
  imageUrl?: string;
  category: 'All' | 'Anime' | 'Coding' | 'Dhaka';
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorAvatar: string;
  createdAt: any; // Can be Firebase Timestamp or serialize format
  lovesCount: number;
  lovedBy: string[]; // List of user UIDs who loved this
}

export interface Comment {
  id: string;
  postId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorAvatar: string;
  createdAt: any;
}

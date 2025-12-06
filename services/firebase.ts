import { UserProfile } from '../types';

// Mocking Firebase Auth functionality since we don't have real credentials in this environment
export const mockUser: UserProfile = {
  uid: 'mock-user-123',
  displayName: 'Student User',
  email: 'student@campushelper.in',
  photoURL: 'https://picsum.photos/200',
  role: 'user' // Change to 'admin' to test admin features
};

export const mockAdminUser: UserProfile = {
  uid: 'mock-admin-999',
  displayName: 'Admin User',
  email: 'admin@campushelper.in',
  photoURL: 'https://picsum.photos/200',
  role: 'admin'
};

class MockAuthService {
  private currentUser: UserProfile | null = null;
  private listeners: ((user: UserProfile | null) => void)[] = [];

  constructor() {
    // Check local storage for persisted session
    const stored = localStorage.getItem('snist_user');
    if (stored) {
      this.currentUser = JSON.parse(stored);
    }
  }

  async signInWithGoogle(): Promise<UserProfile> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Randomly assign admin role for demonstration purposes if email contains 'admin'
    // For this mock, we'll just return the standard mockUser, unless we want to force admin
    // Let's toggle between them based on a random chance or fixed for stability
    this.currentUser = mockUser;
    
    localStorage.setItem('snist_user', JSON.stringify(this.currentUser));
    this.notifyListeners();
    return this.currentUser;
  }

  async signInAsAdmin(): Promise<UserProfile> {
     await new Promise(resolve => setTimeout(resolve, 800));
     this.currentUser = mockAdminUser;
     localStorage.setItem('snist_user', JSON.stringify(this.currentUser));
     this.notifyListeners();
     return this.currentUser;
  }

  async logout(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
    this.currentUser = null;
    localStorage.removeItem('snist_user');
    this.notifyListeners();
  }

  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.currentUser));
  }

  getCurrentUser() {
    return this.currentUser;
  }
}

export const authService = new MockAuthService();
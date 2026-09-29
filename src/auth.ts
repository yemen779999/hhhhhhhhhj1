import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signInAnonymously, browserPopupRedirectResolver } from 'firebase/auth';
import { initializeFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Suppress Firestore SDK network/offline connection warning logs in console
setLogLevel('debug');

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

const configObj: any = firebaseConfig;
const dbId = configObj.firestoreDatabaseId || configObj.default?.firestoreDatabaseId;

export const firestore = initializeFirestore(app, { experimentalForceLongPolling: true }, dbId);

const provider = new GoogleAuthProvider();

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};


export const registerWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    isSigningIn = true;
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } finally {
    isSigningIn = false;
  }
};

export const loginWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    isSigningIn = true;
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } finally {
    isSigningIn = false;
  }
};

export const resetPassword = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email);
};

export const guestLogin = async (): Promise<User> => {
  try {
    isSigningIn = true;
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } finally {
    isSigningIn = false;
  }
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      console.log('Sign in popup closed by user.');
      return null;
    }
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

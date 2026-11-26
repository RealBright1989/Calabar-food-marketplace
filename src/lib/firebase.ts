import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const ROOT_ADMIN_EMAIL = 'brightokon444@gmail.com';
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): FirestoreErrorInfo {
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function reportFirestoreListenerError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): void {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Listener Error: ', JSON.stringify(errInfo));
}

export function getFirestoreErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(message) as { error?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.length > 0) {
      return parsed.error;
    }
  } catch {
    return message;
  }
  return message;
}

export function getAuthErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const raw = `${code} ${message}`;

  if (raw.includes('auth/unauthorized-domain')) {
    const hostname =
      typeof window === 'undefined' || !window.location.hostname
        ? 'this address'
        : window.location.hostname;
    return (
      `Google sign-in is blocked on ${hostname}. Add ${hostname} in Firebase Console > ` +
      'Authentication > Settings > Authorized domains, then reload this page. ' +
      'You can also open the app on localhost, which Firebase allows by default.'
    );
  }
  if (raw.includes('auth/popup-blocked')) {
    return 'The sign-in popup was blocked. Allow popups for this site and try again.';
  }
  if (raw.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in was cancelled. Try again when ready.';
  }
  if (raw.includes('auth/network-request-failed')) {
    return 'Google sign-in could not reach the network. Check your connection and try again.';
  }
  if (raw.includes('auth/operation-not-allowed')) {
    return 'Google sign-in is not enabled for this Firebase project. Enable it in Firebase Console > Authentication > Sign-in method.';
  }
  return message || 'Could not complete Google sign-in. Please try again.';
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

void testConnection();

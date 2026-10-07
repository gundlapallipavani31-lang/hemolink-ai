"use client";

import {
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { auth, db } from "@/lib/firebase";
import { normalizeRole, type AppRole, type UserProfile } from "@/types/auth";

type AuthContextValue = {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  role: AppRole | null;
  profileError: string | null;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;

      setFirebaseUser(user);
      setUserProfile(null);
      setProfileError(null);

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const profileSnapshot = await getDoc(doc(db, "users", user.uid));

        if (!active) return;

        if (!profileSnapshot.exists()) {
          setProfileError(
            "Your account is signed in, but your profile is not available yet.",
          );
          return;
        }

        const profileData = profileSnapshot.data();
        setUserProfile({
          name: typeof profileData.name === "string" ? profileData.name : "",
          email:
            typeof profileData.email === "string"
              ? profileData.email
              : user.email ?? "",
          phone: typeof profileData.phone === "string" ? profileData.phone : "",
          role: normalizeRole(profileData.role),
          requestedRole:
            typeof profileData.requestedRole === "string"
              ? profileData.requestedRole
              : "",
          organizationId:
            typeof profileData.organizationId === "string"
              ? profileData.organizationId
              : undefined,
          status:
            typeof profileData.status === "string"
              ? profileData.status
              : undefined,
          createdAt: profileData.createdAt,
          updatedAt: profileData.updatedAt,
        });
      } catch {
        if (active) {
          setProfileError(
            "We could not load your profile. Please refresh and try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      userProfile,
      loading,
      isAuthenticated: firebaseUser !== null,
      role: userProfile?.role ?? null,
      profileError,
    }),
    [firebaseUser, loading, profileError, userProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

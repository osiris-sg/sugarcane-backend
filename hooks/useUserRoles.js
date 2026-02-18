"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

// Cache for user roles (shared across hook instances)
let rolesCache = null;
let rolesCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to get current user's roles from the database
 * Returns { roles, isAdmin, isDriver, isOpsManager, isLoading }
 */
export function useUserRoles() {
  const { isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const [data, setData] = useState({
    roles: [],
    isAdmin: false,
    isDriver: false,
    isOpsManager: false,
    isActive: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRoles() {
      // Wait for Clerk to load
      if (!isClerkLoaded) return;

      // If not signed in, return empty roles
      if (!isSignedIn) {
        setData({
          roles: [],
          isAdmin: false,
          isDriver: false,
          isOpsManager: false,
          isActive: false,
        });
        setIsLoading(false);
        return;
      }

      // Check cache
      const now = Date.now();
      if (rolesCache && (now - rolesCacheTime) < CACHE_DURATION) {
        setData(rolesCache);
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/me/roles');
        const result = await res.json();

        if (result.success) {
          const newData = {
            roles: result.roles || [],
            isAdmin: result.isAdmin || false,
            isDriver: result.isDriver || false,
            isOpsManager: result.isOpsManager || false,
            isActive: result.isActive ?? true,
          };

          // Update cache
          rolesCache = newData;
          rolesCacheTime = now;

          setData(newData);
        }
      } catch (error) {
        console.error('Error fetching user roles:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRoles();
  }, [isClerkLoaded, isSignedIn]);

  return {
    ...data,
    isLoading,
    isLoaded: !isLoading,
  };
}

/**
 * Clear the roles cache (call this after role changes)
 */
export function clearRolesCache() {
  rolesCache = null;
  rolesCacheTime = 0;
}

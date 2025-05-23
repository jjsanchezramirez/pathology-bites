// src/components/admin/auth-status.tsx
'use client'

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, User as UserIcon, AlertCircle, CheckCircle2, LogOut } from 'lucide-react';
import { Database } from '@/types/supabase';

interface UserProfile {
  id: string;
  email: string | null;
  role: string;
  first_name: string | null;
  last_name: string | null;
}

export function AuthStatus() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const supabase = createClientComponentClient<Database>();

  const checkAuthStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Checking auth status...');
      
      // Check current user session
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('❌ Auth error:', userError);
        setError(userError.message);
        setUser(null);
        setUserProfile(null);
        return;
      }

      setUser(user);
      console.log('👤 User from auth:', user?.email || 'None');

      if (user) {
        // Get user profile from database
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('id, email, role, first_name, last_name')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('❌ Profile error:', profileError);
          setError(`Profile error: ${profileError.message}`);
          setUserProfile(null);
        } else {
          console.log('✅ Profile loaded:', profile);
          setUserProfile(profile);
        }
      } else {
        setUserProfile(null);
      }

    } catch (err) {
      console.error('❌ Exception:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setLastChecked(new Date());
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
      window.location.href = '/auth/login'; // Redirect to login page
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session?.user?.email || 'No user');
        await checkAuthStatus();
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const getStatusColor = () => {
    if (loading) return 'gray';
    if (error) return 'red';
    if (user && userProfile?.role === 'admin') return 'green';
    if (user) return 'yellow';
    return 'red';
  };

  const getStatusText = () => {
    if (loading) return 'Checking...';
    if (error) return 'Error';
    if (user && userProfile?.role === 'admin') return 'Admin Authenticated';
    if (user && userProfile) return `Authenticated (${userProfile.role})`;
    if (user) return 'Authenticated (No Profile)';
    return 'Not Authenticated';
  };

  const getStatusIcon = () => {
    if (loading) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (error) return <AlertCircle className="h-4 w-4" />;
    if (user && userProfile?.role === 'admin') return <CheckCircle2 className="h-4 w-4" />;
    if (user) return <UserIcon className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Authentication Status</CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={checkAuthStatus}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {user && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <Badge variant={
            getStatusColor() === 'green' ? 'default' :
            getStatusColor() === 'yellow' ? 'secondary' :
            getStatusColor() === 'red' ? 'destructive' : 'outline'
          }>
            {getStatusText()}
          </Badge>
        </div>

        {/* User Details */}
        {user && (
          <div className="space-y-2 text-sm">
            <div>
              <strong>Email:</strong> {user.email || 'N/A'}
            </div>
            <div>
              <strong>User ID:</strong> {user.id}
            </div>
            {userProfile && (
              <>
                <div>
                  <strong>Role:</strong> {userProfile.role}
                </div>
                {userProfile.first_name && (
                  <div>
                    <strong>Name:</strong> {userProfile.first_name} {userProfile.last_name}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* No User State */}
        {!user && !loading && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
            <strong>Not logged in</strong> - You need to authenticate to access admin features.
            <div className="mt-2">
              <Button size="sm" asChild>
                <a href="/auth/login">Go to Login</a>
              </Button>
            </div>
          </div>
        )}

        {/* Last Checked */}
        <div className="text-xs text-muted-foreground">
          Last checked: {lastChecked.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}
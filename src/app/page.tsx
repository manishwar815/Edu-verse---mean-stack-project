"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { RegisterForm } from '@/components/RegisterForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GraduationCap, BookOpen, Users, Bell } from 'lucide-react';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <GraduationCap className="h-12 w-12 text-primary" />
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                EduVerse
              </h1>
            </div>
            <p className="text-xl text-muted-foreground mb-2">College Student Portal</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              A centralized platform for students, faculty, and administrators to manage assignments, 
              notices, and academic activities seamlessly.
            </p>
          </div>

          <Tabs defaultValue="login" className="w-full max-w-md">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <LoginForm />
            </TabsContent>
            <TabsContent value="register">
              <RegisterForm />
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-4xl">
            <div className="text-center p-6 rounded-lg bg-card border">
              <BookOpen className="h-8 w-8 mx-auto mb-3 text-blue-600" />
              <h3 className="font-semibold mb-2">Assignment Management</h3>
              <p className="text-sm text-muted-foreground">
                Submit and track assignments with ease
              </p>
            </div>
            <div className="text-center p-6 rounded-lg bg-card border">
              <Bell className="h-8 w-8 mx-auto mb-3 text-purple-600" />
              <h3 className="font-semibold mb-2">Notice Board</h3>
              <p className="text-sm text-muted-foreground">
                Stay updated with latest announcements
              </p>
            </div>
            <div className="text-center p-6 rounded-lg bg-card border">
              <Users className="h-8 w-8 mx-auto mb-3 text-green-600" />
              <h3 className="font-semibold mb-2">Role-Based Access</h3>
              <p className="text-sm text-muted-foreground">
                Custom dashboards for students, faculty & admin
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
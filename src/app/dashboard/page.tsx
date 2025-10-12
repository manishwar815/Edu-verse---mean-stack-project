"use client";

import { useAuth } from '@/lib/auth-context';
import { StudentDashboard } from '@/components/dashboards/StudentDashboard';
import { FacultyDashboard } from '@/components/dashboards/FacultyDashboard';
import { AdminDashboard } from '@/components/dashboards/AdminDashboard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { LogOut, GraduationCap } from 'lucide-react';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">EduVerse</h1>
                <p className="text-sm text-muted-foreground">College Student Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {user.role} • {user.department}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold capitalize">{user.role} Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user.name.split(' ')[0]}!
          </p>
        </div>

        {user.role === 'student' && <StudentDashboard />}
        {user.role === 'faculty' && <FacultyDashboard />}
        {user.role === 'admin' && <AdminDashboard />}
      </main>
    </div>
  );
}
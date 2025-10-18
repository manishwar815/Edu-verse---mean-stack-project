"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { 
  CalendarDays, 
  Cloud, 
  CloudRain, 
  Sun, 
  ChevronRight,
  Calendar,
  Banknote,
  PartyPopper,
  Users,
  Home,
  Map,
  MessageCircle,
  User
} from 'lucide-react';
import Link from 'next/link';

interface ActionItem {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  category: string;
  link?: string;
}

interface AttendanceData {
  summary: {
    overallPercentage: number;
    totalAttended: number;
    totalClasses: number;
  };
}

interface FeeSummary {
  totalDue: number;
  pendingCount: number;
}

export function StudentDashboard() {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { token, user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  const fetchDashboardData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch action centre items (only active)
      const actionRes = await fetch('/api/action-centre?status=active&limit=3', { headers });
      if (actionRes.ok) {
        const actionData = await actionRes.json();
        setActionItems(actionData);
      }

      // Fetch attendance summary
      const attendanceRes = await fetch('/api/attendance', { headers });
      if (attendanceRes.ok) {
        const attendanceData = await attendanceRes.json();
        setAttendance(attendanceData);
      }

      // Fetch fee summary
      const feeRes = await fetch('/api/fees?status=pending', { headers });
      if (feeRes.ok) {
        const feeData = await feeRes.json();
        const totalDue = feeData.reduce((sum: number, fee: any) => sum + fee.amount, 0);
        setFeeSummary({ totalDue, pendingCount: feeData.length });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatDate = () => {
    return currentTime.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 pb-20">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Greeting Section with Weather */}
      <Card className="border-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-1">
                Hi {user?.name.split(' ')[0]} 👋
              </h2>
              <p className="text-muted-foreground mb-4">
                {getGreeting()}, {formatDate()}
              </p>
              <Link href="/dashboard/schedule">
                <Button variant="outline" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  View Schedule
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end mb-1">
                <Sun className="h-6 w-6 text-amber-500" />
                <span className="text-3xl font-bold">29°C</span>
              </div>
              <p className="text-sm text-muted-foreground">Partly Cloudy</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Centre */}
      {actionItems.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 px-1">ACTION CENTRE</h3>
          <div className="space-y-3">
            {actionItems.map((item) => (
              <Card key={item.id} className="bg-gray-900 dark:bg-gray-950 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{item.title}</h4>
                      <p className="text-sm text-gray-300 mb-2">{item.description}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        📅 Dates: {formatDateRange(item.startDate, item.endDate)}
                      </p>
                    </div>
                    {item.link && (
                      <Button 
                        variant="secondary" 
                        size="sm"
                        className="ml-4"
                        asChild
                      >
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          View
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Essentials */}
      <div>
        <h3 className="text-lg font-semibold mb-3 px-1">ESSENTIALS</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Attendance Card */}
          <Link href="/dashboard/attendance">
            <Card className="bg-green-50 dark:bg-green-950 border-green-100 dark:border-green-900 hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-green-500 rounded-xl">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg mb-1">Attendance</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Attendance
                    </p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                      {attendance?.summary?.overallPercentage || 0}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      As on {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground mt-6" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Fee Payments Card */}
          <Link href="/dashboard/fees">
            <Card className="bg-pink-50 dark:bg-pink-950 border-pink-100 dark:border-pink-900 hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-pink-500 rounded-xl">
                    <Banknote className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg mb-1">Fee Payments</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Dues
                    </p>
                    <p className="text-2xl font-bold text-pink-700 dark:text-pink-400">
                      INR {feeSummary?.totalDue?.toFixed(2) || '0.00'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      As on {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground mt-6" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Campus Events Card */}
          <Link href="/dashboard/events">
            <Card className="bg-purple-50 dark:bg-purple-950 border-purple-100 dark:border-purple-900 hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-purple-500 rounded-xl">
                    <PartyPopper className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">Campus Events</h4>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground mt-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Campus Clubs Card */}
          <Link href="/dashboard/clubs">
            <Card className="bg-cyan-50 dark:bg-cyan-950 border-cyan-100 dark:border-cyan-900 hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-cyan-500 rounded-xl">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">Campus Clubs</h4>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground mt-2" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Bottom Navigation Bar - Fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-around py-3">
            <Link href="/dashboard" className="flex flex-col items-center gap-1 text-primary">
              <div className="p-2 bg-primary/10 rounded-full">
                <Home className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">Home</span>
            </Link>
            
            <Link href="/dashboard/schedule" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <CalendarDays className="h-5 w-5" />
              <span className="text-xs">Calendar</span>
            </Link>
            
            <Link href="/dashboard/courses" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <Map className="h-5 w-5" />
              <span className="text-xs">Courses</span>
            </Link>
            
            <Link href="/dashboard/chats" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <MessageCircle className="h-5 w-5" />
              <span className="text-xs">Chats</span>
            </Link>
            
            <Link href="/dashboard/account" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <User className="h-5 w-5" />
              <span className="text-xs">Account</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
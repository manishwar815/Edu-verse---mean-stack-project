"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { Users, BookOpen, FileCheck, Bell, TrendingUp, Building } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DashboardStats {
  totalUsers: number;
  totalStudents: number;
  totalFaculty: number;
  totalAssignments: number;
  totalSubmissions: number;
  totalNotices: number;
  departmentBreakdown: {
    department: string;
    studentCount: number;
    facultyCount: number;
    assignmentCount: number;
  }[];
  recentActivity: any[];
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    fetchStats();
  }, [token]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.totalStudents || 0} students, {stats?.totalFaculty || 0} faculty
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assignments</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalAssignments || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.totalSubmissions || 0} submissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notices</CardTitle>
            <Bell className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalNotices || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Total announcements</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Department Overview
            </CardTitle>
            <CardDescription>Statistics by department</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.departmentBreakdown && stats.departmentBreakdown.length > 0 ? (
              <div className="space-y-4">
                {stats.departmentBreakdown.map((dept) => (
                  <div key={dept.department} className="border-b pb-3 last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{dept.department}</p>
                      <Badge variant="secondary">{dept.assignmentCount} assignments</Badge>
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>{dept.studentCount} students</span>
                      <span>{dept.facultyCount} faculty</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No department data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest submissions across all departments</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {stats.recentActivity.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="border-b pb-2 last:border-0">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{activity.studentName}</p>
                        <p className="text-xs text-muted-foreground">{activity.assignmentTitle}</p>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">{activity.studentDepartment}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(activity.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Recent Submissions</CardTitle>
          <CardDescription>Complete submission history</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>File</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentActivity.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{activity.studentName}</TableCell>
                    <TableCell>{activity.assignmentTitle}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{activity.studentDepartment}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(activity.submittedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <a
                        href={activity.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No submissions yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
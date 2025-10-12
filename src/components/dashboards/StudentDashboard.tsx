"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { BookOpen, CheckCircle, Clock, Bell, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DashboardStats {
  totalAssignments: number;
  submittedAssignments: number;
  pendingAssignments: number;
  recentNotices: any[];
  upcomingAssignments: any[];
}

export function StudentDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleSubmitAssignment = async () => {
    if (!fileUrl || !selectedAssignment) return;
    
    setSubmitError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/assignments/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assignmentId: selectedAssignment.id,
          fileUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Submission failed');
      }

      setSubmitDialogOpen(false);
      setFileUrl('');
      setSelectedAssignment(null);
      fetchStats();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalAssignments || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submitted</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.submittedAssignments || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingAssignments || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Upcoming Assignments
            </CardTitle>
            <CardDescription>Assignments due soon</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.upcomingAssignments && stats.upcomingAssignments.length > 0 ? (
              <div className="space-y-4">
                {stats.upcomingAssignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-start justify-between border-b pb-3 last:border-0">
                    <div className="space-y-1">
                      <p className="font-medium">{assignment.title}</p>
                      <p className="text-sm text-muted-foreground">{assignment.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Due: {new Date(assignment.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Dialog open={submitDialogOpen && selectedAssignment?.id === assignment.id} onOpenChange={(open) => {
                      setSubmitDialogOpen(open);
                      if (!open) {
                        setSelectedAssignment(null);
                        setFileUrl('');
                        setSubmitError('');
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button size="sm" onClick={() => setSelectedAssignment(assignment)}>
                          <Upload className="h-4 w-4 mr-1" />
                          Submit
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Submit Assignment</DialogTitle>
                          <DialogDescription>{assignment.title}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          {submitError && (
                            <Alert variant="destructive">
                              <AlertDescription>{submitError}</AlertDescription>
                            </Alert>
                          )}
                          <div className="space-y-2">
                            <Label htmlFor="fileUrl">File URL</Label>
                            <Input
                              id="fileUrl"
                              placeholder="https://drive.google.com/..."
                              value={fileUrl}
                              onChange={(e) => setFileUrl(e.target.value)}
                              disabled={isSubmitting}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleSubmitAssignment} disabled={isSubmitting || !fileUrl}>
                            {isSubmitting ? 'Submitting...' : 'Submit'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming assignments</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Recent Notices
            </CardTitle>
            <CardDescription>Latest announcements</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentNotices && stats.recentNotices.length > 0 ? (
              <div className="space-y-4">
                {stats.recentNotices.map((notice) => (
                  <div key={notice.id} className="border-b pb-3 last:border-0">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium">{notice.title}</p>
                      <Badge variant="secondary">{notice.department}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{notice.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(notice.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent notices</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
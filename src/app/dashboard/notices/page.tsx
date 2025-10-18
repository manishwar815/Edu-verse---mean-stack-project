"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Notice {
  id: string;
  title: string;
  content: string;
  department: string;
  year: string;
  postedBy: string;
  imageUrl?: string;
  createdAt: string;
}

const categories = [
  { id: 'all', label: 'All', value: '' },
  { id: 'general', label: 'General', value: 'general' },
  { id: 'academics', label: 'Academics', value: 'academics' },
  { id: 'opportunities', label: 'Opportunities', value: 'opportunities' },
  { id: 'events', label: 'Events', value: 'events' }
];

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [filteredNotices, setFilteredNotices] = useState<Notice[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('feed');
  const [isLoading, setIsLoading] = useState(true);
  const { token, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (token) {
      fetchNotices();
    }
  }, [token]);

  useEffect(() => {
    filterNotices();
  }, [selectedCategory, notices, activeTab]);

  const fetchNotices = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await fetch('/api/notices', { headers });
      
      if (response.ok) {
        const data = await response.json();
        setNotices(data);
      }
    } catch (error) {
      console.error('Failed to fetch notices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterNotices = () => {
    let filtered = notices;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(notice => 
        notice.department.toLowerCase().includes(selectedCategory) ||
        notice.title.toLowerCase().includes(selectedCategory) ||
        notice.content.toLowerCase().includes(selectedCategory)
      );
    }

    // Filter by tab (Feed shows all, Announcements shows department-specific)
    if (activeTab === 'announcements' && user) {
      filtered = filtered.filter(notice => 
        notice.department === user.department || notice.department === 'All'
      );
    }

    setFilteredNotices(filtered);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-card border-b sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-64" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Digital Notice Board</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="container mx-auto px-4 pt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="feed">Feed</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
          </TabsList>

          {/* Category Filters */}
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="whitespace-nowrap"
              >
                {category.label}
              </Button>
            ))}
          </div>

          <TabsContent value="feed" className="space-y-4 mt-0">
            {filteredNotices.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No notices available</p>
                </CardContent>
              </Card>
            ) : (
              filteredNotices.map((notice) => (
                <Card key={notice.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    {/* Author Info */}
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(notice.postedBy)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{notice.postedBy}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(notice.createdAt)}, {formatTime(notice.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Notice Title */}
                    <h3 className="font-bold text-lg mb-2">{notice.title}</h3>

                    {/* Notice Content */}
                    <p className="text-muted-foreground text-sm mb-3 whitespace-pre-wrap">
                      {notice.content}
                    </p>

                    {/* Notice Image */}
                    {notice.imageUrl && (
                      <div className="relative w-full h-64 mb-3 rounded-lg overflow-hidden">
                        <Image
                          src={notice.imageUrl}
                          alt={notice.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}

                    {/* Tags */}
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary">{notice.department}</Badge>
                      {notice.year && notice.year !== 'All' && (
                        <Badge variant="outline">{notice.year}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="announcements" className="space-y-4 mt-0">
            {filteredNotices.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No announcements for your department</p>
                </CardContent>
              </Card>
            ) : (
              filteredNotices.map((notice) => (
                <Card key={notice.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    {/* Author Info */}
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(notice.postedBy)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{notice.postedBy}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(notice.createdAt)}, {formatTime(notice.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Notice Title */}
                    <h3 className="font-bold text-lg mb-2">{notice.title}</h3>

                    {/* Notice Content */}
                    <p className="text-muted-foreground text-sm mb-3 whitespace-pre-wrap">
                      {notice.content}
                    </p>

                    {/* Notice Image */}
                    {notice.imageUrl && (
                      <div className="relative w-full h-64 mb-3 rounded-lg overflow-hidden">
                        <Image
                          src={notice.imageUrl}
                          alt={notice.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}

                    {/* Tags */}
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary">{notice.department}</Badge>
                      {notice.year && notice.year !== 'All' && (
                        <Badge variant="outline">{notice.year}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
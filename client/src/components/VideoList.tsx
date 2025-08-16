import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { Video, UploadStatus } from '../../../server/src/schema';

interface VideoListProps {
  videos: Video[];
  isLoading: boolean;
  onVideoSelect: (videoId: number) => void;
  onRefresh: () => void;
}

const statusConfig: Record<UploadStatus, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '⏳' },
  uploaded: { label: 'Uploaded', color: 'bg-green-100 text-green-800 border-green-200', icon: '✅' },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '⚙️' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800 border-red-200', icon: '❌' }
};

export function VideoList({ videos, isLoading, onVideoSelect, onRefresh }: VideoListProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-6 w-20" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🎬</div>
        <h3 className="text-lg font-medium mb-2">No videos uploaded yet</h3>
        <p className="text-gray-500 mb-6">
          Upload your first video to get started with translation
        </p>
        <Button onClick={onRefresh} variant="outline">
          🔄 Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {videos.length} video{videos.length !== 1 ? 's' : ''} found
        </p>
        <Button onClick={onRefresh} variant="outline" size="sm">
          🔄 Refresh
        </Button>
      </div>

      <div className="space-y-4">
        {videos.map((video: Video) => {
          const status = statusConfig[video.upload_status];
          
          return (
            <Card key={video.id} className="transition-all duration-200 hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      🎥 {video.original_filename}
                    </CardTitle>
                    <p className="text-xs text-gray-500">
                      Uploaded {getTimeAgo(video.uploaded_at)}
                    </p>
                  </div>
                  <Badge className={`${status.color} border`}>
                    {status.icon} {status.label}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Size:</span>
                    <div className="font-medium">{formatFileSize(video.file_size)}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Duration:</span>
                    <div className="font-medium">{formatDuration(video.duration)}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Format:</span>
                    <div className="font-medium uppercase">{video.format}</div>
                  </div>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button 
                    onClick={() => onVideoSelect(video.id)}
                    className="flex-1"
                    variant={video.upload_status === 'uploaded' ? 'default' : 'secondary'}
                    disabled={video.upload_status !== 'uploaded'}
                  >
                    {video.upload_status === 'uploaded' ? '🌍 Translate' : '⏳ Processing...'}
                  </Button>
                  <Button variant="outline" size="sm">
                    📊 Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
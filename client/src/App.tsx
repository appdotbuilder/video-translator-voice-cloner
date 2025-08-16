import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VideoUpload } from '@/components/VideoUpload';
import { VideoList } from '@/components/VideoList';
import { TranslationWorkflow } from '@/components/TranslationWorkflow';
import { trpc } from '@/utils/trpc';
import type { Video } from '../../server/src/schema';

function App() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadVideos = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await trpc.getVideos.query();
      setVideos(result);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleVideoUploaded = (newVideo: Video) => {
    setVideos((prev: Video[]) => [newVideo, ...prev]);
    setSelectedVideoId(newVideo.id);
  };

  const handleVideoSelect = (videoId: number) => {
    setSelectedVideoId(videoId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            🎬 Video Voice Translator
          </h1>
          <p className="text-gray-600 text-lg">
            Upload videos, translate audio, and generate voice-cloned speech in any language
          </p>
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              📤 Upload & Translate
            </TabsTrigger>
            <TabsTrigger value="library" className="flex items-center gap-2">
              📚 Video Library
            </TabsTrigger>
            <TabsTrigger value="workflow" className="flex items-center gap-2">
              ⚡ Workflow Status
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🎥 Upload Your Video
                </CardTitle>
                <CardDescription>
                  Upload a video file to start the translation process. Supported formats: MP4, AVI, MOV
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VideoUpload onVideoUploaded={handleVideoUploaded} />
              </CardContent>
            </Card>

            {selectedVideoId && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🌍 Translation Settings
                  </CardTitle>
                  <CardDescription>
                    Configure translation settings for your video
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TranslationWorkflow videoId={selectedVideoId} />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="library" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📚 Your Video Library
                </CardTitle>
                <CardDescription>
                  Manage all your uploaded videos and their translation status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VideoList
                  videos={videos}
                  isLoading={isLoading}
                  onVideoSelect={handleVideoSelect}
                  onRefresh={loadVideos}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflow" className="space-y-6">
            {selectedVideoId ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    ⚡ Translation Workflow Status
                  </CardTitle>
                  <CardDescription>
                    Monitor the progress of your video translation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TranslationWorkflow videoId={selectedVideoId} showDetailedStatus={true} />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="text-6xl mb-4">🎯</div>
                  <h3 className="text-lg font-medium mb-2">No Video Selected</h3>
                  <p className="text-gray-500">
                    Select a video from your library or upload a new one to view workflow status
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
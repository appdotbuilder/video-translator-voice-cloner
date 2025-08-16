import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { trpc } from '@/utils/trpc';
import type { Video, CreateVideoInput } from '../../../server/src/schema';

interface VideoUploadProps {
  onVideoUploaded: (video: Video) => void;
}

export function VideoUpload({ onVideoUploaded }: VideoUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    // Validate file type
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid video file (MP4, AVI, MOV)');
      return;
    }

    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be less than 100MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const simulateUploadProgress = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev: number) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + Math.random() * 15;
      });
    }, 200);
    return interval;
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);
    
    const progressInterval = simulateUploadProgress();

    try {
      // Simulate file upload and processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get video duration (stub implementation)
      const duration = Math.floor(Math.random() * 300) + 60; // Random duration between 1-6 minutes

      const videoInput: CreateVideoInput = {
        filename: `video_${Date.now()}.${selectedFile.name.split('.').pop()}`,
        original_filename: selectedFile.name,
        file_path: `/uploads/videos/video_${Date.now()}.${selectedFile.name.split('.').pop()}`,
        file_size: selectedFile.size,
        duration: duration,
        format: selectedFile.type.split('/')[1]
      };

      const video = await trpc.createVideo.mutate(videoInput);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      onVideoUploaded(video);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      clearInterval(progressInterval);
      setError('Failed to upload video. Please try again.');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      if (!error) {
        setTimeout(() => setUploadProgress(0), 1000);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <Card 
        className={`transition-all duration-200 cursor-pointer ${
          dragActive 
            ? 'border-purple-300 bg-purple-50 border-2' 
            : 'border-dashed border-2 border-gray-300 hover:border-purple-300 hover:bg-purple-50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-6xl mb-4">🎬</div>
          <h3 className="text-lg font-semibold mb-2">
            {selectedFile ? selectedFile.name : 'Drop your video here'}
          </h3>
          <p className="text-gray-500 text-center mb-4">
            {selectedFile 
              ? `${formatFileSize(selectedFile.size)} • ${selectedFile.type}`
              : 'or click to browse files'
            }
          </p>
          <p className="text-sm text-gray-400">
            Supports MP4, AVI, MOV • Max 100MB
          </p>
        </CardContent>
      </Card>

      <Input
        type="file"
        accept="video/*"
        onChange={handleFileInputChange}
        ref={fileInputRef}
        className="hidden"
      />

      {/* File Info & Upload Button */}
      {selectedFile && !isUploading && (
        <div className="space-y-3">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">📁 File Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div>Size: {formatFileSize(selectedFile.size)}</div>
              <div>Type: {selectedFile.type}</div>
            </div>
          </div>
          
          <Button 
            onClick={handleUpload} 
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            size="lg"
          >
            🚀 Upload Video
          </Button>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Uploading {selectedFile?.name}...</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <Progress value={uploadProgress} className="w-full" />
          <p className="text-xs text-gray-500 text-center">
            Processing video and extracting metadata...
          </p>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
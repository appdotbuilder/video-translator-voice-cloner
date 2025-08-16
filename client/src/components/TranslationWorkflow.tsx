import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import type { 
  Language, 
  CreateTranslationJobInput
} from '../../../server/src/schema';
import type { WorkflowStatus } from '../../../server/src/handlers/get_translation_workflow_status';

interface TranslationWorkflowProps {
  videoId: number;
  showDetailedStatus?: boolean;
}

const languages: Record<Language, { name: string; flag: string }> = {
  en: { name: 'English', flag: '🇺🇸' },
  es: { name: 'Spanish', flag: '🇪🇸' },
  fr: { name: 'French', flag: '🇫🇷' },
  de: { name: 'German', flag: '🇩🇪' },
  it: { name: 'Italian', flag: '🇮🇹' },
  pt: { name: 'Portuguese', flag: '🇵🇹' },
  ru: { name: 'Russian', flag: '🇷🇺' },
  zh: { name: 'Chinese', flag: '🇨🇳' },
  ja: { name: 'Japanese', flag: '🇯🇵' },
  ko: { name: 'Korean', flag: '🇰🇷' },
  ar: { name: 'Arabic', flag: '🇸🇦' },
  hi: { name: 'Hindi', flag: '🇮🇳' }
};

const statusIcons = {
  not_started: '⭕',
  uploading: '📤',
  translating: '🌍',
  generating_audio: '🎵',
  completed: '✅',
  failed: '❌'
};

export function TranslationWorkflow({ videoId, showDetailedStatus = false }: TranslationWorkflowProps) {
  const [sourceLanguage, setSourceLanguage] = useState<Language>('en');
  const [targetLanguage, setTargetLanguage] = useState<Language>('es');
  const [voiceCloned, setVoiceCloned] = useState<boolean>(true);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [isStartingTranslation, setIsStartingTranslation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkflowStatus = useCallback(async () => {
    try {
      const status = await trpc.getTranslationWorkflowStatus.query(videoId);
      setWorkflowStatus(status);
    } catch (error) {
      console.error('Failed to load workflow status:', error);
    }
  }, [videoId]);

  useEffect(() => {
    loadWorkflowStatus();
    const interval = setInterval(loadWorkflowStatus, 3000);
    return () => clearInterval(interval);
  }, [loadWorkflowStatus]);

  const startTranslation = async () => {
    if (sourceLanguage === targetLanguage) {
      setError('Source and target languages must be different');
      return;
    }

    setIsStartingTranslation(true);
    setError(null);

    try {
      const translationJobInput: CreateTranslationJobInput = {
        video_id: videoId,
        source_language: sourceLanguage,
        target_language: targetLanguage
      };

      const translationJob = await trpc.createTranslationJob.mutate(translationJobInput);

      const audioJobInput = {
        translation_job_id: translationJob.id,
        voice_cloned: voiceCloned
      };

      await trpc.createAudioGenerationJob.mutate(audioJobInput);
      await loadWorkflowStatus();
    } catch (error) {
      setError('Failed to start translation process. Please try again.');
      console.error('Translation error:', error);
    } finally {
      setIsStartingTranslation(false);
    }
  };

  const isTranslationInProgress = Boolean(workflowStatus && 
    ['translating', 'generating_audio', 'uploading'].includes(workflowStatus.overallStatus));

  const canStartTranslation = Boolean(workflowStatus?.video?.upload_status === 'uploaded' && 
    workflowStatus.overallStatus === 'not_started');

  return (
    <div className="space-y-6">
      {!showDetailedStatus && (
        <div className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source-lang">🎤 Source Language</Label>
              <Select value={sourceLanguage} onValueChange={(value: Language) => setSourceLanguage(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(languages).map(([code, lang]) => (
                    <SelectItem key={code} value={code}>
                      {lang.flag} {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-lang">🌍 Target Language</Label>
              <Select value={targetLanguage} onValueChange={(value: Language) => setTargetLanguage(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(languages).map(([code, lang]) => (
                    <SelectItem key={code} value={code}>
                      {lang.flag} {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2 p-4 bg-blue-50 rounded-lg">
            <Switch
              id="voice-cloning"
              checked={voiceCloned}
              onCheckedChange={setVoiceCloned}
            />
            <div className="space-y-1">
              <Label htmlFor="voice-cloning" className="text-sm font-medium">
                🎭 Enable Voice Cloning
              </Label>
              <p className="text-xs text-gray-600">
                Clone the original speaker's voice characteristics in the target language
              </p>
            </div>
          </div>
        </div>
      )}

      {workflowStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {statusIcons[workflowStatus.overallStatus]} Translation Status
            </CardTitle>
            <CardDescription>
              Current progress of your video translation workflow
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="capitalize">{workflowStatus.overallStatus.replace('_', ' ')}</span>
                <span>{workflowStatus.progress}%</span>
              </div>
              <Progress value={workflowStatus.progress} className="w-full" />
            </div>

            {showDetailedStatus && (
              <div className="space-y-4">
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">📤 Video Upload</h4>
                    <Badge 
                      variant={workflowStatus.video?.upload_status === 'uploaded' ? 'default' : 'secondary'}
                      className="w-full justify-center"
                    >
                      {workflowStatus.video?.upload_status || 'pending'}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">🌍 Translation</h4>
                    <Badge 
                      variant={workflowStatus.translationJob?.status === 'completed' ? 'default' : 'secondary'}
                      className="w-full justify-center"
                    >
                      {workflowStatus.translationJob?.status || 'not started'}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">🎵 Audio Generation</h4>
                    <Badge 
                      variant={workflowStatus.audioGenerationJob?.status === 'completed' ? 'default' : 'secondary'}
                      className="w-full justify-center"
                    >
                      {workflowStatus.audioGenerationJob?.status || 'not started'}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">🎬 Final Video</h4>
                    <Badge 
                      variant={workflowStatus.finalOutput ? 'default' : 'secondary'}
                      className="w-full justify-center"
                    >
                      {workflowStatus.finalOutput ? 'ready' : 'pending'}
                    </Badge>
                  </div>
                </div>

                {workflowStatus.translationJob && (
                  <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                    <h4 className="font-medium text-sm">Translation Details</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">From:</span> {languages[workflowStatus.translationJob.source_language]?.flag} {languages[workflowStatus.translationJob.source_language]?.name}
                      </div>
                      <div>
                        <span className="text-gray-500">To:</span> {languages[workflowStatus.translationJob.target_language]?.flag} {languages[workflowStatus.translationJob.target_language]?.name}
                      </div>
                    </div>
                    {workflowStatus.audioGenerationJob && (
                      <div className="text-sm">
                        <span className="text-gray-500">Voice Cloning:</span> {
                          workflowStatus.audioGenerationJob.voice_cloned === true 
                            ? '✅ Enabled' 
                            : '❌ Disabled'
                        }
                      </div>
                    )}
                  </div>
                )}

                {(workflowStatus.translationJob?.error_message || workflowStatus.audioGenerationJob?.error_message) && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {workflowStatus.translationJob?.error_message || workflowStatus.audioGenerationJob?.error_message}
                    </AlertDescription>
                  </Alert>
                )}

                {workflowStatus.finalOutput && (
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700" 
                    size="lg"
                    type="button"
                  >
                    📥 Download Translated Video
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!showDetailedStatus && (
        <div className="flex gap-3">
          <Button
            onClick={startTranslation}
            disabled={!canStartTranslation || isStartingTranslation || isTranslationInProgress}
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            size="lg"
            type="button"
          >
            {isStartingTranslation ? (
              <>⏳ Starting Translation...</>
            ) : isTranslationInProgress ? (
              <>🔄 Translation in Progress...</>
            ) : (
              <>🚀 Start Translation</>
            )}
          </Button>
          
          {workflowStatus?.overallStatus !== 'not_started' && (
            <Button 
              variant="outline" 
              onClick={loadWorkflowStatus} 
              size="lg"
              type="button"
            >
              🔄 Refresh Status
            </Button>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!showDetailedStatus && canStartTranslation && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div className="space-y-1">
                <h4 className="font-medium">How it works</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>1. 🎤 Extract audio from your video</li>
                  <li>2. 🌍 Translate speech to target language</li>
                  <li>3. 🎭 Generate new audio with voice cloning (optional)</li>
                  <li>4. 🎬 Create final video with translated audio</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import { TextWorkspace } from './text/TextWorkspace';
import { ImageWorkspace } from './image/ImageWorkspace';
import { STTWorkspace } from './stt/STTWorkspace';
import { TTSWorkspace } from './tts/TTSWorkspace';
import { VideoWorkspace } from './video/VideoWorkspace';

const modalityMap: Record<string, React.FC<{ modelId: string }>> = {
  text: TextWorkspace,
  image: ImageWorkspace,
  stt: STTWorkspace,
  tts: TTSWorkspace,
  video: VideoWorkspace
};

interface WorkspaceRendererProps {
  modality: string;
  modelId: string;
}

export function WorkspaceRenderer({ modality, modelId }: WorkspaceRendererProps) {
  const Workspace = modalityMap[modality];

  if (!Workspace) {
    return <p>Unsupported modality: {modality}</p>;
  }

  return <Workspace modelId={modelId} />;
}

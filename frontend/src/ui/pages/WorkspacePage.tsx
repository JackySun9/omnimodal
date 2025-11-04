import { useParams } from 'react-router-dom';

import { WorkspaceRenderer } from '../workspaces/WorkspaceRenderer';

export function WorkspacePage() {
  const { modality, modelId } = useParams();

  if (!modality || !modelId) {
    return <p>Select a model to begin.</p>;
  }

  return <WorkspaceRenderer modality={modality} modelId={modelId} />;
}

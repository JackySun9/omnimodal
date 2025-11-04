interface VideoWorkspaceProps {
  modelId: string;
}

export function VideoWorkspace({ modelId }: VideoWorkspaceProps) {
  return (
    <section>
      <h3>Video Workspace</h3>
      <p>Orchestrate video generation tasks for model {modelId} with async progress tracking.</p>
    </section>
  );
}

import { FormEvent, useState } from 'react';

interface TTSWorkspaceProps {
  modelId: string;
}

export function TTSWorkspace({ modelId }: TTSWorkspaceProps) {
  const [text, setText] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: Integrate with TTS executor when available
    alert('TTS generation will be implemented when Piper TTS executor is running');
  };

  return (
    <section style={{ padding: '1rem' }}>
      <h3>Text-to-Speech: {modelId}</h3>
      <p>⚠️ TTS functionality requires Piper to be running.</p>

      <form onSubmit={handleGenerate} style={{ marginTop: '2rem' }}>
        <label>
          Enter text to synthesize:
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your text here..."
            rows={5}
            required
          />
        </label>

        <button type="submit" disabled={!text.trim()} style={{ marginTop: '1rem' }}>
          🔊 Generate Speech
        </button>
      </form>

      {audioUrl && (
        <div style={{ marginTop: '2rem' }}>
          <h4>Generated Audio</h4>
          <audio controls src={audioUrl} style={{ width: '100%' }} />
        </div>
      )}
    </section>
  );
}

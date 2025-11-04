import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { discoverModels, DiscoveredModel, scanLocalModels, deleteModel } from '../../services/api';
import { useModels, useRefreshModels, useHardware, useDownloads, useRefreshDownloads } from '../../hooks';
import { useErrorHandler } from '../../hooks/useErrorHandler';

const defaultModalities = [
  { value: 'text', label: 'Text Generation (LLM)', icon: '💬' },
  { value: 'image', label: 'Image Generation', icon: '🎨' },
  { value: 'stt', label: 'Speech-to-Text', icon: '🎤' },
  { value: 'tts', label: 'Text-to-Speech', icon: '🔊' },
  { value: 'video', label: 'Text-to-Video', icon: '🎬' }
];

interface ModelCategory {
  name: string;
  models: any[];
  icon: string;
  color: string;
}

export function ModelsPage() {
  const navigate = useNavigate();
  const { data: models = [], isLoading: loading, error } = useModels();
  const { data: profile } = useHardware();
  const { data: downloads = [], isLoading: downloadsLoading, error: downloadsError } = useDownloads();
  const refreshModels = useRefreshModels();
  const refreshDownloads = useRefreshDownloads();
  const { handleError, handleSuccess } = useErrorHandler('Models');
  
  const [scanLoading, setScanLoading] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  
  // Filters
  const [selectedModality, setSelectedModality] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('compatibility');
  const [showCompatibleOnly, setShowCompatibleOnly] = useState(false);
  const [showGGUFOnly, setShowGGUFOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid');

  useEffect(() => {
    refreshModels();
    refreshDownloads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScanLocal = async () => {
    setScanLoading(true);
    setScanMessage(null);
    try {
      const result = await scanLocalModels();
      setScanMessage(result.message);
      handleSuccess(result.message);
      refreshModels();
    } catch (error) {
      const errorMsg = handleError(error);
      setScanMessage(`Error: ${errorMsg}`);
    } finally {
      setScanLoading(false);
    }
  };

  const handleOpenWorkspace = (modelId: string, modality: string) => {
    navigate(`/workspace/${modality}/${modelId}`);
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return;
    try {
      await deleteModel(modelId);
      handleSuccess('Model deleted successfully');
      refreshModels();
    } catch (error) {
      handleError(error);
    }
  };

  // Get GGUF quantization info
  const getGGUFInfo = (modelName: string) => {
    const name = modelName.toLowerCase();
    
    const ggufModels: Record<string, { vram: string; quality: number; speed: number; desc: string }> = {
      'q2k': { vram: '3GB', quality: 2, speed: 5, desc: 'Testing, low-end hardware' },
      'q3ks': { vram: '4GB', quality: 3, speed: 4, desc: 'Good balance for mobile GPUs' },
      'q4ks': { vram: '6GB', quality: 4, speed: 3, desc: '⭐ Recommended - best balance' },
      'q4-0': { vram: '5.5GB', quality: 4, speed: 3, desc: 'Alternative Q4 variant' },
      'q4-1': { vram: '6GB', quality: 4, speed: 3, desc: 'Alternative Q4 variant' },
      'q5ks': { vram: '8GB', quality: 4, speed: 2, desc: 'High quality on mid-range GPUs' },
      'q5-0': { vram: '7.5GB', quality: 4, speed: 2, desc: 'Alternative Q5 variant' },
      'q5-1': { vram: '8GB', quality: 4, speed: 2, desc: 'Alternative Q5 variant' },
      'q6k': { vram: '10GB', quality: 5, speed: 2, desc: 'Near-original quality' },
      'q8': { vram: '12GB', quality: 5, speed: 1, desc: 'Minimal quality loss' },
      'f16': { vram: '16GB', quality: 5, speed: 1, desc: 'Full precision' },
    };
    
    for (const [key, info] of Object.entries(ggufModels)) {
      if (name.includes(`-${key}`) || name.includes(`_${key}`)) {
        return { type: key.toUpperCase(), ...info, isGGUF: true };
      }
    }
    
    if (name.includes('gguf')) {
      return { type: 'GGUF', vram: 'Unknown', quality: 3, speed: 3, desc: 'Quantized model', isGGUF: true };
    }
    
    return null;
  };

  // Calculate hardware compatibility with GGUF awareness
  const getHardwareCompatibility = (model: any): { status: string; reason: string; color: string; recommendation?: string } => {
    if (!profile?.gpu?.total_vram_gb) {
      return { status: 'unknown', reason: 'Hardware info unavailable', color: 'var(--text-secondary)' };
    }

    const availableVRAM = profile.gpu.total_vram_gb || 0;
    const ggufInfo = getGGUFInfo(model.name);
    
    // For GGUF models, use documented VRAM requirements
    if (ggufInfo) {
      const requiredVRAM = parseFloat(ggufInfo.vram);
      if (isNaN(requiredVRAM)) {
        return { status: 'unknown', reason: 'GGUF VRAM unknown', color: 'var(--text-secondary)' };
      }
      
      if (requiredVRAM <= availableVRAM * 0.8) {
        return { 
          status: 'optimal', 
          reason: `GGUF: ${ggufInfo.vram} ≤ ${availableVRAM.toFixed(0)}GB VRAM`,
          color: 'var(--success)',
          recommendation: ggufInfo.desc
        };
      } else if (requiredVRAM <= availableVRAM * 1.2) {
        return { 
          status: 'good', 
          reason: `GGUF: ${ggufInfo.vram} fits in ${availableVRAM.toFixed(0)}GB`,
          color: 'var(--info)',
          recommendation: ggufInfo.desc
        };
      } else {
        return { 
          status: 'marginal', 
          reason: `GGUF: ${ggufInfo.vram} > ${availableVRAM.toFixed(0)}GB (CPU fallback)`,
          color: 'var(--warning)',
          recommendation: 'Consider lower quantization'
        };
      }
    }
    
    // For non-GGUF models, use file size estimation
    const modelSizeGB = model.size_bytes ? model.size_bytes / (1024**3) : 0;
    const estimatedVRAM = modelSizeGB * 1.2;

    if (estimatedVRAM <= availableVRAM * 0.7) {
      return { status: 'optimal', reason: `${estimatedVRAM.toFixed(1)}GB < ${(availableVRAM * 0.7).toFixed(1)}GB available`, color: 'var(--success)' };
    } else if (estimatedVRAM <= availableVRAM) {
      return { status: 'good', reason: `${estimatedVRAM.toFixed(1)}GB ≤ ${availableVRAM.toFixed(1)}GB VRAM`, color: 'var(--info)' };
    } else if (estimatedVRAM <= availableVRAM * 1.5) {
      return { status: 'marginal', reason: `${estimatedVRAM.toFixed(1)}GB > ${availableVRAM.toFixed(1)}GB (may use RAM)`, color: 'var(--warning)' };
    } else {
      return { status: 'incompatible', reason: `${estimatedVRAM.toFixed(1)}GB >> ${availableVRAM.toFixed(1)}GB VRAM`, color: 'var(--error)' };
    }
  };

  // Filter and categorize models
  const categorizedModels: ModelCategory[] = defaultModalities.map(mod => {
    let categoryModels = models.filter(m => m.modality === mod.value);
    
    // Apply filters
    if (searchQuery) {
      categoryModels = categoryModels.filter(m => 
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (sizeFilter !== 'all') {
      categoryModels = categoryModels.filter(m => {
        const sizeGB = m.size_bytes ? m.size_bytes / (1024**3) : 0;
        if (sizeFilter === 'small') return sizeGB < 5;
        if (sizeFilter === 'medium') return sizeGB >= 5 && sizeGB < 20;
        if (sizeFilter === 'large') return sizeGB >= 20;
        return true;
      });
    }
    
    if (showCompatibleOnly && profile?.gpu) {
      categoryModels = categoryModels.filter(m => {
        const compat = getHardwareCompatibility(m);
        return compat.status === 'optimal' || compat.status === 'good';
      });
    }
    
    if (showGGUFOnly) {
      categoryModels = categoryModels.filter(m => getGGUFInfo(m.name) !== null);
    }
    
    // Sort models
    if (sortBy === 'name') {
      categoryModels.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'size') {
      categoryModels.sort((a, b) => (b.size_bytes || 0) - (a.size_bytes || 0));
    } else if (sortBy === 'compatibility') {
      categoryModels.sort((a, b) => {
        const compatA = getHardwareCompatibility(a);
        const compatB = getHardwareCompatibility(b);
        const order = { optimal: 0, good: 1, marginal: 2, incompatible: 3, unknown: 4 };
        return (order[compatA.status as keyof typeof order] || 5) - (order[compatB.status as keyof typeof order] || 5);
      });
    } else if (sortBy === 'quality') {
      categoryModels.sort((a, b) => {
        const ggufA = getGGUFInfo(a.name);
        const ggufB = getGGUFInfo(b.name);
        return (ggufB?.quality || 3) - (ggufA?.quality || 3);
      });
    } else if (sortBy === 'speed') {
      categoryModels.sort((a, b) => {
        const ggufA = getGGUFInfo(a.name);
        const ggufB = getGGUFInfo(b.name);
        return (ggufB?.speed || 3) - (ggufA?.speed || 3);
      });
    }
    
    return {
      name: mod.label,
      models: categoryModels,
      icon: mod.icon,
      color: mod.value === 'text' ? 'var(--primary-color)' : 
             mod.value === 'image' ? 'var(--secondary-color)' :
             mod.value === 'stt' ? 'var(--info)' :
             mod.value === 'tts' ? 'var(--accent-color)' :
             'var(--text-secondary)'
    };
  });

  const totalFiltered = categorizedModels.reduce((sum, cat) => sum + cat.models.length, 0);
  const filteredCategories = selectedModality === 'all' 
    ? categorizedModels.filter(cat => cat.models.length > 0)
    : categorizedModels.filter(cat => cat.models.length > 0 && defaultModalities.find(m => m.label === cat.name)?.value === selectedModality);

  return (
    <section className="fade-in" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', fontSize: '2rem' }}>
          🤖 Model Library
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1rem', fontWeight: 500 }}>
          {models.length} models • {totalFiltered} shown
          {profile?.gpu && ` • ${profile.gpu.total_vram_gb?.toFixed(0)}GB VRAM available`}
        </p>
      </div>

      {/* Hardware Recommendation */}
      {profile?.gpu && (
        <div className="glass scale-in" style={{ 
          marginBottom: '2rem',
          padding: '1.25rem',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-md)',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.03))',
          border: '1px solid rgba(16, 185, 129, 0.3)',
        }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span>💡</span>
            <span>Hardware Recommendation</span>
          </h4>
          <div style={{ fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
            <p style={{ marginBottom: '0.75rem' }}>
              <strong>Your GPU:</strong> {profile.gpu.name || 'Unknown'} with {profile.gpu.total_vram_gb?.toFixed(0)}GB VRAM
            </p>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              <strong>Recommended GGUF models:</strong>{' '}
              {profile.gpu.total_vram_gb && profile.gpu.total_vram_gb >= 16 ? (
                <span className="tag tag-success">Q6K or F16 (best quality)</span>
              ) : profile.gpu.total_vram_gb && profile.gpu.total_vram_gb >= 12 ? (
                <span className="tag tag-success">Q5KS or Q6K (high quality)</span>
              ) : profile.gpu.total_vram_gb && profile.gpu.total_vram_gb >= 8 ? (
                <span className="tag tag-success">Q4KS or Q5KS ⭐ recommended</span>
              ) : profile.gpu.total_vram_gb && profile.gpu.total_vram_gb >= 6 ? (
                <span className="tag tag-success">Q4KS ⭐ best for your GPU</span>
              ) : profile.gpu.total_vram_gb && profile.gpu.total_vram_gb >= 4 ? (
                <span className="tag tag-warning">Q3KS (good balance)</span>
              ) : (
                <span className="tag tag-warning">Q2K (entry level)</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Scan Button */}
      <div style={{ marginBottom: '2rem' }}>
        <button 
          type="button" 
          onClick={handleScanLocal} 
          disabled={scanLoading}
          style={{ 
            width: '100%',
            padding: '1rem 1.5rem',
            fontSize: '1rem',
            background: scanLoading ? 'var(--bg-tertiary)' : 'var(--primary-gradient)',
            boxShadow: scanLoading ? 'none' : 'var(--shadow-glow)',
          }}
        >
          {scanLoading ? '🔄 Scanning...' : '🔍 Scan Local Models'}
        </button>
        {scanMessage && (
          <p style={{ 
            marginTop: '0.75rem', 
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: scanMessage.includes('Error') ? 'var(--error-bg)' : 'var(--success-bg)',
            color: scanMessage.includes('Error') ? 'var(--error)' : 'var(--success)',
          }}>
            {scanMessage}
          </p>
        )}
      </div>

      {/* Filters */}
      <details open className="glass" style={{ 
        marginBottom: '2rem',
        padding: '1.25rem',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-md)',
      }}>
        <summary style={{ 
          cursor: 'pointer', 
          fontWeight: 600,
          fontSize: '1.0625rem',
          userSelect: 'none',
          marginBottom: '1rem',
        }}>
          🔍 Filters & Sort
        </summary>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {/* View Mode Toggle */}
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}>
              View Mode:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '0.5rem 1rem',
                  background: viewMode === 'grid' ? 'var(--primary-gradient)' : 'var(--bg-tertiary)',
                  color: viewMode === 'grid' ? 'white' : 'var(--text-primary)',
                  border: viewMode === 'grid' ? 'none' : '1px solid var(--border-color)',
                  boxShadow: viewMode === 'grid' ? 'var(--shadow-md)' : 'none',
                }}
              >
                🔲 Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  padding: '0.5rem 1rem',
                  background: viewMode === 'list' ? 'var(--primary-gradient)' : 'var(--bg-tertiary)',
                  color: viewMode === 'list' ? 'white' : 'var(--text-primary)',
                  border: viewMode === 'list' ? 'none' : '1px solid var(--border-color)',
                  boxShadow: viewMode === 'list' ? 'var(--shadow-md)' : 'none',
                }}
              >
                📋 List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('compact')}
                style={{
                  padding: '0.5rem 1rem',
                  background: viewMode === 'compact' ? 'var(--primary-gradient)' : 'var(--bg-tertiary)',
                  color: viewMode === 'compact' ? 'white' : 'var(--text-primary)',
                  border: viewMode === 'compact' ? 'none' : '1px solid var(--border-color)',
                  boxShadow: viewMode === 'compact' ? 'var(--shadow-md)' : 'none',
                }}
              >
                📊 Compact
              </button>
            </div>
          </div>

          {/* Search */}
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}>
              Search Models:
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name..."
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* Modality Filter */}
            <div>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}>
                Type:
              </label>
              <select 
                value={selectedModality} 
                onChange={(e) => setSelectedModality(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="all">All Types ({models.length})</option>
                {defaultModalities.map(mod => {
                  const count = models.filter(m => m.modality === mod.value).length;
                  return (
                    <option key={mod.value} value={mod.value}>
                      {mod.icon} {mod.label} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Size Filter */}
            <div>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}>
                Size:
              </label>
              <select 
                value={sizeFilter} 
                onChange={(e) => setSizeFilter(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="all">All Sizes</option>
                <option value="small">Small (&lt;5GB)</option>
                <option value="medium">Medium (5-20GB)</option>
                <option value="large">Large (20GB+)</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}>
                Sort By:
              </label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="compatibility">🎯 Hardware Match (Best First)</option>
                <option value="quality">⭐ Quality (GGUF)</option>
                <option value="speed">⚡ Speed (GGUF)</option>
                <option value="name">📝 Name (A-Z)</option>
                <option value="size">💾 Size (Large first)</option>
              </select>
            </div>
          </div>

          {/* Hardware & GGUF Filters */}
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {profile?.gpu && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={showCompatibleOnly}
                  onChange={(e) => setShowCompatibleOnly(e.target.checked)}
                />
                <span>
                  ✅ Show only compatible models for my hardware 
                  ({profile.gpu.total_vram_gb?.toFixed(0)}GB VRAM)
                </span>
              </label>
            )}
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={showGGUFOnly}
                onChange={(e) => setShowGGUFOnly(e.target.checked)}
              />
              <span>
                🔧 Show only GGUF quantized models (optimized for lower VRAM)
              </span>
            </label>
          </div>
        </div>
      </details>

      {/* Loading/Error States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading shimmer" style={{ width: '3rem', height: '3rem', margin: '0 auto', borderRadius: '50%' }}></div>
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading models...</p>
        </div>
      )}
      
      {error && (
        <div style={{ padding: '2rem', backgroundColor: 'var(--error-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--error)' }}>
          <p style={{ color: 'var(--error)', margin: 0 }}>Error: {error}</p>
        </div>
      )}

      {/* Categorized Models */}
      {!loading && !error && (
        <div style={{ display: 'grid', gap: '2rem' }}>
          {filteredCategories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
              <h3>No models found</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                {searchQuery || sizeFilter !== 'all' || showCompatibleOnly
                  ? 'Try adjusting your filters'
                  : 'Click "Scan Local Models" to find your models'}
              </p>
            </div>
          ) : (
            filteredCategories.map(category => (
              <div key={category.name} className="scale-in">
                <h3 style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  marginBottom: '1.25rem',
                  paddingBottom: '1rem',
                  borderBottom: `3px solid ${category.color}`,
                  position: 'relative',
                }}>
                  <div className="icon-container" style={{ 
                    width: '48px', 
                    height: '48px', 
                    fontSize: '1.5rem',
                    background: `linear-gradient(135deg, ${category.color}, ${category.color}dd)`,
                  }}>
                    {category.icon}
                  </div>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{category.name}</span>
                  <span className="tag tag-primary" style={{ marginLeft: 'auto' }}>
                    {category.models.length}
                  </span>
                </h3>

                <div style={{ 
                  display: viewMode === 'grid' ? 'grid' : 'flex',
                  flexDirection: viewMode === 'grid' ? undefined : 'column',
                  gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(450px, 1fr))' : undefined,
                  gap: viewMode === 'compact' ? '0.5rem' : '1rem',
                }}>
                  {category.models.map((model) => {
                    const compat = getHardwareCompatibility(model);
                    const ggufInfo = getGGUFInfo(model.name);
                    const sizeGB = model.size_bytes ? (model.size_bytes / (1024**3)).toFixed(1) : '?';
                    const sizeMB = model.size_bytes ? (model.size_bytes / (1024**2)).toFixed(1) : '?';
                    
                    // Detect potentially corrupted models (suspiciously small file size)
                    // BUT: STT models (Whisper) can be legitimately small (tiny = 72MB, base = 142MB)
                    // Only flag image/video models as corrupted if < 100MB
                    const isCorrupted = model.size_bytes && 
                                       model.size_bytes < 1024 * 1024 * 100 && 
                                       (model.modality === 'image' || model.modality === 'video'); // Only check image/video models
                    
                    // Detect model source from metadata
                    const modelSource = model.model_metadata?.source || 'unknown';
                    const isHuggingFace = modelSource === 'huggingface' || model.name.includes('/');
                    const isOllamaDiffuser = modelSource === 'ollamadiffuser';
                    const isWhisper = modelSource === 'whisper';
                    const isWhisperDownloaded = isWhisper && model.model_metadata?.is_downloaded === true;
                    
                    // Compact view - minimal information
                    if (viewMode === 'compact') {
                      return (
                        <div 
                          key={model.id} 
                          className="card scale-in"
                          style={{ 
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '0.75rem 1rem',
                            cursor: 'pointer',
                            transition: 'var(--transition-slow)',
                          }}
                          onClick={() => handleOpenWorkspace(model.id, model.modality)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                            <span style={{ 
                              fontSize: '0.9375rem', 
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {model.name}
                            </span>
                            {ggufInfo && (
                              <span className="tag tag-primary" style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem' }}>
                                {ggufInfo.type}
                              </span>
                            )}
                            {profile?.gpu && (
                              <span 
                                className={
                                  compat.status === 'optimal' || compat.status === 'good' ? 'tag tag-success' :
                                  compat.status === 'marginal' ? 'tag tag-warning' : 'tag'
                                }
                                style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem' }}
                                title={compat.reason}
                              >
                                {compat.status === 'optimal' && '✅'}
                                {compat.status === 'good' && '✅'}
                                {compat.status === 'marginal' && '⚠️'}
                                {compat.status === 'incompatible' && '❌'}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                              💾 {sizeGB} GB
                            </span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenWorkspace(model.id, model.modality);
                              }}
                              style={{ 
                                padding: '0.375rem 0.75rem',
                                fontSize: '0.8125rem',
                                background: `linear-gradient(135deg, ${category.color}, ${category.color}dd)`,
                                color: 'white',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      );
                    }
                    
                    // Grid and List views - full information
                    return (
                      <div 
                        key={model.id} 
                        className="card scale-in"
                        style={{ 
                          display: viewMode === 'grid' ? 'flex' : 'grid',
                          flexDirection: viewMode === 'grid' ? 'column' : undefined,
                          gridTemplateColumns: viewMode === 'list' ? '1fr auto' : undefined,
                          gap: '1rem',
                          alignItems: viewMode === 'list' ? 'center' : undefined,
                          cursor: 'pointer',
                          transition: 'var(--transition-slow)',
                          height: viewMode === 'grid' ? '100%' : undefined,
                        }}
                        onClick={() => handleOpenWorkspace(model.id, model.modality)}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontSize: '1.125rem', 
                            fontWeight: 600, 
                            marginBottom: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            flexWrap: 'wrap',
                          }}>
                            <span>{model.name}</span>
                            {isCorrupted && (
                              <span className="tag tag-error" title="Model may be corrupted - file size is suspiciously small">
                                ⚠️ Corrupted?
                              </span>
                            )}
                            {ggufInfo && !isCorrupted && (
                              <span className="tag tag-primary" title="Quantized GGUF model">
                                🔧 {ggufInfo.type}
                              </span>
                            )}
                            {isHuggingFace && (
                              <span className="tag" style={{ background: 'rgba(255, 165, 0, 0.15)', color: 'orange', border: '1px solid rgba(255, 165, 0, 0.3)' }} title="From HuggingFace Hub cache">
                                🤗 HF
                              </span>
                            )}
                            {isOllamaDiffuser && (
                              <span className="tag" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'rgb(59, 130, 246)', border: '1px solid rgba(59, 130, 246, 0.3)' }} title="From OllamaDiffuser registry">
                                🎨 OD
                              </span>
                            )}
                            {isWhisper && !isWhisperDownloaded && (
                              <span className="tag" style={{ background: 'rgba(168, 85, 247, 0.15)', color: 'rgb(168, 85, 247)', border: '1px solid rgba(168, 85, 247, 0.3)' }} title="Available for download - will auto-download on first use">
                                📥 Virtual
                              </span>
                            )}
                            {isWhisper && isWhisperDownloaded && (
                              <span className="tag tag-success" title="Downloaded and cached locally">
                                ✅ Downloaded
                              </span>
                            )}
                            {profile?.gpu && (
                              <span 
                                className={
                                  compat.status === 'optimal' || compat.status === 'good' ? 'tag tag-success' :
                                  compat.status === 'marginal' ? 'tag tag-warning' :
                                  compat.status === 'incompatible' ? 'tag tag-error' : 'tag'
                                }
                                title={compat.reason + (compat.recommendation ? `\n${compat.recommendation}` : '')}
                              >
                                {compat.status === 'optimal' && '✅ Optimal'}
                                {compat.status === 'good' && '✅ Good'}
                                {compat.status === 'marginal' && '⚠️ Marginal'}
                                {compat.status === 'incompatible' && '❌ Too Large'}
                                {compat.status === 'unknown' && '❓ Unknown'}
                              </span>
                            )}
                          </div>
                          
                          {ggufInfo && (
                            <div style={{
                              marginBottom: '0.75rem',
                              padding: '0.75rem',
                              borderRadius: 'var(--radius-md)',
                              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05))',
                              border: '1px solid rgba(99, 102, 241, 0.2)',
                              fontSize: '0.8125rem',
                            }}>
                              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <span title="VRAM Requirement">
                                  🎮 <strong>{ggufInfo.vram}</strong> VRAM
                                </span>
                                <span title="Quality Rating">
                                  ⭐ Quality: {'⭐'.repeat(ggufInfo.quality)}{' '}
                                  <span style={{ color: 'var(--text-muted)' }}>{'⭐'.repeat(5 - ggufInfo.quality)}</span>
                                </span>
                                <span title="Speed Rating">
                                  ⚡ Speed: {'⚡'.repeat(ggufInfo.speed)}{' '}
                                  <span style={{ color: 'var(--text-muted)' }}>{'⚡'.repeat(5 - ggufInfo.speed)}</span>
                                </span>
                              </div>
                              <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                {ggufInfo.desc}
                              </div>
                            </div>
                          )}
                          
                          {isCorrupted && (
                            <div style={{
                              marginBottom: '0.75rem',
                              padding: '0.75rem',
                              borderRadius: 'var(--radius-md)',
                              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05))',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              fontSize: '0.8125rem',
                              color: 'var(--error)',
                            }}>
                              <strong>⚠️ Warning:</strong> This model appears corrupted (only {sizeMB} MB). 
                              Try re-downloading: <code style={{ background: 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                ollamadiffuser pull {model.name}
                              </code>
                            </div>
                          )}
                          
                          {isWhisper && !isWhisperDownloaded && (
                            <div style={{
                              marginBottom: '0.75rem',
                              padding: '0.75rem',
                              borderRadius: 'var(--radius-md)',
                              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(168, 85, 247, 0.05))',
                              border: '1px solid rgba(168, 85, 247, 0.3)',
                              fontSize: '0.8125rem',
                              color: 'rgb(168, 85, 247)',
                            }}>
                              <strong>📥 Virtual Model:</strong> This model will be downloaded automatically when you first use it. 
                              Click "Open" and then "Pre-load Model" in the workspace to download it now.
                            </div>
                          )}
                          
                          <div style={{ 
                            fontSize: '0.875rem', 
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            gap: '1rem',
                            flexWrap: 'wrap',
                          }}>
                            <span>💾 {sizeGB} GB</span>
                            <span>📁 {model.executor || model.modality}</span>
                            {profile?.gpu && !ggufInfo && (
                              <span title={compat.reason}>
                                🎮 {compat.reason}
                              </span>
                            )}
                            {compat.recommendation && (
                              <span title={compat.recommendation}>
                                💡 {compat.recommendation}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          gap: '0.5rem',
                          marginTop: viewMode === 'grid' ? 'auto' : undefined,
                          paddingTop: viewMode === 'grid' ? '0.5rem' : undefined,
                          borderTop: viewMode === 'grid' ? '1px solid var(--border-color)' : undefined,
                        }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenWorkspace(model.id, model.modality);
                            }}
                            style={{ 
                              flex: viewMode === 'grid' ? 1 : undefined,
                              background: `linear-gradient(135deg, ${category.color}, ${category.color}dd)`,
                              color: 'white',
                              whiteSpace: 'nowrap',
                              boxShadow: 'var(--shadow-md)',
                            }}
                          >
                            🚀 Open
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteModel(model.id);
                            }}
                            style={{ 
                              background: 'var(--error-gradient)', 
                              color: 'white',
                              padding: '0.625rem 0.875rem',
                              boxShadow: 'var(--shadow-md)',
                            }}
                            title="Delete model"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

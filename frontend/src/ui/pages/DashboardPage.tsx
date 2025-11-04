import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useHardware, useModels, useExecutorStatus } from '../../hooks';

interface ServiceStatus {
  name: string;
  displayName: string;
  icon: string;
  color: string;
  isRunning: boolean;
  healthy: boolean;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: profile, isLoading: hardwareLoading, error: hardwareError } = useHardware();
  const { data: models = [], isLoading: modelsLoading, error: modelsError } = useModels();
  
  const ollamaStatus = useExecutorStatus('ollama');
  const ollamaDiffuserStatus = useExecutorStatus('ollama-diffuser');
  
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  useEffect(() => {
    checkServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ollamaStatus.data, ollamaDiffuserStatus.data]);

  const checkServices = () => {
    const serviceChecks = [
      { name: 'ollama', displayName: 'Ollama', icon: '🦙', color: 'var(--primary-color)', status: ollamaStatus },
      { name: 'ollama-diffuser', displayName: 'OllamaDiffuser', icon: '🎨', color: 'var(--secondary-color)', status: ollamaDiffuserStatus },
    ];

    const statuses: ServiceStatus[] = serviceChecks.map(service => ({
      name: service.name,
      displayName: service.displayName,
      icon: service.icon,
      color: service.color,
      isRunning: service.status.data?.is_running ?? false,
      healthy: service.status.data?.healthy ?? false,
    }));
    
    setServices(statuses);
    setServicesLoading(ollamaStatus.isLoading || ollamaDiffuserStatus.isLoading);
  };

  const modelsByModality = models.reduce((acc, model) => {
    acc[model.modality] = (acc[model.modality] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <section className="fade-in">
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '2rem' }}>
          🏠 Dashboard
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1rem' }}>
          System overview and quick stats
        </p>
      </div>

      {/* Hardware Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {/* GPU Card */}
        <div className="stat-card scale-in">       
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div className="icon-container" style={{ width: '40px', height: '40px', fontSize: '1.25rem' }}>🎮</div>
            <span style={{ flex: 1, fontSize: '1.125rem' }}>GPU</span>
          </h3>
          {hardwareLoading && <p className="shimmer" style={{ height: '4rem', borderRadius: 'var(--radius-md)' }}></p>}
          {hardwareError && <p style={{ color: 'var(--error)' }}>Error loading hardware info</p>}
          {profile && (
            <div>
              <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                {profile.gpu?.name || 'No GPU detected'}
              </p>
              {profile.gpu && (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <p>VRAM: {profile.gpu.total_vram_gb?.toFixed(1)} GB</p>
                  <p>Available: {profile.gpu.free_vram_gb?.toFixed(1)} GB</p>
                  
                  {/* Acceleration Support */}
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {profile.gpu.name?.toLowerCase().includes('nvidia') && (
                      <span className="tag tag-success" title="NVIDIA CUDA acceleration available">
                        ⚡ CUDA
                      </span>
                    )}
                    {profile.gpu.name?.toLowerCase().includes('apple') && (
                      <span className="tag tag-success" title="Apple Metal acceleration available">
                        ⚡ Metal
                      </span>
                    )}
                    {profile.gpu.name?.toLowerCase().includes('amd') && (
                      <span className="tag tag-warning" title="AMD ROCm may be available">
                        ⚡ ROCm
                      </span>
                    )}
                  </div>
                  
                  {profile.gpu.utilization_percent && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${profile.gpu.utilization_percent}%` }}></div>
                      </div>
                      <p style={{ marginTop: '0.5rem', fontWeight: 500 }}>
                        Utilization: {profile.gpu.utilization_percent.toFixed(0)}%
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CPU Card */}
        <div className="stat-card scale-in" style={{ animationDelay: '0.1s' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div className="icon-container" style={{ width: '40px', height: '40px', fontSize: '1.25rem', background: 'var(--info-gradient)' }}>⚙️</div>
            <span style={{ flex: 1, fontSize: '1.125rem' }}>CPU</span>
          </h3>
          {hardwareLoading && <p className="shimmer" style={{ height: '4rem', borderRadius: 'var(--radius-md)' }}></p>}
          {profile && (
            <div>
              <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                {profile.cpu.model || 'Unknown CPU'}
              </p>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <p>Physical Cores: {profile.cpu.cores_physical}</p>
                <p>Logical Cores: {profile.cpu.cores_logical}</p>
                {profile.cpu.instruction_sets.length > 0 && (
                  <p style={{ marginTop: '0.5rem' }}>
                    <span className="badge badge-info">
                      {profile.cpu.instruction_sets.includes('AVX2') ? 'AVX2 ✓' : 'AVX2 ✗'}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RAM Card */}
        <div className="stat-card scale-in" style={{ animationDelay: '0.2s' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div className="icon-container" style={{ width: '40px', height: '40px', fontSize: '1.25rem', background: 'var(--success-gradient)' }}>💾</div>
            <span style={{ flex: 1, fontSize: '1.125rem' }}>Memory</span>
          </h3>
          {hardwareLoading && <p className="shimmer" style={{ height: '4rem', borderRadius: 'var(--radius-md)' }}></p>}
          {profile && (
            <div>
              <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                {profile.memory.total_gb?.toFixed(0)} GB Total
              </p>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <p>Available: {profile.memory.available_gb?.toFixed(1)} GB</p>
                <div style={{ marginTop: '0.75rem' }}>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ 
                      width: `${((profile.memory.total_gb! - profile.memory.available_gb!) / profile.memory.total_gb!) * 100}%`,
                      background: 'var(--success-gradient)',
                    }}></div>
                  </div>
                  <p style={{ marginTop: '0.5rem', fontWeight: 500 }}>
                    {((profile.memory.available_gb! / profile.memory.total_gb!) * 100).toFixed(0)}% Free
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', fontSize: '1.25rem' }}>
          ⚡ Quick Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <button
            onClick={() => navigate('/chat')}
            className="card scale-in"
            style={{
              padding: '1.25rem',
              textAlign: 'left',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(99, 102, 241, 0.05))',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              cursor: 'pointer',
              transition: 'var(--transition-slow)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Chat</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Talk with AI models</div>
          </button>

          <button
            onClick={() => navigate('/image')}
            className="card scale-in"
            style={{
              padding: '1.25rem',
              textAlign: 'left',
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(236, 72, 153, 0.05))',
              border: '1px solid rgba(236, 72, 153, 0.2)',
              cursor: 'pointer',
              transition: 'var(--transition-slow)',
              animationDelay: '0.05s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎨</div>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Image Generation</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Create AI art</div>
          </button>

          <button
            onClick={() => navigate('/audio')}
            className="card scale-in"
            style={{
              padding: '1.25rem',
              textAlign: 'left',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              cursor: 'pointer',
              transition: 'var(--transition-slow)',
              animationDelay: '0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎤</div>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Speech-to-Text</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Transcribe audio</div>
          </button>

          <button
            onClick={() => navigate('/models')}
            className="card scale-in"
            style={{
              padding: '1.25rem',
              textAlign: 'left',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              cursor: 'pointer',
              transition: 'var(--transition-slow)',
              animationDelay: '0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Browse Models</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Manage AI models</div>
          </button>
        </div>
      </div>

      {/* System Status */}
      <div className="card scale-in" style={{ marginBottom: '2.5rem', animationDelay: '0.2s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.25rem' }}>
            <div className="icon-container" style={{ width: '40px', height: '40px', fontSize: '1.25rem', background: 'var(--info-gradient)' }}>🔧</div>
            <span>System Status</span>
          </h3>
          <button
            onClick={checkServices}
            disabled={servicesLoading}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: servicesLoading ? 'var(--bg-tertiary)' : 'var(--info-gradient)',
            }}
          >
            {servicesLoading ? '🔄 Checking...' : '🔄 Refresh'}
          </button>
        </div>
        
        {servicesLoading ? (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div className="shimmer" style={{ height: '3rem', borderRadius: 'var(--radius-md)' }}></div>
            <div className="shimmer" style={{ height: '3rem', borderRadius: 'var(--radius-md)' }}></div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {services.map((service) => (
              <div
                key={service.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${service.healthy ? 'var(--success)' : 'var(--error)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ fontSize: '1.5rem' }}>{service.icon}</div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                      {service.displayName}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {service.isRunning ? 'Running' : 'Stopped'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span 
                    className={service.healthy ? 'tag tag-success' : 'tag tag-error'}
                    style={{ fontSize: '0.875rem' }}
                  >
                    {service.healthy ? '✅ Healthy' : '❌ Offline'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Models Overview */}
      <div className="card scale-in" style={{ animationDelay: '0.3s' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div className="icon-container" style={{ width: '40px', height: '40px', fontSize: '1.25rem', background: 'var(--accent-gradient)' }}>📚</div>
          <span style={{ flex: 1, fontSize: '1.25rem' }}>Model Library</span>
        </h3>
        {modelsLoading && <p className="pulse">Loading models...</p>}
        {modelsError && <p style={{ color: 'var(--error)' }}>Error loading models</p>}
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="stat-card" style={{ textAlign: 'center', padding: '1.25rem' }}>
            <div className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
              {models.length}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Models</div>
          </div>
          
          {Object.entries(modelsByModality).map(([modality, count]) => (
            <div key={modality} className="stat-card" style={{ textAlign: 'center', padding: '1.25rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                {modality === 'text' && '💬'} 
                {modality === 'image' && '🎨'}
                {modality === 'stt' && '🎤'}
                {modality === 'tts' && '🔊'}
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>{count}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'capitalize', fontWeight: 600 }}>
                {modality}
              </div>
            </div>
          ))}
        </div>

        {models.length > 0 ? (
          <>
            <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Recent Models
            </h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}>
              {models.slice(0, 6).map((model) => {
                const modalityConfig = {
                  text: { icon: '💬', color: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.3)' },
                  image: { icon: '🎨', color: 'rgba(236, 72, 153, 0.1)', border: 'rgba(236, 72, 153, 0.3)' },
                  stt: { icon: '🎤', color: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)' },
                  tts: { icon: '🔊', color: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)' },
                  video: { icon: '🎬', color: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.3)' },
                };
                const config = modalityConfig[model.modality as keyof typeof modalityConfig] || modalityConfig.text;
                
                return (
                  <div 
                    key={model.id}
                    onClick={() => navigate(`/workspace/${model.modality}/${model.id}`)}
                    className="card"
                    style={{ 
                      padding: '1rem',
                      background: `linear-gradient(135deg, ${config.color}, transparent)`,
                      border: `1px solid ${config.border}`,
                      cursor: 'pointer',
                      transition: 'var(--transition-slow)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>{config.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          fontWeight: 600, 
                          marginBottom: '0.25rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {model.name}
                        </div>
                        <div style={{ 
                          fontSize: '0.8125rem', 
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          gap: '0.75rem',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}>
                          <span className="tag" style={{ 
                            fontSize: '0.75rem',
                            padding: '0.125rem 0.5rem',
                            textTransform: 'capitalize',
                          }}>
                            {model.modality}
                          </span>
                          {model.size_bytes && (
                            <span>💾 {(model.size_bytes / (1024**3)).toFixed(1)} GB</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button 
              onClick={() => navigate('/models')}
              style={{ marginTop: '0.5rem', width: '100%' }}
            >
              📚 View All {models.length} Models
            </button>
          </>
        ) : !modelsLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
            <p>No models found</p>
            <button onClick={() => navigate('/models')} style={{ marginTop: '1rem' }}>
              🔍 Discover Models
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

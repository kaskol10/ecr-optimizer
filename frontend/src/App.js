import React, { useState, useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { ToastProvider, ToastViewport, ToastComponent } from './components/Toast';
import { useToast } from './hooks/useToast';
import { Package, ArrowLeft } from 'lucide-react';
import './App.css';
import Dashboard from './components/Dashboard';
import RepositoryList from './components/RepositoryList';
import ImageList from './components/ImageList';
import GlobalView from './components/GlobalView';
import { apiUrl } from './config';

function App() {
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [view, setView] = useState('dashboard'); // dashboard, most-downloaded, largest
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toasts, removeToast, error: showError } = useToast();

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl('/api/repositories'));
      if (!response.ok) throw new Error('Failed to fetch repositories');
      const data = await response.json();
      setRepositories(data);
    } catch (err) {
      setError(err.message);
      showError('Failed to fetch repositories', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToastProvider swipeDirection="right">
      <div className="App">
        <header className="App-header">
          <div className="header-content">
            <div className="header-icon">
              <Package size={32} />
            </div>
            <div>
              <h1>ECR Optimizer</h1>
              <p>Manage your AWS ECR images efficiently</p>
            </div>
          </div>
        </header>

      <main className="App-main">
        {error && (
          <div className="error-banner">
            Error: {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <div className="container">
          <div className="sidebar">
            <RepositoryList
              repositories={repositories}
              selectedRepo={selectedRepo}
              onSelectRepo={setSelectedRepo}
              loading={loading}
            />
          </div>

          <div className="content">
            {!selectedRepo ? (
              <GlobalView onSelectRepo={setSelectedRepo} />
            ) : (
              <>
                <div className="repository-header">
                  <div className="repo-breadcrumb">
                    <button 
                      className="back-button"
                      onClick={() => setSelectedRepo(null)}
                      title="Back to global view"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <h2 className="selected-repo-name">{selectedRepo}</h2>
                  </div>
                </div>
                <Tabs.Root className="view-tabs" value={view} onValueChange={setView}>
                  <Tabs.List className="tabs-list">
                    <Tabs.Trigger className="tabs-trigger" value="dashboard">
                      Dashboard
                    </Tabs.Trigger>
                    <Tabs.Trigger className="tabs-trigger" value="most-downloaded">
                      Recently Pulled
                    </Tabs.Trigger>
                    <Tabs.Trigger className="tabs-trigger" value="largest">
                      Largest Images
                    </Tabs.Trigger>
                  </Tabs.List>
                  
                  <Tabs.Content className="tabs-content" value="dashboard">
                    <Dashboard repository={selectedRepo} />
                  </Tabs.Content>
                  <Tabs.Content className="tabs-content" value="most-downloaded">
                    <ImageList
                      repository={selectedRepo}
                      type="most-downloaded"
                      title="Recently Pulled Images"
                    />
                  </Tabs.Content>
                  <Tabs.Content className="tabs-content" value="largest">
                    <ImageList
                      repository={selectedRepo}
                      type="largest"
                      title="Largest Images"
                    />
                  </Tabs.Content>
                </Tabs.Root>
              </>
            )}
          </div>
        </div>
      </main>
      
      <ToastViewport>
        {toasts.map((toast) => (
          <ToastComponent
            key={toast.id}
            open={toast.open}
            onOpenChange={(open) => !open && removeToast(toast.id)}
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
          />
        ))}
      </ToastViewport>
      </div>
    </ToastProvider>
  );
}

export default App;


import React, { useState, useEffect } from 'react';
import { Package, Image, HardDrive, Loader2 } from 'lucide-react';
import './GlobalView.css';
import { apiUrl } from '../config';

function GlobalView({ onSelectRepo }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [repoLimit, setRepoLimit] = useState(20); // '20', '30', or null for all

  useEffect(() => {
    fetchGlobalStats();
  }, []);

  const fetchGlobalStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl('/api/global-stats'));
      if (!response.ok) throw new Error('Failed to fetch global stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="global-view">
        <div className="global-view-loading">
          <Loader2 className="loading-spinner" size={24} />
          <span>Loading global statistics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="global-view">
        <div className="global-view-error">Error: {error}</div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // Filter repositories based on selected limit
  const filteredRepos = stats.topRepositoriesBySize && stats.topRepositoriesBySize.length > 0
    ? (repoLimit === null 
        ? stats.topRepositoriesBySize 
        : stats.topRepositoriesBySize.slice(0, repoLimit))
    : [];

  // Get heading text based on filter
  const getHeadingText = () => {
    if (repoLimit === null) {
      return `All Repositories by Size (${filteredRepos.length})`;
    }
    return `Top ${repoLimit} Repositories by Size`;
  };

  return (
    <div className="global-view">
      <div className="global-header">
        <h1>ECR Global View</h1>
        <p>Overview of all repositories</p>
      </div>

      <div className="global-stats-grid">
        <div className="global-stat-card">
          <div className="stat-icon-wrapper">
            <Package className="stat-icon" size={28} />
          </div>
          <div className="stat-content">
            <h3>Total Repositories</h3>
            <p className="stat-value">{stats.totalRepositories.toLocaleString()}</p>
          </div>
        </div>

        <div className="global-stat-card">
          <div className="stat-icon-wrapper">
            <Image className="stat-icon" size={28} />
          </div>
          <div className="stat-content">
            <h3>Total Images</h3>
            <p className="stat-value">{stats.totalImages.toLocaleString()}</p>
          </div>
        </div>

        <div className="global-stat-card">
          <div className="stat-icon-wrapper">
            <HardDrive className="stat-icon" size={28} />
          </div>
          <div className="stat-content">
            <h3>Total Size</h3>
            <p className="stat-value">{formatBytes(stats.totalSize)}</p>
          </div>
        </div>
      </div>

      {stats.topRepositoriesBySize && stats.topRepositoriesBySize.length > 0 && (
        <div className="top-repositories-section">
          <div className="top-repos-header">
            <h2>{getHeadingText()}</h2>
            <div className="repo-limit-toggle">
              <button
                className={`limit-button ${repoLimit === 20 ? 'active' : ''}`}
                onClick={() => setRepoLimit(20)}
              >
                Top 20
              </button>
              <button
                className={`limit-button ${repoLimit === 30 ? 'active' : ''}`}
                onClick={() => setRepoLimit(30)}
              >
                Top 30
              </button>
              <button
                className={`limit-button ${repoLimit === null ? 'active' : ''}`}
                onClick={() => setRepoLimit(null)}
              >
                All
              </button>
            </div>
          </div>
          <div className="top-repos-list">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Repository</th>
                  <th>Size</th>
                  <th>Images</th>
                </tr>
              </thead>
              <tbody>
                {filteredRepos.map((repo, index) => (
                  <tr key={repo.name}>
                    <td className="rank-cell">{index + 1}</td>
                    <td 
                      className="repo-name-cell clickable"
                      onClick={() => onSelectRepo && onSelectRepo(repo.name)}
                      title="Click to view repository details"
                    >
                      {repo.name}
                    </td>
                    <td className="size-cell">{formatBytes(repo.size)}</td>
                    <td className="count-cell">{repo.imageCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="global-info">
        <p>Select a repository from the sidebar to view detailed information and manage images.</p>
      </div>
    </div>
  );
}

export default GlobalView;


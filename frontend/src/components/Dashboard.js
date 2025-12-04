import React, { useState, useEffect } from 'react';
import { Image, HardDrive, TrendingUp, Package } from 'lucide-react';
import './Dashboard.css';
import ImageList from './ImageList';
import DeleteByDate from './DeleteByDate';
import { apiUrl } from '../config';

function Dashboard({ repository }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (repository) {
      fetchStats();
    }
  }, [repository, refreshKey]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [imagesRes, mostDownloadedRes, largestRes] = await Promise.all([
        fetch(apiUrl(`/api/images?repository=${repository}`)),
        fetch(apiUrl(`/api/images/most-downloaded?repository=${repository}&limit=5`)),
        fetch(apiUrl(`/api/images/largest?repository=${repository}&limit=5`)),
      ]);

      const images = await imagesRes.json();
      const mostDownloaded = await mostDownloadedRes.json();
      const largest = await largestRes.json();

      const totalSize = images.reduce((sum, img) => sum + img.imageSize, 0);
      const totalImages = images.length;

      setStats({
        totalImages,
        totalSize,
        mostDownloaded,
        largest,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
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
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  if (!stats) {
    return <div className="dashboard-empty">No data available</div>;
  }

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card stat-card-primary">
          <div className="stat-icon-wrapper">
            <Image className="stat-icon" size={24} />
          </div>
          <div className="stat-content">
            <h3>Total Images</h3>
            <p className="stat-value">{stats.totalImages.toLocaleString()}</p>
          </div>
        </div>
        <div className="stat-card stat-card-secondary">
          <div className="stat-icon-wrapper">
            <HardDrive className="stat-icon" size={24} />
          </div>
          <div className="stat-content">
            <h3>Total Size</h3>
            <p className="stat-value">{formatBytes(stats.totalSize)}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="dashboard-section">
          <div className="section-header">
            <TrendingUp className="section-icon" size={20} />
            <h2>Top 5 Recently Pulled</h2>
          </div>
          <ImageList
            repository={repository}
            type="most-downloaded"
            limit={5}
            compact={true}
          />
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <Package className="section-icon" size={20} />
            <h2>Top 5 Largest Images</h2>
          </div>
          <ImageList
            repository={repository}
            type="largest"
            limit={5}
            compact={true}
          />
        </div>
      </div>

      <DeleteByDate 
        repository={repository}
        onDeleteSuccess={() => setRefreshKey(prev => prev + 1)}
      />
    </div>
  );
}

export default Dashboard;


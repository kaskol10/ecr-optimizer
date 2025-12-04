import React, { useState, useEffect } from 'react';
import './ImageList.css';
import DeleteModal from './DeleteModal';
import { apiUrl } from '../config';

function ImageList({ repository, type, title, limit = 10, compact = false }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    if (repository) {
      fetchImages();
    }
  }, [repository, type, limit]);

  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = type === 'most-downloaded'
        ? `/api/images/most-downloaded?repository=${repository}&limit=${limit}`
        : `/api/images/largest?repository=${repository}&limit=${limit}`;
      
      const response = await fetch(apiUrl(endpoint));
      if (!response.ok) throw new Error('Failed to fetch images');
      const data = await response.json();
      setImages(data);
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

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const handleDelete = (image) => {
    setSelectedImage(image);
    setDeleteModalOpen(true);
  };

  const handleDeleteSuccess = () => {
    fetchImages();
    setDeleteModalOpen(false);
    setSelectedImage(null);
  };

  if (loading) {
    return <div className="image-list-loading">Loading images...</div>;
  }

  if (error) {
    return <div className="image-list-error">Error: {error}</div>;
  }

  return (
    <>
      {title && !compact && <h2 className="image-list-title">{title}</h2>}
      <div className={`image-list ${compact ? 'compact' : ''}`}>
        {images.length === 0 ? (
          <div className="empty">No images found</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tag</th>
                <th>Digest</th>
                <th>Size</th>
                <th>Pushed At</th>
                <th>Last Pull</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {images.map((image, idx) => (
                <tr key={image.imageDigest || idx}>
                  <td className="tag-cell">
                    {image.imageTag || <span className="no-tag">untagged</span>}
                  </td>
                  <td className="digest-cell">
                    {image.imageDigest.substring(0, 16)}...
                  </td>
                  <td>{formatBytes(image.imageSize)}</td>
                  <td>{formatDate(image.imagePushedAt)}</td>
                  <td>{formatDate(image.lastPullDate)}</td>
                  <td>
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(image)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteModalOpen && (
        <DeleteModal
          image={selectedImage}
          repository={repository}
          onClose={() => {
            setDeleteModalOpen(false);
            setSelectedImage(null);
          }}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </>
  );
}

export default ImageList;


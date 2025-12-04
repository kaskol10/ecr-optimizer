import React, { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Label from '@radix-ui/react-label';
import { Calendar, Trash2, Eye, AlertTriangle, Loader2 } from 'lucide-react';
import './DeleteByDate.css';
import { apiUrl } from '../config';

function DeleteByDate({ repository, onDeleteSuccess }) {
  const [daysOld, setDaysOld] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [previewCount, setPreviewCount] = useState(null);
  const [previewSize, setPreviewSize] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [imagesToDelete, setImagesToDelete] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const isOpeningRef = useRef(false);

  // Debug: log when showConfirmModal changes
  useEffect(() => {
    console.log('showConfirmModal changed to:', showConfirmModal);
    console.log('Dialog should be', showConfirmModal ? 'OPEN' : 'CLOSED');
  }, [showConfirmModal]);

  const handlePreview = async () => {
    setPreviewLoading(true);
    setError(null);
    setSuccess(null);
    setImagesToDelete(null);
    
    try {
      // Fetch all images to count how many would be deleted
      const response = await fetch(apiUrl(`/api/images?repository=${repository}`));
      if (!response.ok) throw new Error('Failed to fetch images');
      
      const images = await response.json();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const filteredImages = images.filter(img => {
        if (!img.lastPullDate) return false;
        const lastPull = new Date(img.lastPullDate);
        return lastPull < cutoffDate;
      });
      
      const totalSize = filteredImages.reduce((sum, img) => sum + (img.imageSize || 0), 0);
      
      setPreviewCount(filteredImages.length);
      setPreviewSize(totalSize);
      setImagesToDelete(filteredImages);
    } catch (err) {
      setError(err.message);
      setPreviewCount(null);
      setImagesToDelete(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('handleDeleteClick called');
    console.log('imagesToDelete:', imagesToDelete);
    console.log('imagesToDelete?.length:', imagesToDelete?.length);
    if (!imagesToDelete || imagesToDelete.length === 0) {
      console.log('No images to delete, setting error');
      setError('Please preview images first to see what will be deleted');
      return;
    }
    
    console.log('Setting isOpeningRef to true, then showConfirmModal to true');
    isOpeningRef.current = true;
    
    // Use a longer delay to ensure all event propagation completes
    // Don't blur the button - let Dialog handle focus management
    setTimeout(() => {
      console.log('Opening modal now');
      setShowConfirmModal(true);
      // Keep the opening flag for longer to prevent immediate close
      setTimeout(() => {
        console.log('Clearing isOpeningRef flag');
        isOpeningRef.current = false;
      }, 1000);
    }, 200);
  };

  const handleConfirmDelete = async () => {
    if (!imagesToDelete || imagesToDelete.length === 0) {
      setError('No images selected for deletion');
      return;
    }

    // Don't close modal yet - keep it open to show progress
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Send the exact list of image digests from preview to ensure we delete exactly what was shown
      const imageDigests = imagesToDelete.map(img => img.imageDigest);
      
      const response = await fetch(apiUrl('/api/images/delete-by-date'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repositoryName: repository,
          daysOld: daysOld,
          imageDigests: imageDigests, // Send exact list from preview
        }),
      });

      const result = await response.json();
      
      if (!response.ok && response.status !== 206) {
        // 206 is PartialContent, which is acceptable
        throw new Error(result.error || 'Failed to delete images');
      }

      if (response.status === 206) {
        // Partial success - some images failed to delete
        const errorCount = result.errors ? result.errors.length : 0;
        const expectedCount = imagesToDelete ? imagesToDelete.length : 0;
        const deletedCount = result.deleted || 0;
        
        if (errorCount > 0) {
          setError(`Warning: Only ${deletedCount} out of ${expectedCount} images were deleted. ${errorCount} images failed (check console for details).`);
          console.warn('Deletion errors:', result.errors);
        }
        setSuccess(`Partially completed: ${deletedCount} images deleted`);
      } else {
        const expectedCount = imagesToDelete ? imagesToDelete.length : 0;
        const deletedCount = result.deleted || 0;
        if (deletedCount < expectedCount) {
          setError(`Warning: Only ${deletedCount} out of ${expectedCount} images were deleted. Some images may have failed.`);
        }
        setSuccess(`Successfully deleted ${deletedCount} images`);
      }
      
      setImagesToDelete(null);
      setPreviewCount(null);
      setPreviewSize(null);
      
      // Close modal after a short delay to show success message
      setTimeout(() => {
        setShowConfirmModal(false);
        setLoading(false);
        
        // Refresh the dashboard
        if (onDeleteSuccess) {
          setTimeout(() => {
            onDeleteSuccess();
          }, 500);
        }
      }, 1500);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      // Keep modal open on error so user can see the error message
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
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="delete-by-date-section">
      <div className="section-title">
        <Trash2 className="section-title-icon" size={20} />
        <h2>Delete Images by Date</h2>
      </div>
      <p className="section-description">
        Delete images that haven't been pulled in the last X days. Uses ECR's last_recorded_pulltime (same as lifecycle policies).
      </p>

      <div className="delete-controls">
        <div className="input-group">
          <Label.Root htmlFor="days-input" className="input-label">
            <Calendar className="input-icon" size={16} />
            Days since last pull:
          </Label.Root>
          <input
            id="days-input"
            type="number"
            min="1"
            value={daysOld}
            onChange={(e) => {
              setDaysOld(parseInt(e.target.value) || 30);
              setPreviewCount(null);
              setPreviewSize(null);
              setSuccess(null);
            }}
            className="days-input"
          />
        </div>

        <div className="button-group">
          <button
            className="preview-btn"
            onClick={handlePreview}
            disabled={previewLoading || loading}
            type="button"
          >
            <Eye size={16} />
            {previewLoading ? 'Checking...' : 'Preview'}
          </button>
          <button
            className="delete-btn"
            onClick={handleDeleteClick}
            disabled={loading || previewLoading || !imagesToDelete || imagesToDelete.length === 0}
            type="button"
          >
            <Trash2 size={16} />
            {loading ? 'Deleting...' : 'Delete Images'}
          </button>
        </div>
      </div>

      {previewCount !== null && (
        <div className="preview-result">
          <p>
            <strong>{previewCount}</strong> image{previewCount !== 1 ? 's' : ''} would be deleted
            {previewCount > 0 && ' (images not pulled in the last ' + daysOld + ' days)'}
          </p>
          {previewSize !== null && previewSize > 0 && (
            <p className="preview-size">
              Total size to be freed: <strong>{formatBytes(previewSize)}</strong>
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          {success}
        </div>
      )}

      <Dialog.Root 
        open={showConfirmModal}
        onOpenChange={(open) => {
          console.log('Dialog onOpenChange called:', open, 'loading:', loading, 'isOpeningRef.current:', isOpeningRef.current, 'current showConfirmModal:', showConfirmModal);
          
          // If we're in the process of opening, ignore ALL close events
          if (!open && isOpeningRef.current) {
            console.log('BLOCKING close event - modal is being opened (isOpeningRef is true)');
            return;
          }
          
          // If trying to close and we're loading, prevent it
          if (!open && loading) {
            console.log('Preventing modal close because deletion is in progress');
            return;
          }
          
          // If state already matches what we want, ignore (prevents unnecessary updates)
          if (open === showConfirmModal) {
            console.log('State already matches, ignoring');
            return;
          }
          
          // Only update if we're actually changing state
          console.log('Updating showConfirmModal to:', open);
          setShowConfirmModal(open);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay 
            className="confirm-modal-overlay"
            onAnimationEnd={() => console.log('Overlay animation ended - Dialog should be visible')}
          />
          <Dialog.Content 
            className="confirm-modal-content"
            onPointerDownOutside={(e) => {
              console.log('onPointerDownOutside called, loading:', loading, 'isOpeningRef:', isOpeningRef.current);
              if (loading || isOpeningRef.current) {
                e.preventDefault();
              }
            }}
            onEscapeKeyDown={(e) => {
              console.log('onEscapeKeyDown called, loading:', loading);
              if (loading) {
                e.preventDefault();
              }
            }}
            onInteractOutside={(e) => {
              console.log('onInteractOutside called, loading:', loading, 'isOpeningRef:', isOpeningRef.current);
              if (loading || isOpeningRef.current) {
                e.preventDefault();
              }
            }}
            onOpenAutoFocus={(e) => {
              // Allow default focus behavior - Dialog will focus the first focusable element
              // This prevents the button from retaining focus
              console.log('Dialog onOpenAutoFocus called');
            }}
            onCloseAutoFocus={(e) => {
              // Prevent returning focus to the button that opened the dialog
              console.log('Dialog onCloseAutoFocus called');
              e.preventDefault();
            }}
            onAnimationEnd={() => console.log('Content animation ended - Dialog should be fully visible')}
          >
            <div className="confirm-modal-header">
              <Dialog.Title asChild>
                <div className="modal-title-wrapper">
                  <AlertTriangle className="modal-title-icon" size={24} />
                  <h2>Confirm Deletion</h2>
                </div>
              </Dialog.Title>
              <Dialog.Close className="close-btn" aria-label="Close">×</Dialog.Close>
            </div>
            
            <Dialog.Description className="sr-only">
              Confirm deletion of {imagesToDelete?.length || 0} images from repository {repository}
            </Dialog.Description>
            <div className="confirm-modal-body">
              <div className="warning-banner">
                <strong>⚠️ This action is irreversible!</strong>
                <p>You are about to delete <strong>{imagesToDelete?.length || 0}</strong> image{(imagesToDelete?.length || 0) !== 1 ? 's' : ''} from repository <strong>{repository}</strong>.</p>
                {imagesToDelete && imagesToDelete.length > 0 && (
                  <p className="deletion-summary">
                    <strong>Total size to be freed:</strong> {formatBytes(imagesToDelete.reduce((sum, img) => sum + (img.imageSize || 0), 0))}
                  </p>
                )}
                <p>These images haven't been pulled in the last <strong>{daysOld} days</strong>.</p>
                <div className="sbom-warning">
                  <strong>⚠️ SBOM Warning:</strong> Deleting images will also permanently delete their associated Software Bill of Materials (SBOM). 
                  SBOMs contain important security and dependency information. If you need to preserve this data, export or backup the SBOMs before deletion.
                </div>
              </div>

              {imagesToDelete && (
                <div className="images-to-delete-list">
                  <h3>Images to be deleted ({imagesToDelete.length} total):</h3>
                  <div className="images-table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Tag</th>
                          <th>Digest</th>
                          <th>Size</th>
                          <th>Last Pull</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imagesToDelete.map((img, idx) => (
                          <tr key={img.imageDigest || idx}>
                            <td className="row-number">{idx + 1}</td>
                            <td>{img.imageTag || <span className="no-tag">untagged</span>}</td>
                            <td className="digest-cell" title={img.imageDigest}>
                              {img.imageDigest.substring(0, 24)}...
                            </td>
                            <td>{formatBytes(img.imageSize)}</td>
                            <td>{formatDate(img.lastPullDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="confirm-modal-footer">
              {loading ? (
                <div className="deletion-progress">
                  <Loader2 className="loading-spinner" size={20} />
                  <span>Deleting images... This may take a moment.</span>
                </div>
              ) : (
                <>
                  <Dialog.Close asChild>
                    <button
                      className="cancel-btn"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    className="confirm-delete-btn"
                    onClick={handleConfirmDelete}
                    disabled={loading}
                  >
                    {loading ? 'Deleting...' : `Yes, Delete ${imagesToDelete?.length || 0} Image${(imagesToDelete?.length || 0) !== 1 ? 's' : ''}`}
                  </button>
                </>
              )}
              {error && (
                <div className="modal-error-message">
                  {error}
                </div>
              )}
              {success && (
                <div className="modal-success-message">
                  {success}
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export default DeleteByDate;


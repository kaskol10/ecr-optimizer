import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as RadioGroup from '@radix-ui/react-radio-group';
import * as Label from '@radix-ui/react-label';
import './DeleteModal.css';
import { apiUrl } from '../config';

function DeleteModal({ image, repository, onClose, onSuccess }) {
  const [deleteByDate, setDeleteByDate] = useState(false);
  const [daysOld, setDaysOld] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      let response;
      if (deleteByDate) {
        response = await fetch(apiUrl('/api/images/delete-by-date'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repositoryName: repository,
            daysOld: daysOld,
          }),
        });
      } else {
        response = await fetch(apiUrl('/api/images/delete'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repositoryName: repository,
            imageDigests: [image.imageDigest],
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete image');
      }

      const result = await response.json();
      alert(`Success: ${result.message}${result.deleted ? ` (${result.deleted} images deleted)` : ''}`);
      onSuccess();
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

  return (
    <Dialog.Root open={true} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-content">
          <div className="modal-header">
            <Dialog.Title asChild>
              <h2>Delete Image</h2>
            </Dialog.Title>
            <Dialog.Close className="close-btn" aria-label="Close">×</Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">
            Delete image from repository {repository}
          </Dialog.Description>
          <div className="modal-body">
            {!deleteByDate && image && (
              <div className="image-info">
                <p><strong>Repository:</strong> {repository}</p>
                <p><strong>Tag:</strong> {image.imageTag || 'untagged'}</p>
                <p><strong>Digest:</strong> {image.imageDigest.substring(0, 32)}...</p>
                <p><strong>Size:</strong> {formatBytes(image.imageSize)}</p>
              </div>
            )}

            <RadioGroup.Root
              className="delete-options"
              value={deleteByDate ? 'by-date' : 'single'}
              onValueChange={(value) => setDeleteByDate(value === 'by-date')}
            >
              <div className="radio-option">
                <RadioGroup.Item value="single" id="delete-single" className="radio-item">
                  <RadioGroup.Indicator className="radio-indicator" />
                </RadioGroup.Item>
                <Label.Root htmlFor="delete-single" className="radio-label">
                  Delete this image
                </Label.Root>
              </div>
              <div className="radio-option">
                <RadioGroup.Item value="by-date" id="delete-by-date" className="radio-item">
                  <RadioGroup.Indicator className="radio-indicator" />
                </RadioGroup.Item>
                <Label.Root htmlFor="delete-by-date" className="radio-label">
                  Delete images older than X days (since last pull)
                </Label.Root>
              </div>
            </RadioGroup.Root>

            {deleteByDate && (
              <div className="date-input">
                <Label.Root htmlFor="days-old-input">
                  Days old:
                </Label.Root>
                <input
                  id="days-old-input"
                  type="number"
                  min="1"
                  value={daysOld}
                  onChange={(e) => setDaysOld(parseInt(e.target.value) || 30)}
                />
                <p className="help-text">
                  This will delete all images in {repository} that haven't been pulled in the last {daysOld} days.
                  Uses ECR's last_recorded_pulltime (same as lifecycle policies). Images never pulled will use their pushed date.
                </p>
              </div>
            )}

            {error && (
              <div className="error-message">{error}</div>
            )}
          </div>

          <div className="modal-footer">
            <Dialog.Close asChild>
              <button className="cancel-btn" disabled={loading}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              className="confirm-delete-btn"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default DeleteModal;


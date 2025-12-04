import React, { useState, useEffect, useRef } from 'react';
import { Search, Folder, Loader2 } from 'lucide-react';
import './RepositoryList.css';

function RepositoryList({ repositories, selectedRepo, onSelectRepo, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const activeRef = useRef(null);

  // Scroll active item into view when selectedRepo changes
  useEffect(() => {
    if (activeRef.current && selectedRepo) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedRepo]);

  const filteredRepos = repositories.filter(repo =>
    repo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="repository-list">
        <h2>Repositories</h2>
        <div className="loading">
          <Loader2 className="loading-spinner" size={20} />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="repository-list">
      <h2>Repositories ({repositories.length})</h2>
      <div className="search-box">
        <Search className="search-icon" size={18} />
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>
      {repositories.length === 0 ? (
        <div className="empty">No repositories found</div>
      ) : filteredRepos.length === 0 ? (
        <div className="empty">No repositories match "{searchTerm}"</div>
      ) : (
        <ul>
          {filteredRepos.map((repo) => (
            <li
              key={repo}
              ref={selectedRepo === repo ? activeRef : null}
              className={selectedRepo === repo ? 'active' : ''}
              onClick={() => onSelectRepo(repo)}
            >
              <Folder className="repo-icon" size={16} />
              <span className="repo-name">{repo}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RepositoryList;


// API configuration
// Support both build-time (process.env) and runtime (window.__ENV__) configuration
const getApiUrl = () => {
  // Runtime configuration (set by entrypoint script)
  if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.REACT_APP_API_URL) {
    return window.__ENV__.REACT_APP_API_URL;
  }
  // Build-time configuration
  return process.env.REACT_APP_API_URL || '';
};

export const API_URL = getApiUrl();

// Helper function to build API endpoints
export const apiUrl = (endpoint) => {
  // Remove leading slash from endpoint if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  // Ensure API_URL doesn't have trailing slash
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  return baseUrl ? `${baseUrl}/${cleanEndpoint}` : `/${cleanEndpoint}`;
};


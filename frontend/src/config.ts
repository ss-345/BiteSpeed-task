const getApiBase = (): string => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  if (typeof window !== 'undefined') {
    const { hostname, protocol, port } = window.location;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://localhost:3000`;  // your backend port
    }

    if (port) {
      return `${protocol}//${hostname}:${port}`;
    }

    return '';
  }

  return '';
};

export const API_BASE = getApiBase();
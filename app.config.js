// La versión web se publica en GitHub Pages bajo /RepoGames/app: la ruta base llega por EXPO_WEB_BASE.
module.exports = ({ config }) => {
  const base = process.env.EXPO_WEB_BASE;
  return {
    ...config,
    web: { ...config.web, output: 'single', name: 'Saga Quest', shortName: 'Saga Quest', themeColor: '#0b0b10' },
    experiments: { ...config.experiments, ...(base ? { baseUrl: base } : {}) },
  };
};

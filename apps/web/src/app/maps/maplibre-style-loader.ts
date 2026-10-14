let mapLibreStylePromise: Promise<void> | undefined;

export function loadMapLibreStyles(): Promise<void> {
  if (mapLibreStylePromise) return mapLibreStylePromise;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('maplibre.css', document.baseURI).href;
  link.dataset['maplibreStyle'] = '';

  mapLibreStylePromise = new Promise<void>((resolve, reject) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener(
      'error',
      () => reject(new Error('Não foi possível carregar os estilos do mapa.')),
      { once: true },
    );
    document.head.append(link);
  }).catch((error: unknown) => {
    link.remove();
    mapLibreStylePromise = undefined;
    throw error;
  });

  return mapLibreStylePromise;
}

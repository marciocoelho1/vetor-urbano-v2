let leafletStylePromise: Promise<void> | undefined;

export function loadLeafletStyles(): Promise<void> {
  if (leafletStylePromise) return leafletStylePromise;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('leaflet.css', document.baseURI).href;
  link.dataset['leafletStyle'] = '';

  leafletStylePromise = new Promise<void>((resolve, reject) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener(
      'error',
      () => reject(new Error('Não foi possível carregar os estilos do mapa 2D.')),
      { once: true },
    );
    document.head.append(link);
  }).catch((error: unknown) => {
    link.remove();
    leafletStylePromise = undefined;
    throw error;
  });

  return leafletStylePromise;
}

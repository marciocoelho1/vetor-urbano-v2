import type { StyleSpecification } from 'maplibre-gl';
import type * as maplibregl from 'maplibre-gl';

const DARK_COLORS: Record<string, string> = {
  '#e8eaed': '#202832',
  '#c5e1c0': '#263b30',
  '#ceead6': '#2c4535',
  '#e0ebd5': '#374638',
  '#f8f9fa': '#303944',
  '#f3eddc': '#403b30',
  '#eceff1': '#252e38',
  '#b3d5f2': '#19394f',
  '#696977': '#667386',
  '#c7cbd1': '#3a4552',
  '#ffffff': '#35404d',
  '#b4b2bd': '#596477',
  '#9491a1': '#69758a',
  '#dfe2e5': '#303a46',
  '#a0a0a0': '#667386',
  '#5f6368': '#d0d8e2',
};

let stylePromise: Promise<StyleSpecification> | undefined;

export function loadUrbanMapStyle(): Promise<StyleSpecification> {
  if (!stylePromise) {
    stylePromise = fetch(new URL('maps/urban-style.json', document.baseURI), {
      signal: AbortSignal.timeout(6000),
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`Estilo cartográfico indisponível (HTTP ${response.status}).`);
        const style = (await response.json()) as StyleSpecification;
        return { ...style, sprite: new URL('maps/occurrence-pins', document.baseURI).href };
      })
      .catch((error: unknown) => {
        stylePromise = undefined;
        throw error;
      });
  }
  return stylePromise;
}

export function applyUrbanMapTheme(
  map: maplibregl.Map,
  style: StyleSpecification,
  dark: boolean,
): void {
  for (const layer of style.layers) {
    if (!layer.paint || !map.getLayer(layer.id)) continue;
    for (const [property, value] of Object.entries(layer.paint)) {
      if (!property.endsWith('-color')) continue;
      map.setPaintProperty(layer.id, property as never, recolor(value, dark) as never);
    }
  }
}

function recolor(value: unknown, dark: boolean): unknown {
  if (typeof value === 'string') return dark ? (DARK_COLORS[value.toLowerCase()] ?? value) : value;
  if (Array.isArray(value)) return value.map((entry) => recolor(entry, dark));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, recolor(entry, dark)]),
    );
  }
  return value;
}

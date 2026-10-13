// A canvas context that draws nothing, so diagrams can run without a browser
// and their exceptions be caught.

export function mockContext(): CanvasRenderingContext2D {
  const noop = () => {};
  const state: Record<string | symbol, unknown> = { canvas: { width: 380, height: 236, clientWidth: 380 } };
  const handler: ProxyHandler<Record<string | symbol, unknown>> = {
    get(target, prop) {
      if (prop === 'measureText') return (s: string) => ({ width: String(s).length * 6 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') return () => ({ addColorStop: noop });
      if (prop === 'getImageData' || prop === 'createImageData') return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      if (prop === 'getLineDash') return () => [];
      if (prop in target) return target[prop];
      return noop;
    },
    set(target, prop, v) { target[prop] = v; return true; },
  };
  return new Proxy(state, handler) as unknown as CanvasRenderingContext2D;
}

import '@testing-library/jest-dom';

// CI polyfill for TransformStream if needed
if (typeof (globalThis as any).TransformStream === 'undefined') {
  (globalThis as any).TransformStream =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('web-streams-polyfill/ponyfill').TransformStream;
}

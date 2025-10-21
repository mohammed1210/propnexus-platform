import '@testing-library/jest-dom';

// CI polyfill for TransformStream if needed
if (typeof (global as any).TransformStream === 'undefined') {
  (global as any).TransformStream =
    require('web-streams-polyfill/ponyfill').TransformStream;
}

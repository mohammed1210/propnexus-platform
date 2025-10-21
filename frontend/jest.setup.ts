/* eslint-disable @typescript-eslint/no-var-requires */
if (typeof (globalThis as any).TransformStream === 'undefined') {
  (globalThis as any).TransformStream =
    require('web-streams-polyfill/ponyfill/es2018').TransformStream;
}

import '@testing-library/jest-dom';

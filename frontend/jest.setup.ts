import '@testing-library/jest-dom';

/* eslint-disable @typescript-eslint/no-var-requires */
if (typeof (globalThis as any).TransformStream === 'undefined') {
  (globalThis as any).TransformStream =
    require('web-streams-polyfill/ponyfill').TransformStream;
}

import '@testing-library/jest-dom';
